import { createStore } from 'zustand/vanilla'
import type { AuthError } from '../errors/auth.error'
import { AUTH_STATUS } from '../types/authentication.type'
import type { Authentication } from '../types/authentication.type'
import type { SessionCredentials } from '../types/session-credentials.type'

/**
 * Клиентский lifecycle допуска; профиль и токены в store не хранятся.
 */
type AuthStore = {
  /**
   * Публичное решение о доступе.
   */
  authentication: Authentication
  /**
   * Нечувствительная идентичность общей браузерной сессии.
   */
  sessionId: string | null
  /**
   * Локальное поколение приватного кеша.
   */
  cacheEpoch: number
  /**
   * Ревизия пользовательского намерения для защиты от поздних результатов.
   */
  revision: number
  /**
   * Абсолютное окончание серверной сессии, в том числе при сетевой ошибке bootstrap.
   */
  sessionExpiresAt: number | null
  /**
   * Начинает новое намерение входа или восстановления.
   */
  begin: (isChecking?: boolean) => number
  /**
   * Принимает метаданные credential до подтверждения профиля.
   */
  accept: (sessionId: string, credentials: SessionCredentials) => void
  /**
   * Подтверждает доступ после получения активного администратора.
   */
  confirm: () => void
  /**
   * Закрывает доступ и отделяет приватный кеш; recoverable сохраняет срок для повтора проверки.
   */
  reset: (error: AuthError | null, isRecoverable?: boolean) => void
}

/**
 * Единственное клиентское состояние допуска в пределах JavaScript runtime, без persist middleware.
 */
export const authStore = createStore<AuthStore>((set, get) => ({
  authentication: { status: AUTH_STATUS.CHECKING, error: null },
  sessionId: null,
  cacheEpoch: 0,
  revision: 0,
  sessionExpiresAt: null,
  begin: (isChecking = true) => {
    const revision = get().revision + 1
    const authentication = !isChecking || get().authentication.status === AUTH_STATUS.AUTHENTICATED
      ? get().authentication
      : { status: AUTH_STATUS.CHECKING, error: null }
    set({ revision, authentication })
    return revision
  },
  accept: (sessionId, credentials) => set((state) => ({
    sessionId,
    cacheEpoch: state.cacheEpoch + Number(state.sessionId !== sessionId),
    sessionExpiresAt: credentials.sessionExpiresAt
  })),
  confirm: () => set({ authentication: { status: AUTH_STATUS.AUTHENTICATED, error: null } }),
  reset: (error, isRecoverable = false) => set((state) => ({
    authentication: { status: isRecoverable ? AUTH_STATUS.ERROR : AUTH_STATUS.GUEST, error },
    sessionId: isRecoverable ? state.sessionId : null,
    cacheEpoch: state.cacheEpoch + Number(state.sessionId !== null),
    revision: state.revision + 1,
    sessionExpiresAt: isRecoverable ? state.sessionExpiresAt : null
  }))
}))
