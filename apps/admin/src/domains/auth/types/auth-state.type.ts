import type { AuthSession } from './auth-session.type'

/**
 * Состояние административной BFF-сессии.
 */
export type AuthState =
  | Readonly<{ status: 'unresolved' }>
  | Readonly<{ status: 'resolving' }>
  | Readonly<{ status: 'anonymous' }>
  | Readonly<{ status: 'authenticated'; session: AuthSession }>
  | Readonly<{ status: 'error' }>
