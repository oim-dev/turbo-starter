import type { Dispatch } from 'react'

import {
  clearAdminRestApiCsrfToken,
  onAdminRestApiUnauthorized
} from 'infra/admin-rest-api'
import type { AuthAction } from '../state/auth-state.reducer'
import { logoutAuthSession, resolveAuthSession } from './auth.service'

/**
 * Результат завершения сессии в lifecycle auth-домена.
 */
export type AuthLogoutResult =
  | Readonly<{ status: 'succeeded'; redirectUrl: string }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'aborted' }>

/**
 * Запускает разрешение BFF-сессии и возвращает полный lifecycle cleanup.
 */
export const startAuthSessionLifecycle = (dispatch: Dispatch<AuthAction>): (() => void) => {
  const requestController = new AbortController()
  const unsubscribe = onAdminRestApiUnauthorized(() => {
    requestController.abort()
    dispatch({ type: 'invalidated' })
  })

  dispatch({ type: 'resolve-started' })
  void resolveAuthSession(requestController.signal)
    .then((session) => {
      if (!requestController.signal.aborted) {
        dispatch({ session, type: 'resolve-succeeded' })
      }
    })
    .catch(() => {
      if (!requestController.signal.aborted) {
        dispatch({ type: 'resolve-failed' })
      }
    })

  return () => {
    requestController.abort()
    unsubscribe()
    clearAdminRestApiCsrfToken()
  }
}

/**
 * Завершает сессию с fail-closed политикой для неопределённого transport-результата.
 */
export const logoutAuthSessionLifecycle = async (
  dispatch: Dispatch<AuthAction>,
  signal: AbortSignal
): Promise<AuthLogoutResult> => {
  try {
    const redirectUrl = await logoutAuthSession(signal)

    if (signal.aborted) {
      return { status: 'aborted' }
    }

    dispatch({ type: 'invalidated' })
    return { redirectUrl, status: 'succeeded' }
  } catch {
    if (signal.aborted) {
      return { status: 'aborted' }
    }

    clearAdminRestApiCsrfToken()
    dispatch({ type: 'invalidated' })
    return { status: 'failed' }
  }
}
