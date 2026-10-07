import { Module } from '@nestjs/common';
import { SecurityModule } from '../infrastructure/auth/security.module';
import { loadApiConfig } from '../infrastructure/config/api-config';
import { ClientAuthModule } from './auth/client-auth.module';
import { ClientSessionStore } from './auth/client-session.store';
import { ClientUsersHttpModule } from './users/client-users-http.module';

export const clientApiConfig = loadApiConfig('client');

@Module({
  imports: [
    SecurityModule.register(clientApiConfig, ClientSessionStore),
    ClientAuthModule,
    ClientUsersHttpModule,
  ],
})
export class ClientAppModule {}
