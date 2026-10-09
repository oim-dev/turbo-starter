import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AccessTokenDto } from '../../infrastructure/auth/auth.dto';
import { AdminOidcCookies } from '../../infrastructure/auth/admin-oidc/admin-oidc-cookies';
import { BrowserAuth } from '../../infrastructure/auth/browser-auth';
import { Public } from '../../infrastructure/auth/public.decorator';
import { AdminKeycloakService } from './admin-keycloak.service';

export class AdminAuthProvidersDto {
  @ApiProperty({ type: Boolean, enum: [true] }) local!: boolean;
  @ApiProperty({
    type: Boolean,
    description:
      'Keycloak включён и сконфигурирован. Это не проверка доступности провайдера.',
  })
  keycloak!: boolean;
}

@ApiTags('Auth')
@Controller('auth')
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class AdminKeycloakController {
  constructor(
    private readonly keycloak: AdminKeycloakService,
    private readonly cookies: AdminOidcCookies,
  ) {}

  @Get('providers')
  @Public()
  @ApiOperation({
    operationId: 'adminAuthProviders',
    security: [],
    summary: 'Получить доступные способы входа администратора',
  })
  @ApiOkResponse({ type: AdminAuthProvidersDto })
  providers(): Promise<AdminAuthProvidersDto> {
    return this.keycloak.providers();
  }

  // Навигационные endpoints намеренно не являются fetch-операциями SDK.
  @Get('keycloak/login')
  @Public()
  @ApiExcludeEndpoint()
  async login(
    @Req() request: Request,
    @Res() response: Response,
    @Query('returnTo') returnTo?: unknown,
  ): Promise<void> {
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.redirect(
      303,
      await this.keycloak.start(request, response, returnTo),
    );
  }

  @Get('keycloak/callback')
  @Public()
  @ApiExcludeEndpoint()
  async callback(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.redirect(303, await this.keycloak.callback(request, response));
  }

  @Post('keycloak/complete')
  @HttpCode(HttpStatus.OK)
  @BrowserAuth()
  @ApiCookieAuth('admin-keycloak-completion')
  @ApiCookieAuth('admin-keycloak-completion-secure')
  @ApiOperation({
    operationId: 'adminKeycloakComplete',
    security: [
      { 'admin-keycloak-completion': [] },
      { 'admin-keycloak-completion-secure': [] },
    ],
    summary: 'Однократно завершить вход через Keycloak',
    description:
      'Без тела. Обменять browser-bound completion cookie на собственную административную сессию и Bearer JWT в accessToken на 7 дней (604800 секунд). Cookie авторизации не устанавливается; временные OIDC cookies очищаются. Вызывать один раз под межвкладочной блокировкой; после потери ответа начать новый вход, не повторять запрос.',
  })
  @ApiOkResponse({ type: AccessTokenDto })
  @ApiUnauthorizedResponse({
    description:
      'Completion отсутствует, просрочен, использован или доступ отозван.',
  })
  @ApiForbiddenResponse({
    description: 'Обязательны корректный HTTP(S) Origin и X-CSRF-Protection: 1.',
  })
  @ApiNotFoundResponse({ description: 'Keycloak отключён.' })
  @ApiTooManyRequestsResponse({ description: 'Слишком много запросов.' })
  async complete(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    try {
      return await this.keycloak.complete(request);
    } finally {
      this.cookies.clear(response);
    }
  }
}
