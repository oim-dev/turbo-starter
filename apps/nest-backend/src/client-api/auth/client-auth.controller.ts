import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
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
import { SessionTransport } from '../../generated/prisma/client';
import { AccessTokenDto, LoginDto } from '../../infrastructure/auth/auth.dto';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import {
  BrowserAuth,
  BrowserRequest,
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
      'Возвращает Bearer JWT в accessToken на 7 дней (604800 секунд). Cookie авторизации не устанавливается. По истечении срока требуется новый вход.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AccessTokenDto })
  @ApiBadRequestResponse({ description: 'Некорректные данные для входа.' })
  @ApiUnauthorizedResponse({ description: 'Неверные учётные данные.' })
  @ApiForbiddenResponse({
    description: 'Обязательны корректный HTTP(S) Origin и X-CSRF-Protection: 1.',
  })
  login(@Body() dto: LoginDto): Promise<AccessTokenDto> {
    return this.auth.login(dto, SessionTransport.BROWSER);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @BrowserRequest()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    operationId: 'clientBrowserLogout',
    summary: 'Завершить браузерную сессию клиента',
    description:
      'Без тела. Требует валидный Bearer JWT этого API и активную сессию. Отзывает только текущую сессию из sid JWT; cookie не используются. Повторный запрос с отозванным JWT возвращает 401.',
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
    description: 'Обязательны корректный HTTP(S) Origin и X-CSRF-Protection: 1.',
  })
  logout(@Req() request: AuthenticatedRequest): Promise<void> {
    return this.sessions.logout(request.user);
  }
}
