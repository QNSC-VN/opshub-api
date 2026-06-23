import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UnauthorizedException, ErrorCodes, AppConfigService } from '@platform';
import {
  EMPLOYEE_REPOSITORY,
  type IEmployeeRepository,
} from '../domain/ports/employee.repository';
import type { Employee } from '../domain/employee.types';

export interface AuthResult {
  accessToken: string;
  employee: Employee;
}

/**
 * Auth application service.
 *
 * Dev: `devLogin` — email-only, no password, looks up seeded employees.
 * Prod: `entraLogin` — validates Entra ID id_token via JWKS, JIT-provisions
 *   the employee, mints the same internal HS256 JWT. The rest of the API
 *   (JwtStrategy / JwtAuthGuard / RoleGuard) never changes.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepo: IEmployeeRepository,
  ) {}

  async devLogin(email: string): Promise<AuthResult> {
    const employee = await this.employeeRepo.findByEmail(email.toLowerCase());
    if (!employee) {
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Unknown employee');
    }
    if (employee.status === 'offboarded') {
      throw new UnauthorizedException(ErrorCodes.EMPLOYEE_INACTIVE, 'Employee is offboarded');
    }

    const accessToken = await this.#mintToken(employee);
    return { accessToken, employee };
  }

  async entraLogin(idToken: string): Promise<AuthResult> {
    const tenantId = this.config.get('ENTRA_TENANT_ID');
    const clientId = this.config.get('ENTRA_CLIENT_ID');

    if (!tenantId || !clientId) {
      throw new UnauthorizedException(
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        'Entra SSO is not configured on this server',
      );
    }

    // Validate the id_token against Entra's public JWKS (no secret required).
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
    const displayName = (claims['name']) as string | undefined;

    if (!oid || !email) {
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Token missing oid or email claim');
    }

    const employee = await this.employeeRepo.upsertByEntraOid(oid, {
      email: email.toLowerCase(),
      displayName: displayName ?? email.split('@')[0],
    });

    if (employee.status === 'offboarded') {
      throw new UnauthorizedException(ErrorCodes.EMPLOYEE_INACTIVE, 'Employee is offboarded');
    }

    const accessToken = await this.#mintToken(employee);
    return { accessToken, employee };
  }

  async #mintToken(employee: Employee): Promise<string> {
    return this.jwt.signAsync({
      sub: employee.id,
      email: employee.email,
      name: employee.displayName,
      roles: employee.roles,
    });
  }
}
