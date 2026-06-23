import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UnauthorizedException, ErrorCodes, AppConfigService } from '@platform';
import {
  EMPLOYEE_REPOSITORY,
  type IEmployeeRepository,
} from '../domain/ports/employee.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  type IRefreshTokenRepository,
} from '../domain/ports/refresh-token.repository';
import type { Employee } from '../domain/employee.types';

/** Shape returned by all login / refresh methods. */
export interface TokenResult {
  /** Short-lived JWT — return in JSON body; SPA stores in memory only. */
  accessToken: string;
  /** Seconds until the access token expires (typically 900 for 15 min). */
  expiresIn: number;
  /** Raw opaque refresh token — caller MUST write this to an HttpOnly cookie. Never log or return in JSON. */
  rawRefreshToken: string;
}

/**
 * Auth application service.
 *
 * Token strategy (enterprise / Rally-grade):
 *   - Access token:  15 min JWT, payload includes `sessionId` (= refresh_tokens.id).
 *                    Returned in JSON body. SPA stores in memory — never localStorage.
 *   - Refresh token: 7-day random token, delivered via HttpOnly Secure SameSite=Lax cookie only.
 *                    SHA-256 hash stored in DB. Rotated on every use.
 *   - Family ID:     Every login chain shares a `familyId`.  If a revoked token is
 *                    replayed, the entire family is revoked (theft detection).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepo: IEmployeeRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  async devLogin(email: string): Promise<TokenResult> {
    const employee = await this.employeeRepo.findByEmail(email.toLowerCase());
    if (!employee) {
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Unknown employee');
    }
    this.#assertActive(employee);
    return this.#mintTokens(employee, randomUUID());
  }

  async entraLogin(idToken: string): Promise<TokenResult> {
    const tenantId = this.config.get('ENTRA_TENANT_ID');
    const clientId = this.config.get('ENTRA_CLIENT_ID');

    if (!tenantId || !clientId) {
      throw new UnauthorizedException(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        'Entra SSO is not configured on this server',
      );
    }

    const jwksUrl = new URL(
      `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    );
    const JWKS = createRemoteJWKSet(jwksUrl);

    let claims: Record<string, unknown>;
    try {
      const { payload } = await jwtVerify(idToken, JWKS, {
        issuer: [
          `https://login.microsoftonline.com/${tenantId}/v2.0`,
          `https://sts.windows.net/${tenantId}/`,
        ],
        audience: clientId,
      });
      claims = payload as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid Entra ID token');
    }

    const oid = claims['oid'] as string | undefined;
    const email = (claims['preferred_username'] ?? claims['email'] ?? claims['upn']) as string | undefined;
    const displayName = claims['name'] as string | undefined;

    if (!oid || !email) {
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Token missing oid or email claim');
    }

    const employee = await this.employeeRepo.upsertByEntraOid(oid, {
      email: email.toLowerCase(),
      displayName: displayName ?? email.split('@')[0],
    });

    this.#assertActive(employee);
    return this.#mintTokens(employee, randomUUID());
  }

  /**
   * Rotate the refresh token.
   *
   * - Looks up the stored session by hash.
   * - If the token is already revoked, the entire family is killed (theft detected).
   * - If the token is expired, throws 401.
   * - Otherwise: atomically revokes the old session and issues a new one in the same family.
   */
  async refresh(rawToken: string): Promise<TokenResult> {
    const hash = this.#hash(rawToken);
    const stored = await this.refreshTokenRepo.findByHash(hash);

    if (!stored) {
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid refresh token');
    }

    if (stored.revoked) {
      // Token reuse detected — revoke the entire family (possible theft)
      await this.refreshTokenRepo.revokeFamily(stored.familyId);
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Refresh token reuse detected');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Refresh token expired');
    }

    // Revoke the old session row immediately
    await this.refreshTokenRepo.revokeById(stored.id);

    const employee = await this.employeeRepo.findById(stored.employeeId);
    if (!employee) {
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Employee not found');
    }
    this.#assertActive(employee);

    // Issue a new pair in the same family chain
    return this.#mintTokens(employee, stored.familyId);
  }

  /** Revoke the session tied to a raw refresh token (server-side logout). */
  async logout(rawToken: string): Promise<void> {
    const hash = this.#hash(rawToken);
    const stored = await this.refreshTokenRepo.findByHash(hash);
    if (stored && !stored.revoked) {
      await this.refreshTokenRepo.revokeById(stored.id);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  #assertActive(employee: Employee): void {
    if (employee.status === 'offboarded') {
      throw new UnauthorizedException(ErrorCodes.EMPLOYEE_INACTIVE, 'Employee is offboarded');
    }
  }

  /**
   * Core token issuance.
   *
   * @param employee  - The authenticated employee record.
   * @param familyId  - `randomUUID()` for a fresh login; existing `familyId` for rotation.
   */
  async #mintTokens(employee: Employee, familyId: string): Promise<TokenResult> {
    const sessionId = randomUUID();
    const rawRefreshToken = randomBytes(32).toString('base64url');
    const tokenHash = this.#hash(rawRefreshToken);
    const expiryDays = this.config.get('JWT_REFRESH_EXPIRY_DAYS');
    const expiresAt = new Date(Date.now() + expiryDays * 86_400_000);

    await this.refreshTokenRepo.create({
      id: sessionId,
      employeeId: employee.id,
      tokenHash,
      familyId,
      expiresAt,
    });

    const accessToken = await this.jwt.signAsync({
      sub: employee.id,
      sessionId,
      email: employee.email,
      name: employee.displayName,
      roles: employee.roles,
    });

    const expiresIn = 15 * 60; // 900 s — matches JWT_ACCESS_EXPIRY=15m

    return { accessToken, expiresIn, rawRefreshToken };
  }

  #hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
