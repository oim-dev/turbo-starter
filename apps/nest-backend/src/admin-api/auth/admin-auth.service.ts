import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { SessionTransport } from '../../generated/prisma/client';
import type { LoginDto } from '../../infrastructure/auth/auth.dto';
import { verifyPassword } from '../../infrastructure/auth/password';
import {
  SessionService,
  type IssuedTokens,
} from '../../infrastructure/auth/session.service';
import { AdminUsersService } from '../../modules/admin-users/admin-users.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly users: AdminUsersService,
    private readonly sessions: SessionService,
  ) {}

  async login(
    dto: LoginDto,
    transport: SessionTransport,
  ): Promise<IssuedTokens> {
    const user = await this.users.findByLogin(dto.login);
    const valid = await verifyPassword(user?.passwordHash, dto.password);
    if (
      !user ||
      !valid ||
      !user.isActive ||
      (process.env.NODE_ENV === 'production' &&
        dto.login.toLowerCase() === 'admin' &&
        dto.password === 'admin')
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.sessions.create(user.id, transport, {
      login: user.login,
      passwordHash: user.passwordHash,
    });
  }
}
