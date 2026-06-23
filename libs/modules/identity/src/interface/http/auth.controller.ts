import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, ApiCommonErrors, CurrentUser, Public } from '@platform';
import type { JwtPayload } from '@platform';
import { AuthService } from '../../application/auth.service';
import { DevLoginDto, AuthResponseDto, MeResponseDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('dev-login')
  @Public()
  @ApiOperation({
    summary: 'Dev login — mints a JWT for a known employee email (replaced by Entra OIDC in prod)',
  })
  @ApiCommonErrors(401, 422)
  async devLogin(@Body() dto: DevLoginDto): Promise<AuthResponseDto> {
    const { accessToken, employee } = await this.authService.devLogin(dto.email);
    return {
      accessToken,
      employee: {
        id: employee.id,
        email: employee.email,
        displayName: employee.displayName,
        roles: employee.roles,
      },
    };
  }

  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Return the authenticated principal' })
  @ApiCommonErrors(401)
  me(@CurrentUser() user: JwtPayload): MeResponseDto {
    return { sub: user.sub, email: user.email, name: user.name, roles: user.roles };
  }
}
