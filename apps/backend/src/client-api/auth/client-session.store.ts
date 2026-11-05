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
        FROM "ClientUser" WHERE id = ${userId}::uuid FOR UPDATE
      `;
      return (
        user?.isActive === true &&
        (!expectedCredentials ||
          (user.login === expectedCredentials.login &&
            user.passwordHash === expectedCredentials.passwordHash))
      );
    },

    create(userId, transport, expiresAt) {
      return prisma.clientSession.create({
        data: {
          userId,
          transport,
          expiresAt,
        },
      });
    },

    async findActive(sessionId, userId, now) {
      const session = await prisma.clientSession.findFirst({
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

    async revoke(sessionId, userId, now) {
      await prisma.clientSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: now },
      });
    },
  };
}

@Injectable()
export class ClientSessionStore extends SessionStore {
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
