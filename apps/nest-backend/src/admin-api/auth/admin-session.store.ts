import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  SessionStore,
  type SessionQueries,
} from '../../infrastructure/auth/session-store';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

function makeQueries(prisma: Prisma.TransactionClient): SessionQueries {
  return {
    async lockActiveUser(userId, expectedCredentials) {
      const [user] = await prisma.$queryRaw<
        Array<{ isActive: boolean; login: string; passwordHash: string }>
      >`
        SELECT "isActive", login, "passwordHash"
        FROM "AdminUser" WHERE id = ${userId}::uuid FOR UPDATE
      `;
      return (
        user?.isActive === true &&
        (!expectedCredentials ||
          (user.login === expectedCredentials.login &&
            user.passwordHash === expectedCredentials.passwordHash))
      );
    },

    create(userId, transport, expiresAt, tokenHash) {
      return prisma.adminSession.create({
        data: {
          userId,
          transport,
          expiresAt,
          refreshTokens: { create: { tokenHash } },
        },
      });
    },

    async findActive(sessionId, userId, now) {
      const session = await prisma.adminSession.findFirst({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
          expiresAt: { gt: now },
          user: { isActive: true },
        },
        select: { id: true },
      });
      return session !== null;
    },

    findRefresh(tokenHash) {
      return prisma.adminRefreshToken.findUnique({
        where: { tokenHash },
        include: { session: true },
      });
    },

    async consumeRefresh(id, now) {
      const result = await prisma.adminRefreshToken.updateMany({
        where: { id, usedAt: null },
        data: { usedAt: now },
      });
      return result.count === 1;
    },

    async addRefresh(sessionId, tokenHash) {
      await prisma.adminRefreshToken.create({
        data: { sessionId, tokenHash },
      });
    },

    async revoke(sessionId, now) {
      await prisma.adminSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: now },
      });
    },
  };
}

@Injectable()
export class AdminSessionStore extends SessionStore {
  readonly queries: SessionQueries;

  constructor(private readonly prisma: PrismaService) {
    super();
    this.queries = makeQueries(prisma);
  }

  transaction<T>(work: (queries: SessionQueries) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(makeQueries(tx)), {
      timeout: 10000,
    });
  }
}
