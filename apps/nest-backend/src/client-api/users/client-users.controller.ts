import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import { BrowserTokens } from '../../infrastructure/auth/browser-auth';
import { ClientUsersService } from '../../modules/client-users/client-users.service';
import {
  ChangeClientUserLoginDto,
  ChangeClientUserPasswordDto,
} from '../../modules/client-users/dto/change-client-user-credentials.dto';
import { ClientUserDto } from '../../modules/client-users/dto/client-user.dto';
import { UpdateClientUserProfileDto } from '../../modules/client-users/dto/update-client-user-profile.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'Токен доступа или сессия отсутствуют, недействительны, просрочены или отозваны.',
})
@Controller('users')
export class ClientUsersController {
  constructor(
    private readonly users: ClientUsersService,
    private readonly browser: BrowserTokens,
  ) {}

  @Get('me')
  @ApiOperation({
    operationId: 'getClientUserProfile',
    summary: 'Получить профиль текущего клиента',
  })
  @ApiOkResponse({ type: ClientUserDto })
  @ApiNotFoundResponse({ description: 'Клиент не найден.' })
  getProfile(@Req() request: AuthenticatedRequest): Promise<ClientUserDto> {
    return this.users.getProfile(request.user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'updateClientUserProfile',
    summary: 'Обновить имя текущего клиента',
  })
  @ApiBody({ type: UpdateClientUserProfileDto })
  @ApiOkResponse({ type: ClientUserDto })
  @ApiBadRequestResponse({
    description: 'Некорректные данные для обновления профиля.',
  })
  @ApiNotFoundResponse({ description: 'Клиент не найден.' })
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateClientUserProfileDto,
  ): Promise<ClientUserDto> {
    return this.users.updateProfile(request.user, dto);
  }

  @Put('me/login')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'changeClientUserLogin',
    summary: 'Изменить логин текущего клиента',
    description:
      'Требует текущий пароль. Логин сохраняется в нижнем регистре. Успешный запрос атомарно отзывает все сессии, включая текущую, и удаляет refresh cookie. После ответа требуется новый вход, даже если логин не изменился.',
  })
  @ApiBody({ type: ChangeClientUserLoginDto })
  @ApiNoContentResponse({ description: 'Логин обновлён; все сессии отозваны.' })
  @ApiBadRequestResponse({ description: 'Некорректный логин или пароль.' })
  @ApiUnauthorizedResponse({
    description: 'Неверный текущий пароль, токен или неактивная сессия.',
  })
  @ApiConflictResponse({ description: 'Логин клиента уже занят.' })
  @ApiTooManyRequestsResponse({ description: 'Слишком много запросов.' })
  async changeLogin(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangeClientUserLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.users.changeLogin(request.user, dto);
    this.browser.clear(response);
  }

  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'changeClientUserPassword',
    summary: 'Изменить пароль текущего клиента',
    description:
      'Требует текущий пароль. Успешный запрос атомарно отзывает все сессии, включая текущую, и удаляет refresh cookie. После ответа требуется новый вход.',
  })
  @ApiBody({ type: ChangeClientUserPasswordDto })
  @ApiNoContentResponse({
    description: 'Пароль обновлён; все сессии отозваны.',
  })
  @ApiBadRequestResponse({ description: 'Некорректные данные смены пароля.' })
  @ApiUnauthorizedResponse({
    description: 'Неверный текущий пароль, токен или неактивная сессия.',
  })
  @ApiTooManyRequestsResponse({ description: 'Слишком много запросов.' })
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangeClientUserPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.users.changePassword(request.user, dto);
    this.browser.clear(response);
  }
}
