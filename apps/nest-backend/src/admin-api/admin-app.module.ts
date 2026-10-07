import { Module } from '@nestjs/common';
import { AdminRolesGuard } from '../infrastructure/auth/admin-roles';
import { SecurityModule } from '../infrastructure/auth/security.module';
import { loadApiConfig } from '../infrastructure/config/api-config';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminSessionStore } from './auth/admin-session.store';

export const adminApiConfig = loadApiConfig('admin');

@Module({
  imports: [
    SecurityModule.register(adminApiConfig, AdminSessionStore, AdminRolesGuard),
    AdminAuthModule,
  ],
})
export class AdminAppModule {}
