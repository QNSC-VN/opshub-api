import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../config/app-config.service';

/**
 * Authenticated principal attached to request.user.
 * OpsHub is single-tenant (one organisation) — no tenantId on the token.
 * Roles drive RBAC (e.g. 'it-admin', 'security', 'hr', 'manager', 'employee').
 */
export interface JwtPayload {
  /** Subject = employeeId */
  sub: string;
  /** Session ID — ties the access token to the refresh_tokens row for server-side revocation. */
  sessionId: string;
  email: string;
  name: string;
  roles: string[];
  iss: string;
  aud: string | string[];
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
      algorithms: ['HS256'],
      issuer: config.get('JWT_ISSUER'),
      audience: config.get('JWT_AUDIENCE'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    // Returning the payload attaches it to request.user.
    return payload;
  }
}
