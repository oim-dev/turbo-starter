import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { SessionTransport } from '../../generated/prisma/client';
import type { LoginDto } from '../../infrastructure/auth/auth.dto';
import { verifyPassword } from '../../infrastructure/auth/password';
import {
  SessionService,
  type IssuedAccessToken,
} from '../../infrastructure/auth/session.service';
import { ClientUsersService } from '../../modules/client-users/client-users.service';

@Injectable()
export class ClientAuthService {
  constructor(
    private readonly users: ClientUsersService,
    private readonly sessions: SessionService,
  ) {}

  async login(
    dto: LoginDto,
    transport: SessionTransport,
  ): Promise<IssuedAccessToken> {
    const user = await this.users.findByLogin(dto.login);
    const valid = await verifyPassword(user?.passwordHash, dto.password);
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.sessions.create(user.id, transport, {
      login: user.login,
      passwordHash: user.passwordHash,
    });
  }
}
