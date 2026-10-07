import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import {
  BrowserAuth,
  BrowserTokens,
} from '../../infrastructure/auth/browser-auth';
import { Public } from '../../infrastructure/auth/public.decorator';
import { SessionService } from '../../infrastructure/auth/session.service';
import { ClientUsersService } from '../../modules/client-users/client-users.service';
import { ClientUserDto } from '../../modules/client-users/dto/client-user.dto';
import { RegisterClientUserDto } from '../../modules/client-users/dto/register-client-user.dto';
import { ClientAuthService } from './client-auth.service';

@ApiTags('Auth')
@ApiTooManyRequestsResponse({
  description: 'Слишком много запросов аутентификации.',
})
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class ClientAuthController {
  constructor(
    private readonly auth: ClientAuthService,
    private readonly users: ClientUsersService,
    private readonly sessions: SessionService,
    private readonly browser: BrowserTokens,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    operationId: 'clientAuthRegister',
    security: [],
    summary: 'Зарегистрировать учётную запись клиента',
    description:
      'Создаёт только учётную запись; для создания сессии необходимо отдельно выполнить вход.',
  })
  @ApiBody({ type: RegisterClientUserDto })
  @ApiCreatedResponse({ type: ClientUserDto })
  @ApiBadRequestResponse({
    description: 'Некорректные данные для регистрации.',
  })
  @ApiConflictResponse({ description: 'Логин клиента уже занят.' })
  register(@Body() dto: RegisterClientUserDto): Promise<ClientUserDto> {
    return this.users.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @BrowserAuth()
  @ApiOperation({
    operationId: 'clientBrowserLogin',
    security: [],
    summary: 'Создать браузерную сессию клиента',
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
    operationId: 'clientBrowserRefresh',
    security: [{ 'refresh-cookie': [] }],
    summary: 'Заменить токен обновления браузерной сессии клиента',
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
    operationId: 'clientBrowserLogout',
    security: [{}, { 'refresh-cookie': [] }],
    summary: 'Завершить браузерную сессию клиента',
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
}
