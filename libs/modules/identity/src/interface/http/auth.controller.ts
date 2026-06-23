import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Auth, ApiCommonErrors, CurrentUser, Public, UnauthorizedException, PermissionDeniedException, ErrorCodes, AppConfigService } from '@platform';
import type { JwtPayload } from '@platform';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../../application/auth.service';
import { DevLoginDto, EntraLoginDto, AuthResponseDto, MeResponseDto } from './dto/auth.dto';

const REFRESH_COOKIE = 'refresh_token';

/** Path-scoped cookie options — ensures the refresh token is only sent to the auth path. */
function refreshCookieOptions(maxAge: number, isProd: boolean) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/v1/auth',
    maxAge,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  readonly #isProd: boolean;
  readonly #refreshMaxAge: number;

  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {
    this.#isProd = config.get('NODE_ENV') === 'production';
    this.#refreshMaxAge = config.get('JWT_REFRESH_EXPIRY_DAYS') * 24 * 60 * 60;
  }

  /** Brute-force / credential-stuffing protection: 5 attempts per 15 min per IP. */
  @Post('entra-login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @HttpCode(200)
  @ApiOperation({
    summary: 'SSO login — validate Entra ID id_token, JIT-provision employee, mint internal JWT',
  })
  @ApiCommonErrors(401)
  async entraLogin(
    @Body() dto: EntraLoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponseDto> {
    const { accessToken, expiresIn, rawRefreshToken } = await this.authService.entraLogin(dto.idToken);
    reply.setCookie(REFRESH_COOKIE, rawRefreshToken, refreshCookieOptions(this.#refreshMaxAge, this.#isProd));
    return { accessToken, expiresIn };
  }

  @Post('dev-login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Dev login — only available outside production (Entra OIDC is used in prod)' })
  @ApiCommonErrors(401, 403, 422)
  async devLogin(
    @Body() dto: DevLoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponseDto> {
    if (this.#isProd) {
      throw new PermissionDeniedException('Dev login is disabled in production');
    }
    const { accessToken, expiresIn, rawRefreshToken } = await this.authService.devLogin(dto.email);
    reply.setCookie(REFRESH_COOKIE, rawRefreshToken, refreshCookieOptions(this.#refreshMaxAge, this.#isProd));
    return { accessToken, expiresIn };
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Silently refresh the access token using the HttpOnly refresh cookie' })
  @ApiCommonErrors(401)
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponseDto> {
    const rawToken = request.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      reply.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'No refresh token');
    }
    const { accessToken, expiresIn, rawRefreshToken } = await this.authService.refresh(rawToken);
    reply.setCookie(REFRESH_COOKIE, rawRefreshToken, refreshCookieOptions(this.#refreshMaxAge, this.#isProd));
    return { accessToken, expiresIn };
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the current refresh token session and clear the cookie' })
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const rawToken = request.cookies?.[REFRESH_COOKIE];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    reply.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
  }

  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Return the authenticated principal' })
  @ApiCommonErrors(401)
  me(@CurrentUser() user: JwtPayload): MeResponseDto {
    return { sub: user.sub, email: user.email, name: user.name, roles: user.roles };
  }
}


