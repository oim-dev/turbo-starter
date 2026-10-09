import type { SessionTransport } from '../../generated/prisma/client';

export interface StoredSession {
  id: string;
  userId: string;
  transport: SessionTransport;
  expiresAt: Date;
  revokedAt: Date | null;
}

// Снимок credentials, по которому auth service уже проверил пароль.
// Не выходит за пределы серверного кода и не включается в токены/ответы.
export interface VerifiedCredentials {
  login: string;
  passwordHash: string;
  // Admin-only generation для операторского отзыва без смены пароля.
  // Client store продолжает проверять свой прежний снимок login/passwordHash.
  authVersion?: number;
}

// Каждое API предоставляет свой адаптер базы данных;
// протокол не содержит ветвления по типу учётной записи.
export interface SessionQueries {
  lockActiveUser(
    userId: string,
    expectedCredentials?: VerifiedCredentials,
  ): Promise<boolean>;
  create(
    userId: string,
    transport: SessionTransport,
    expiresAt: Date,
  ): Promise<StoredSession>;
  findActive(sessionId: string, userId: string, now: Date): Promise<boolean>;
  revoke(sessionId: string, userId: string, now: Date): Promise<void>;
}

export abstract class SessionStore {
  abstract readonly queries: SessionQueries;
  abstract transaction<T>(
    work: (queries: SessionQueries) => Promise<T>,
  ): Promise<T>;
}
