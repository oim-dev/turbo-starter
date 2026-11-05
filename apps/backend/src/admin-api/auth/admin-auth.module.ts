import { Module } from '@nestjs/common';
import { AdminUsersModule } from '../../modules/admin-users/admin-users.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminKeycloakSettingsService } from '../../modules/admin-settings/admin-keycloak-settings.service';
import { AdminKeycloakSettingsController } from './admin-keycloak-settings.controller';
import { AdminOidcProvider } from '../../infrastructure/auth/admin-oidc/admin-oidc-provider';
import { AdminOidcCookies } from '../../infrastructure/auth/admin-oidc/admin-oidc-cookies';
import { AdminKeycloakService } from './admin-keycloak.service';
import { AdminKeycloakController } from './admin-keycloak.controller';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

@Module({
  imports: [AdminUsersModule, PrismaModule],
  controllers: [
    AdminAuthController,
    AdminKeycloakController,
    AdminKeycloakSettingsController,
  ],
  providers: [
    AdminAuthService,
    AdminKeycloakService,
    AdminOidcProvider,
    AdminOidcCookies,
    AdminKeycloakSettingsService,
  ],
})
export class AdminAuthModule {}
