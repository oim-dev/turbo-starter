import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminPermissions } from '../../infrastructure/auth/admin-roles';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import {
  KeycloakSettingsDto,
  UpdateKeycloakSettingsDto,
} from '../../modules/admin-settings/admin-keycloak-settings.dto';
import { AdminKeycloakSettingsService } from '../../modules/admin-settings/admin-keycloak-settings.service';

@Controller('settings/keycloak')
@ApiTags('Settings')
@ApiBearerAuth('access-token')
@AdminPermissions('system.keycloak.manage')
export class AdminKeycloakSettingsController {
  constructor(private readonly settings: AdminKeycloakSettingsService) {}

  @Get()
  @ApiOperation({
    operationId: 'adminKeycloakSettingsGet',
    summary: 'Настройки Keycloak без секрета',
  })
  @ApiOkResponse({ type: KeycloakSettingsDto })
  get(): Promise<KeycloakSettingsDto> {
    return this.settings.get();
  }

  @Put()
  @ApiOperation({
    operationId: 'adminKeycloakSettingsUpdate',
    summary:
      'Сохранить настройки, проверить включение и отозвать прежние SSO-сессии',
  })
  @ApiOkResponse({ type: KeycloakSettingsDto })
  update(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateKeycloakSettingsDto,
  ): Promise<KeycloakSettingsDto> {
    return this.settings.update(request.user, dto);
  }
}
