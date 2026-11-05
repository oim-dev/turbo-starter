import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  AdminKeycloakSettings,
  Prisma,
} from '../../generated/prisma/client';
import { AdminOidcProvider } from '../../infrastructure/auth/admin-oidc/admin-oidc-provider';
import {
  validateAdminKeycloakConfig,
  type AdminKeycloakConfig,
  type EnabledAdminKeycloakConfig,
} from '../../infrastructure/config/admin-keycloak-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  lockAdminSecurity,
  requireAdminPermission,
  type AdminPrincipal,
} from '../admin-access/admin-permissions';
import {
  KeycloakSettingsDto,
  UpdateKeycloakSettingsDto,
} from './admin-keycloak-settings.dto';

@Injectable()
export class AdminKeycloakSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AdminOidcProvider,
  ) {}

  private view(settings: AdminKeycloakSettings | null): KeycloakSettingsDto {
    return {
      enabled: settings?.enabled ?? false,
      issuer: settings?.issuer ?? '',
      clientId: settings?.clientId ?? '',
      callbackUrl: settings?.callbackUrl ?? '',
      frontendCallbackUrl: settings?.frontendCallbackUrl ?? '',
      version: settings?.version ?? 0,
      hasSecret: Boolean(settings?.clientSecret),
      canStoreSecret: true,
    };
  }

  async get(): Promise<KeycloakSettingsDto> {
    return this.view(
      await this.prisma.adminKeycloakSettings.findUnique({ where: { id: 1 } }),
    );
  }

  async isEnabled(): Promise<boolean> {
    const settings = await this.prisma.adminKeycloakSettings.findUnique({
      where: { id: 1 },
      select: { enabled: true },
    });
    return settings?.enabled ?? false;
  }

  async runtime(): Promise<AdminKeycloakConfig> {
    const settings = await this.prisma.adminKeycloakSettings.findUnique({
      where: { id: 1 },
    });
    if (!settings?.enabled) return { enabled: false };
    if (!settings.clientSecret)
      throw new ServiceUnavailableException('Keycloak secret is unavailable');
    const config: EnabledAdminKeycloakConfig = {
      ...settings,
      enabled: true,
      clientSecret: settings.clientSecret,
    };
    validateAdminKeycloakConfig(config);
    return config;
  }

  async requireCurrent(
    tx: Prisma.TransactionClient,
    version: number,
  ): Promise<void> {
    const settings = await tx.adminKeycloakSettings.findUnique({
      where: { id: 1 },
    });
    if (!settings?.enabled || settings.version !== version)
      throw new ConflictException(
        'Keycloak settings changed. Start a new sign-in.',
      );
  }

  async update(
    actor: AdminPrincipal,
    dto: UpdateKeycloakSettingsDto,
  ): Promise<KeycloakSettingsDto> {
    const previous = await this.prisma.adminKeycloakSettings.findUnique({
      where: { id: 1 },
    });
    if ((previous?.version ?? 0) !== dto.version)
      throw new ConflictException('Настройки изменены. Обновите страницу.');
    if (dto.clearSecret && dto.clientSecret)
      throw new BadRequestException(
        'Нельзя одновременно заменить и удалить secret.',
      );
    const changesProvider =
      previous &&
      (previous.issuer !== dto.issuer || previous.clientId !== dto.clientId);
    if (
      changesProvider &&
      previous.clientSecret &&
      !dto.clientSecret &&
      !dto.clearSecret
    )
      throw new BadRequestException(
        'Для другого issuer или client ID введите новый secret либо удалите прежний.',
      );
    let clientSecret = dto.clearSecret ? null : (previous?.clientSecret ?? null);
    if (dto.clientSecret) clientSecret = dto.clientSecret;
    if (dto.enabled) {
      if (!clientSecret)
        throw new BadRequestException('Для включения требуется client secret.');
      const config: EnabledAdminKeycloakConfig = {
        ...dto,
        enabled: true,
        clientSecret,
        version: dto.version + 1,
      };
      try {
        validateAdminKeycloakConfig(config);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Некорректные настройки.',
        );
      }
      // Discovery проверяет issuer/endpoints/JWKS metadata, но не доказывает успешный вход пользователя.
      await this.provider.checkConfiguration(config);
    }
    return this.prisma.$transaction(
      async (tx) => {
        await lockAdminSecurity(tx);
        await requireAdminPermission(tx, actor, 'system.keycloak.manage');
        const current = await tx.adminKeycloakSettings.findUnique({
          where: { id: 1 },
        });
        if ((current?.version ?? 0) !== dto.version)
          throw new ConflictException('Настройки изменены. Обновите страницу.');
        const data = {
          enabled: dto.enabled,
          issuer: dto.issuer,
          clientId: dto.clientId,
          clientSecret,
          callbackUrl: dto.callbackUrl,
          frontendCallbackUrl: dto.frontendCallbackUrl,
          version: dto.version + 1,
        };
        const result = await tx.adminKeycloakSettings.upsert({
          where: { id: 1 },
          create: { id: 1, ...data },
          update: data,
        });
        await tx.adminOidcTransaction.deleteMany();
        await tx.adminSession.updateMany({
          where: { identityId: { not: null }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.adminSecurityAudit.create({
          data: {
            actorId: actor.id,
            action: 'keycloak.settings.update',
            target: 'keycloak',
          },
        });
        return this.view(result);
      },
      { timeout: 10000 },
    );
  }
}
