import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthResponseDto } from '../../application/auth/dto/auth-response.dto';
import { LoginDto } from '../../application/auth/dto/login.dto';
import { AuthMapper } from '../../application/auth/mappers/auth.mapper';
import { GetAuthenticatedUserUseCase } from '../../application/auth/use-cases/get-authenticated-user.use-case';
import { LoginUseCase } from '../../application/auth/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/auth/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../../application/auth/use-cases/refresh-session.use-case';
import { AuthenticatedUser } from '../../application/shared/authenticated-user';
import { UsuarioResponseDto } from '../../application/usuarios/dto/usuario-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { REFRESH_COOKIE, RefreshCookieService } from './refresh-cookie.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getUser: GetAuthenticatedUserUseCase,
    private readonly cookies: RefreshCookieService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión. El refresh token se entrega en una cookie HttpOnly.' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Usuario o clave incorrectos' })
  async doLogin(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const session = await this.login.execute(dto.usuario, dto.clave);
    this.cookies.set(res, session.refreshToken, session.refreshExpiresAt);
    return AuthMapper.toResponse(session);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Renueva el access token usando la cookie refresh_token y la rota.' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token ausente, inválido, expirado, revocado o reutilizado' })
  async doRefresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    try {
      const session = await this.refresh.execute(req.cookies?.[REFRESH_COOKIE]);
      this.cookies.set(res, session.refreshToken, session.refreshExpiresAt);
      return AuthMapper.toResponse(session);
    } catch (error) {
      this.cookies.clear(res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Cierra sesión: revoca la familia del refresh token y borra la cookie.' })
  async doLogout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.logoutUseCase.execute(req.cookies?.[REFRESH_COOKIE]);
    this.cookies.clear(res);
  }

  @Get('profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Usuario autenticado (sin clave ni hash).' })
  @ApiOkResponse({ type: UsuarioResponseDto })
  profile(@CurrentUser() user: AuthenticatedUser): Promise<UsuarioResponseDto> {
    return this.getUser.profile(user.id);
  }
}
