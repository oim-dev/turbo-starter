import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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
import { AdminPermissions } from '../../infrastructure/auth/admin-roles';
import {
  ChangeAdminLoginDto,
  UpdateAdminProfileDto,
} from '../../modules/admin-users/dto/update-admin-profile.dto';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import {
  BrowserAuth,
  BrowserRequest,
} from '../../infrastructure/auth/browser-auth';
import { SessionService } from '../../infrastructure/auth/session.service';
import { AdminUsersService } from '../../modules/admin-users/admin-users.service';
import { AdminUserDto } from '../../modules/admin-users/dto/admin-user.dto';
import { ChangeAdminPasswordDto } from '../../modules/admin-users/dto/change-admin-password.dto';
import { AdminAuthService } from './admin-auth.service';
import { AdminKeycloakService } from './admin-keycloak.service';

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
    private readonly keycloak: AdminKeycloakService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @BrowserAuth()
  @ApiOperation({
    operationId: 'adminBrowserLogin',
    security: [],
    summary: 'Создать браузерную сессию администратора',
    description:
      'Возвращает Bearer JWT в accessToken на 7 дней (604800 секунд). Cookie авторизации не устанавливается; незавершённый OIDC flow отменяется. По истечении срока требуется новый вход.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AccessTokenDto })
  @ApiBadRequestResponse({ description: 'Некорректные данные для входа.' })
  @ApiUnauthorizedResponse({ description: 'Неверные учётные данные.' })
  @ApiForbiddenResponse({
    description: 'Обязательны корректный HTTP(S) Origin и X-CSRF-Protection: 1.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    const token = await this.auth.login(dto, SessionTransport.BROWSER);
    await this.keycloak.cancelBrowser(request, response);
    return token;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @BrowserRequest()
  @AdminPermissions('account.read')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    operationId: 'adminBrowserLogout',
    summary: 'Завершить браузерную сессию администратора',
    description:
      'Без тела. Требует валидный Bearer JWT Admin API, активную сессию и account.read. Отзывает только текущую сессию из sid JWT, отменяет незавершённый OIDC flow и очищает его временные cookies. Logout локальный, без выхода из Keycloak SSO. Повторный запрос с отозванным JWT возвращает 401.',
  })
  @ApiNoContentResponse({
    description:
      'Текущая сессия отозвана. Клиент должен удалить сохранённый JWT.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Токен отсутствует, недействителен, просрочен или сессия отозвана.',
  })
  @ApiForbiddenResponse({
    description:
      'Обязательны account.read, корректный HTTP(S) Origin и X-CSRF-Protection: 1.',
  })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.logout(request.user);
    await this.keycloak.cancelBrowser(request, response);
  }

  @Get('me')
  @AdminPermissions('account.read')
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
  @AdminPermissions('account.password.change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    operationId: 'adminAuthChangePassword',
    summary: 'Изменить собственный пароль администратора',
    description:
      'Требует текущий пароль. Успешный запрос атомарно отзывает все сессии администратора, включая текущую. После ответа клиент должен удалить сохранённый JWT и выполнить новый вход.',
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
  ): Promise<void> {
    await this.admins.changePassword(request.user, dto);
  }

  @Patch('me')
  @AdminPermissions('account.update')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    operationId: 'adminUpdateProfile',
    summary: 'Изменить собственный профиль',
  })
  @ApiOkResponse({ type: AdminUserDto })
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateAdminProfileDto,
  ): Promise<AdminUserDto> {
    return this.admins.updateProfile(request.user, dto);
  }

  @Put('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AdminPermissions('account.login.change')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    operationId: 'adminChangeLogin',
    summary: 'Изменить свой логин и отозвать все сессии',
    description:
      'После успешного ответа клиент должен удалить сохранённый JWT и выполнить новый вход.',
  })
  @ApiNoContentResponse()
  async changeLogin(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangeAdminLoginDto,
  ): Promise<void> {
    await this.admins.changeLogin(request.user, dto);
  }
}
