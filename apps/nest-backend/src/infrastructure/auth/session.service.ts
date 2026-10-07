import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionTransport } from '../../generated/prisma/client';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import {
  SessionStore,
  type StoredSession,
  type VerifiedCredentials,
} from './session-store';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  sessionExpiresAt: Date;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
  ): Promise<IssuedTokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    const tokens = await this.store.transaction(async (queries) => {
      // Старая проверка пароля не должна открыть сессию после смены credentials
      // и отзыва сессий, даже если login ожидал блокировку пользователя.
      if (!(await queries.lockActiveUser(userId, expectedCredentials)))
        return null;
      // Ожидание блокировки пользователя не расходует TTL новой сессии.
      const expiresAt = new Date(
        Date.now() + this.config.sessionTtlSeconds * 1000,
      );
      const session = await queries.create(
        userId,
        transport,
        expiresAt,
        tokenHash(refreshToken),
      );
      // Первоначальная выдача входит в транзакцию: ошибка issue/signing
      // откатывает и сессию, и refresh token. HTTP-ответ возможен лишь после commit.
      return await this.issue(session, refreshToken);
    });
    if (!tokens) throw new UnauthorizedException('Invalid credentials');
    return tokens;
  }

  async refresh(
    refreshToken: string,
    transport: SessionTransport,
  ): Promise<IssuedTokens> {
    const nextToken = randomBytes(32).toString('base64url');
    const hash = tokenHash(refreshToken);
    const session = await this.store.transaction(async (queries) => {
      const token = await queries.findRefresh(hash);
      if (!token || token.session.transport !== transport) return null;
      const current = token.session;
      if (current.revokedAt || current.expiresAt <= new Date()) return null;

      // Используем ту же блокировку строки пользователя, что и при блокировке учётной записи,
      // чтобы обновление токенов и выход выполнялись последовательно.
      if (!(await queries.lockActiveUser(current.userId))) return null;
      const now = new Date();
      if (!(await queries.findActive(current.id, current.userId, now)))
        return null;
      if (token.usedAt || !(await queries.consumeRefresh(token.id, now))) {
        await queries.revoke(current.id, now);
        return null;
      }
      await queries.addRefresh(current.id, tokenHash(nextToken));
      return current;
    });
    // Выбрасываем исключение вне транзакции, чтобы зафиксировать отзыв сессии
    // при повторном использовании токена.
    if (!session)
      throw new UnauthorizedException('Invalid or expired refresh token');
    return this.issue(session, nextToken);
  }

  async logout(
    refreshToken: string | undefined,
    transport: SessionTransport,
  ): Promise<void> {
    if (!refreshToken) return;
    await this.store.transaction(async (queries) => {
      const token = await queries.findRefresh(tokenHash(refreshToken));
      if (!token || token.session.transport !== transport) return;
      await queries.lockActiveUser(token.session.userId);
      await queries.revoke(token.session.id, new Date());
    });
  }

  isActive(sessionId: string, userId: string): Promise<boolean> {
    return this.store.queries.findActive(sessionId, userId, new Date());
  }

  private async issue(
    session: StoredSession,
    refreshToken: string,
  ): Promise<IssuedTokens> {
    const now = Date.now();
    if (session.expiresAt.getTime() <= now)
      throw new UnauthorizedException('Session expired');

    // JWT использует целые секунды: iat округляем вниз, дедлайн сессии — вверх.
    // Иначе положительный остаток < 1 секунды теряется, особенно при TTL=1.
    // expiresIn = exp - iat, а точный предел авторизации остаётся expiresAt:
    // AccessGuard и refresh проверяют активную сессию в БД без округления.
    const issuedAt = Math.floor(now / 1000);
    const expiresIn = Math.min(
      this.config.accessTtlSeconds,
      Math.ceil(session.expiresAt.getTime() / 1000) - issuedAt,
    );
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
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      sessionExpiresAt: session.expiresAt,
    };
  }
}
