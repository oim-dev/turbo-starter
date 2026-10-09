import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type ClientUser } from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import {
  hashPassword,
  verifyPassword,
} from '../../infrastructure/auth/password';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  ChangeClientUserLoginDto,
  ChangeClientUserPasswordDto,
} from './dto/change-client-user-credentials.dto';
import { ClientUserDto } from './dto/client-user.dto';
import { RegisterClientUserDto } from './dto/register-client-user.dto';
import { UpdateClientUserProfileDto } from './dto/update-client-user-profile.dto';

const clientUserSelect = {
  id: true,
  login: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientUserSelect;

type ClientPrincipal = AuthenticatedRequest['user'];

@Injectable()
export class ClientUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterClientUserDto): Promise<ClientUserDto> {
    const login = dto.login.toLowerCase();
    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.prisma.clientUser.create({
        data: {
          login,
          passwordHash,
          name: dto.name === undefined ? login : dto.name.trim(),
        },
        select: clientUserSelect,
      });
    } catch (error) {
      this.rethrowPrismaError(error);
    }
  }

  findByLogin(login: string): Promise<ClientUser | null> {
    return this.prisma.clientUser.findUnique({
      where: { login: login.toLowerCase() },
    });
  }

  async getProfile(id: string): Promise<ClientUserDto> {
    try {
      return await this.prisma.clientUser.findUniqueOrThrow({
        where: { id },
        select: clientUserSelect,
      });
    } catch (error) {
      this.rethrowPrismaError(error);
    }
  }

  async updateProfile(
    actor: ClientPrincipal,
    dto: UpdateClientUserProfileDto,
  ): Promise<ClientUserDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockActiveSession(tx, actor);
      return tx.clientUser.update({
        where: { id: actor.id },
        data: { name: dto.name?.trim() },
        select: clientUserSelect,
      });
    });
  }

  async changeLogin(
    actor: ClientPrincipal,
    dto: ChangeClientUserLoginDto,
  ): Promise<void> {
    // Новый salt меняет снимок credentials даже для прежнего логина или
    // последовательности A → B → A. Ожидающий login со старым hash не должен
    // открыть сессию после отзыва. Сам пароль не меняется; проверяем его под lock.
    const passwordHash = await hashPassword(dto.currentPassword);
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const user = await this.lockActiveSession(tx, actor);
          await this.requirePassword(user.passwordHash, dto.currentPassword);
          await tx.clientUser.update({
            where: { id: actor.id },
            data: { login: dto.login.toLowerCase(), passwordHash },
            select: { id: true },
          });
          await this.revokeSessions(tx, actor.id);
        },
        { timeout: 10000 },
      );
    } catch (error) {
      this.rethrowPrismaError(error);
    }
  }

  async changePassword(
    actor: ClientPrincipal,
    dto: ChangeClientUserPasswordDto,
  ): Promise<void> {
    // Дорогое хеширование нового пароля не удерживает блокировку пользователя.
    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction(
      async (tx) => {
        const user = await this.lockActiveSession(tx, actor);
        await this.requirePassword(user.passwordHash, dto.currentPassword);
        await tx.clientUser.update({
          where: { id: actor.id },
          data: { passwordHash },
          select: { id: true },
        });
        await this.revokeSessions(tx, actor.id);
      },
      { timeout: 10000 },
    );
  }

  private async lockActiveSession(
    tx: Prisma.TransactionClient,
    actor: ClientPrincipal,
  ) {
    // Порядок блокировок совпадает с login/logout: user, затем session.
    await tx.$queryRaw`
      SELECT id FROM "ClientUser" WHERE id = ${actor.id}::uuid FOR UPDATE
    `;
    const now = new Date();
    const session = await tx.clientSession.findFirst({
      where: {
        id: actor.sessionId,
        userId: actor.id,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { isActive: true },
      },
      select: { user: { select: { passwordHash: true } } },
    });
    // Проверяем после ожидания блокировки: старый запрос не может менять профиль
    // или credentials после конкурентного отзыва своей сессии.
    if (!session || actor.accessExpiresAt <= now.getTime()) {
      throw new UnauthorizedException('Session is inactive');
    }
    return session.user;
  }

  private async requirePassword(hash: string, password: string): Promise<void> {
    if (!(await verifyPassword(hash, password))) {
      throw new UnauthorizedException({
        code: 'CURRENT_PASSWORD_INVALID',
        message: 'Invalid current password',
      });
    }
  }

  private async revokeSessions(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    await tx.clientSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private rethrowPrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Client login is already in use.');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Client user not found.');
      }
    }
    throw error;
  }
}
