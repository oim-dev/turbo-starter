import { createContext } from 'react'
import type { Dispatch } from 'react'

import type { AuthAction } from '../state/auth-state.reducer'
import type { AuthState } from '../types/auth-state.type'

/**
 * Внутренний runtime-контракт auth-домена для дочерних компонентов.
 */
export type AuthContextValue = Readonly<{
  /** Текущее состояние административной сессии. */
  state: AuthState
  /** Применяет доменное событие к состоянию сессии. */
  dispatch: Dispatch<AuthAction>
  /** Выполняется ли завершение текущей сессии. */
  isLoggingOut: boolean
  /** Завершилась ли последняя попытка выхода ошибкой. */
  hasLogoutError: boolean
  /** Завершает BFF- и Keycloak-сессию. */
  logout: () => Promise<void>
}>

/**
 * Контекст единственного auth lifecycle внутри route tree.
 */
export const AuthContext = createContext<AuthContextValue | null>(null)
