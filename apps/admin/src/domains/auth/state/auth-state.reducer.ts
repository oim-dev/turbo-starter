import type { AuthSession } from '../types/auth-session.type'
import type { AuthState } from '../types/auth-state.type'

/**
 * Начальное состояние административной сессии до обращения к BFF.
 */
export const INITIAL_AUTH_STATE: AuthState = { status: 'unresolved' }

/**
 * События жизненного цикла административной сессии.
 */
export type AuthAction =
  | Readonly<{ type: 'resolve-started' }>
  | Readonly<{ type: 'resolve-succeeded'; session: AuthSession | null }>
  | Readonly<{ type: 'resolve-failed' }>
  | Readonly<{ type: 'invalidated' }>

/**
 * Применяет результат доменного сценария авторизации к состоянию сессии.
 */
export const authStateReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'resolve-started':
      return { status: 'resolving' }
    case 'resolve-succeeded':
      return action.session === null
        ? { status: 'anonymous' }
        : { session: action.session, status: 'authenticated' }
    case 'resolve-failed':
      return { status: 'error' }
    case 'invalidated':
      return { status: 'anonymous' }
  }

  return state
}
