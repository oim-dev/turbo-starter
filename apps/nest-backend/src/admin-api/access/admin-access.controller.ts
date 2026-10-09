import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminPermissions } from '../../infrastructure/auth/admin-roles';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import { AdminAccessService } from '../../modules/admin-access/admin-access.service';
import { PERMISSIONS } from '../../modules/admin-access/admin-permissions';
import {
  AdminAccessRoleDto,
  AdminAccountDto,
  AdminPermissionDto,
  CreateAdminAccountDto,
  CreateAdminRoleDto,
  UpdateAdminAccountDto,
  UpdateAdminRoleDto,
  BindAdminIdentityDto,
} from '../../modules/admin-access/admin-access.dto';

@Controller('access')
@ApiTags('Access')
@ApiBearerAuth('access-token')
@AdminPermissions('system.access.manage')
export class AdminAccessController {
  constructor(private readonly access: AdminAccessService) {}

  @Get('permissions')
  @ApiOperation({
    operationId: 'adminPermissionsList',
    summary: 'Каталог серверных permissions',
  })
  @ApiOkResponse({ type: [AdminPermissionDto] })
  permissions(): AdminPermissionDto[] {
    return [...PERMISSIONS];
  }

  @Get('roles')
  @ApiOperation({ operationId: 'adminRolesList', summary: 'Список ролей' })
  @ApiOkResponse({ type: [AdminAccessRoleDto] })
  roles(): Promise<AdminAccessRoleDto[]> {
    return this.access.roles();
  }

  @Post('roles')
  @ApiOperation({ operationId: 'adminRoleCreate', summary: 'Создать роль' })
  @ApiCreatedResponse({ type: AdminAccessRoleDto })
  createRole(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAdminRoleDto,
  ): Promise<AdminAccessRoleDto> {
    return this.access.createRole(request.user, dto);
  }

  @Put('roles/:key')
  @ApiOperation({
    operationId: 'adminRoleUpdate',
    summary: 'Изменить роль и отозвать сессии её пользователей',
  })
  @ApiOkResponse({ type: AdminAccessRoleDto })
  updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() dto: UpdateAdminRoleDto,
  ): Promise<AdminAccessRoleDto> {
    return this.access.updateRole(request.user, key, dto);
  }

  @Delete('roles/:key')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'adminRoleDelete',
    summary: 'Удалить неназначенную дополнительную роль',
  })
  @ApiNoContentResponse()
  deleteRole(
    @Req() request: AuthenticatedRequest,
    @Param('key') key: string,
  ): Promise<void> {
    return this.access.deleteRole(request.user, key);
  }

  @Get('users')
  @ApiOperation({
    operationId: 'adminAccountsList',
    summary: 'Список аккаунтов админки',
  })
  @ApiOkResponse({ type: [AdminAccountDto] })
  accounts(): Promise<AdminAccountDto[]> {
    return this.access.accounts();
  }

  @Post('users')
  @ApiOperation({
    operationId: 'adminAccountCreate',
    summary: 'Создать аккаунт админки',
  })
  @ApiCreatedResponse({ type: AdminAccountDto })
  createAccount(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAdminAccountDto,
  ): Promise<AdminAccountDto> {
    return this.access.createAccount(request.user, dto);
  }

  @Patch('users/:id')
  @ApiOperation({
    operationId: 'adminAccountUpdate',
    summary: 'Изменить роль или активность аккаунта',
  })
  @ApiOkResponse({ type: AdminAccountDto })
  updateAccount(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminAccountDto,
  ): Promise<AdminAccountDto> {
    return this.access.updateAccount(request.user, id, dto);
  }

  @Post('users/:id/identities')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'adminIdentityBind',
    summary: 'Привязать пользователя Keycloak и отозвать прежние сессии',
  })
  @ApiNoContentResponse()
  bindIdentity(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BindAdminIdentityDto,
  ): Promise<void> {
    return this.access.bindIdentity(request.user, id, dto);
  }

  @Delete('users/:id/identities/:identityId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'adminIdentityUnbind',
    summary: 'Отозвать привязку пользователя Keycloak',
  })
  @ApiNoContentResponse()
  unbindIdentity(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('identityId', ParseUUIDPipe) identityId: string,
  ): Promise<void> {
    return this.access.unbindIdentity(request.user, id, identityId);
  }

  @Delete('users/:id/local-password')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'adminLocalPasswordDisable',
    summary: 'Отключить локальный пароль и отозвать сессии',
  })
  @ApiNoContentResponse()
  disableLocalPassword(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.access.disableLocalPassword(request.user, id);
  }

  @Delete('users/:id/sessions')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'adminSessionsRevoke',
    summary: 'Отозвать все сессии и незавершённую аутентификацию аккаунта',
  })
  @ApiNoContentResponse()
  revokeSessions(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.access.revokeSessions(request.user, id);
  }
}
