import type { AuthError } from '../errors/auth.error'

/** Состояния допуска к административной панели. */
export const AUTH_STATUS = {
  CHECKING: 'checking',
  AUTHENTICATED: 'authenticated',
  GUEST: 'guest',
  ERROR: 'error'
} as const

/** Текущее решение домена о доступе к приватному интерфейсу. */
export type Authentication = {
  /** Результат проверки или текущее состояние ожидания. */
  readonly status: (typeof AUTH_STATUS)[keyof typeof AUTH_STATUS]
  /** Безопасная причина отказа, восстановления или выхода. */
  readonly error: AuthError | null
}
