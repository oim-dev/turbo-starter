import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionTransport } from '../../generated/prisma/client';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type { AuthenticatedRequest } from './authenticated-request';
import {
  SessionStore,
  type StoredSession,
  type VerifiedCredentials,
} from './session-store';

export interface IssuedAccessToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  sessionExpiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly store: SessionStore,
    private readonly jwt: JwtService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async create(
    userId: string,
    transport: SessionTransport,
    expectedCredentials: VerifiedCredentials,
  ): Promise<IssuedAccessToken> {
    const token = await this.store.transaction(async (queries) => {
      // Старая проверка пароля не должна открыть сессию после смены credentials
      // и отзыва сессий, даже если login ожидал блокировку пользователя.
      if (!(await queries.lockActiveUser(userId, expectedCredentials)))
        return null;
      // Ожидание блокировки пользователя не расходует TTL новой сессии.
      const session = await queries.create(
        userId,
        transport,
        this.newSessionExpiresAt(),
      );
      // Первоначальная выдача входит в транзакцию: ошибка issue/signing
      // откатывает сессию. HTTP-ответ возможен лишь после commit.
      return await this.issue(session);
    });
    if (!token) throw new UnauthorizedException('Invalid credentials');
    return token;
  }

  // Единый срок для local login и Keycloak; дедлайн БД совпадает с exp JWT.
  // Вызывается после блокировок, непосредственно перед созданием новой сессии.
  newSessionExpiresAt(): Date {
    return new Date(
      (Math.floor(Date.now() / 1000) + this.config.accessTtlSeconds) * 1000,
    );
  }

  async logout(actor: AuthenticatedRequest['user']): Promise<void> {
    await this.store.transaction(async (queries) => {
      // Principal поступает только из AccessGuard. После user lock повторяем
      // проверку, чтобы ожидание credentials/logout не продлевало авторизацию.
      const activeUser = await queries.lockActiveUser(actor.id);
      const now = new Date();
      if (
        !activeUser ||
        actor.accessExpiresAt <= now.getTime() ||
        !(await queries.findActive(actor.sessionId, actor.id, now))
      )
        throw new UnauthorizedException('Session is inactive');
      await queries.revoke(actor.sessionId, actor.id, now);
    });
  }

  isActive(sessionId: string, userId: string): Promise<boolean> {
    return this.store.queries.findActive(sessionId, userId, new Date());
  }

  // Серверный API выдачи: вызывающий код обязан проверить аккаунт и создать
  // сессию в своей транзакции; signing должен завершиться до её commit.
  async issue(session: StoredSession): Promise<IssuedAccessToken> {
    const now = Date.now();
    if (session.expiresAt.getTime() <= now)
      throw new UnauthorizedException('Session expired');

    // issue вызывается только для новой сессии, не продлевает её и не зависит
    // от upstream TTL Keycloak. iat — момент выделения срока новой сессии;
    // задержка INSERT/signing не сдвигает exp относительно дедлайна БД.
    const expiresIn = this.config.accessTtlSeconds;
    const issuedAt = session.expiresAt.getTime() / 1000 - expiresIn;
    const accessToken = await this.jwt.signAsync(
      { sid: session.id, iat: issuedAt },
      {
        secret: this.config.jwtSecret,
        algorithm: 'HS256',
        subject: session.userId,
        issuer: this.config.issuer,
        audience: this.config.audience,
        expiresIn,
      },
    );
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      sessionExpiresAt: session.expiresAt,
    };
  }
}
