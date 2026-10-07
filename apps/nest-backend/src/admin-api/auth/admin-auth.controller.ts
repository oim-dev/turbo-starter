import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SessionTransport } from '../../generated/prisma/client';
import { AccessTokenDto, LoginDto } from '../../infrastructure/auth/auth.dto';
import { AdminRoles } from '../../infrastructure/auth/admin-roles';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import {
  BrowserAuth,
  BrowserTokens,
} from '../../infrastructure/auth/browser-auth';
import { SessionService } from '../../infrastructure/auth/session.service';
import { AdminUsersService } from '../../modules/admin-users/admin-users.service';
import { AdminUserDto } from '../../modules/admin-users/dto/admin-user.dto';
import { ChangeAdminPasswordDto } from '../../modules/admin-users/dto/change-admin-password.dto';
import { AdminAuthService } from './admin-auth.service';

@ApiTags('Auth')
@ApiTooManyRequestsResponse({
  description: 'Слишком много запросов аутентификации.',
})
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly admins: AdminUsersService,
    private readonly sessions: SessionService,
    private readonly browser: BrowserTokens,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @BrowserAuth()
  @ApiOperation({
    operationId: 'adminBrowserLogin',
    security: [],
    summary: 'Создать браузерную сессию администратора',
    description:
      'Возвращает токен доступа в JSON и устанавливает cookie с токеном обновления и флагом HttpOnly.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AccessTokenDto })
  @ApiBadRequestResponse({ description: 'Некорректные данные для входа.' })
  @ApiUnauthorizedResponse({ description: 'Неверные учётные данные.' })
  @ApiForbiddenResponse({
    description: 'Обязательны разрешённый Origin и X-CSRF-Protection: 1.',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    return this.browser.respond(
      response,
      await this.auth.login(dto, SessionTransport.BROWSER),
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @BrowserAuth()
  @ApiCookieAuth('refresh-cookie')
  @ApiOperation({
    operationId: 'adminBrowserRefresh',
    security: [{ 'refresh-cookie': [] }],
    summary: 'Заменить токен обновления браузерной сессии администратора',
    description:
      'Каждый токен обновления используется только один раз; повторное использование отзывает сессию. Если ответ потерян после ротации, войдите заново вместо повторного запроса. Новый токен обновления передаётся только в cookie с флагом HttpOnly.',
  })
  @ApiOkResponse({ type: AccessTokenDto })
  @ApiUnauthorizedResponse({
    description:
      'Токен обновления отсутствует, недействителен, просрочен или уже использован.',
  })
  @ApiForbiddenResponse({
    description: 'Обязательны разрешённый Origin и X-CSRF-Protection: 1.',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    const token = this.browser.read(request);
    if (token === undefined) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return this.browser.respond(
      response,
      await this.sessions.refresh(token, SessionTransport.BROWSER),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @BrowserAuth()
  @ApiCookieAuth('refresh-cookie')
  @ApiOperation({
    operationId: 'adminBrowserLogout',
    security: [{}, { 'refresh-cookie': [] }],
    summary: 'Завершить браузерную сессию администратора',
    description:
      'Немедленно отзывает сессию, включая токены доступа, связанные через sid, и удаляет cookie с токеном обновления. Отсутствие или недействительность cookie не считается ошибкой.',
  })
  @ApiNoContentResponse({
    description: 'Выход выполнен; cookie с токеном обновления удалена.',
  })
  @ApiForbiddenResponse({
    description: 'Обязательны разрешённый Origin и X-CSRF-Protection: 1.',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.logout(
      this.browser.read(request),
      SessionTransport.BROWSER,
    );
    this.browser.clear(response);
  }

  @Get('me')
  @AdminRoles('OWNER', 'SUPPORT')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    operationId: 'adminAuthMe',
    summary: 'Получить профиль текущего администратора',
  })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiUnauthorizedResponse({
    description:
      'Токен доступа или сессия отсутствуют, недействительны, просрочены или отозваны.',
  })
  @ApiNotFoundResponse({ description: 'Администратор не найден.' })
  me(@Req() request: AuthenticatedRequest): Promise<AdminUserDto> {
    return this.admins.getProfile(request.user.id);
  }

  @Put('password')
  @AdminRoles('OWNER', 'SUPPORT')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    operationId: 'adminAuthChangePassword',
    summary: 'Изменить собственный пароль администратора',
    description:
      'Требует текущий пароль. Успешный запрос атомарно отзывает все сессии администратора, включая текущую, и удаляет refresh cookie. После ответа требуется новый вход.',
  })
  @ApiBody({ type: ChangeAdminPasswordDto })
  @ApiNoContentResponse({
    description: 'Пароль обновлён; все сессии отозваны.',
  })
  @ApiBadRequestResponse({ description: 'Некорректные данные смены пароля.' })
  @ApiUnauthorizedResponse({
    description: 'Неверный текущий пароль, токен или неактивная сессия.',
  })
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangeAdminPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.admins.changePassword(request.user, dto);
    this.browser.clear(response);
  }
}
