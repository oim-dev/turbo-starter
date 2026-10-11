import { Module } from '@nestjs/common';
import { SecurityModule } from '../infrastructure/auth/security.module';
import { loadApiConfig } from '../infrastructure/config/api-config';
import { ClientAuthModule } from './auth/client-auth.module';
import { ClientSessionStore } from './auth/client-session.store';
import { ClientUsersHttpModule } from './users/client-users-http.module';
import { ImagesModule } from '../modules/images/images.module';
import { ClientImagesController } from './images/client-images.controller';
import { ImageMediaController } from './images/image-media.controller';

export const clientApiConfig = loadApiConfig('client');

@Module({
  imports: [
    SecurityModule.register(clientApiConfig, ClientSessionStore),
    ClientAuthModule,
    ClientUsersHttpModule,
    ImagesModule,
  ],
  controllers: [ClientImagesController, ImageMediaController],
})
export class ClientAppModule {}
