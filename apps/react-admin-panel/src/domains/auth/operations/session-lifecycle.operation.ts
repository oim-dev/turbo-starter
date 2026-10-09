import {
  getBackendAdminApiCredential,
  getBackendAdminApiCredentialSnapshot,
  setBackendAdminApiAccessToken
} from 'infra/backend-admin-api'
import type { BackendAdminApiCredential } from 'infra/backend-admin-api'
import { isBrowserStorageError } from 'infra/browser-storage'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { completeKeycloakSession } from '../adapters/complete-keycloak-session.adapter'
import { getCurrentUser } from '../adapters/get-current-user.adapter'
import { revokeSession } from '../adapters/revoke-session.adapter'
import { openSessionCoordination } from '../adapters/session-coordination.adapter'
import { startSession } from '../adapters/start-session.adapter'
import { AUTH_ERROR_CODE, createAuthError, isAuthError } from '../errors/auth.error'
import { authStore } from '../stores/auth.store'
import { AUTH_STATUS } from '../types/authentication.type'
import type { SessionCredentials } from '../types/session-credentials.type'
import type { SignInInput } from '../types/sign-in-input.type'
import { clearAuthentication } from './clear-authentication.operation'

let coordination: ReturnType<typeof openSessionCoordination> | null = null
let mountedProviders = 0
let restoration: Promise<void> | null = null
let activeAction: Promise<void> | null = null
let isRestorationEnabled = true
let keycloakCompletion: Promise<void> | null = null

/**
 * Не позволяет позднему ответу заменить более новое пользовательское намерение.
 */
const assertCurrentAttempt = (revision: number): void => {
  if (mountedProviders === 0 || authStore.getState().revision !== revision) {
    throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
  }
}

/**
 * Возвращает ресурс, принадлежащий подключённому AuthProvider.
 */
const requireCoordination = (): NonNullable<typeof coordination> => {
  if (coordination === null) {
    throw createAuthError(AUTH_ERROR_CODE.UNSUPPORTED_BROWSER)
  }

  return coordination
}

/**
 * Передаёт дефект фонового сценария общему безопасному каналу диагностики.
 */
export const reportAuthenticationFailure = (error: unknown): void => {
  if (!isAuthError(error) && !isBrowserStorageError(error)) {
    reportApplicationDefect(toApplicationDefect('auth.lifecycle', error))
  }
}

/**
 * Закрывает UI при ошибке проверки, но не удаляет credential при недоступности сети.
 */
const failAttempt = (revision: number, error: unknown): void => {
  if (authStore.getState().revision !== revision || mountedProviders === 0) {
    return
  }

  const authError = isBrowserStorageError(error)
    ? createAuthError(AUTH_ERROR_CODE.UNSUPPORTED_BROWSER)
    : isAuthError(error) ? error : createAuthError(AUTH_ERROR_CODE.UNAVAILABLE)
  if (authError.code === AUTH_ERROR_CODE.SUPERSEDED) {
    return
  }

  // Отзыв/expiry обрабатываются отдельно. Сбой проверки не доказывает недействительность JWT.
  authStore.getState().reset(authError, authError.code !== AUTH_ERROR_CODE.UNSUPPORTED_BROWSER)
}

/**
 * Подтверждает именно прочитанную запись активным профилем до открытия приватного UI.
 */
const acceptSession = async (credential: BackendAdminApiCredential, revision: number): Promise<void> => {
  assertCurrentAttempt(revision)
  authStore.getState().accept(credential.id, {
    accessToken: credential.accessToken,
    sessionExpiresAt: credential.expiresAt
  })
  const currentUser = await getCurrentUser()
  assertCurrentAttempt(revision)
  const currentCredential = getBackendAdminApiCredential()
  if (currentCredential === null) {
    authStore.getState().reset(createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED))
    throw createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED)
  }
  if (currentCredential.id !== credential.id) {
    authStore.getState().reset(null)
    throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
  }
  if (currentUser === null) {
    clearAuthentication(createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED))
    throw createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED)
  }

  authStore.getState().confirm()
}

/**
 * Проверяет сохранённый JWT через /me, не создавая новый token и не изменяя его TTL.
 */
const restoreUnderLock = async (isForced: boolean, queuedRevision: number): Promise<void> => {
  if (!isRestorationEnabled) {
    return
  }
  assertCurrentAttempt(queuedRevision)
  let revision = queuedRevision
  try {
    const credential = getBackendAdminApiCredential()
    const state = authStore.getState()
    if (credential === null) {
      if (state.authentication.status !== AUTH_STATUS.GUEST) {
        const error = state.sessionId === null ? null : createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED)
        authStore.getState().reset(error)
      }
      return
    }

    const isSameSession = credential.id === state.sessionId
    if (!isForced && isSameSession && state.authentication.status === AUTH_STATUS.AUTHENTICATED) {
      return
    }
    if (!isSameSession && state.sessionId !== null) {
      authStore.getState().reset(null)
    }

    revision = authStore.getState().begin()
    await acceptSession(credential, revision)
  } catch (error) {
    failAttempt(revision, error)
    throw error
  }
}

/**
 * Объединяет одновременные GET-проверки в пределах вкладки.
 */
const restoreAuthentication = (isForced: boolean): Promise<void> => {
  if (!isRestorationEnabled || activeAction !== null) {
    return Promise.resolve()
  }
  if (restoration !== null) {
    return restoration
  }

  const revision = authStore.getState().revision
  const pending = requireCoordination().runExclusive(() => restoreUnderLock(isForced, revision)).catch((error) => {
    failAttempt(revision, error)
    throw error
  })
  restoration = pending

  /**
   * Освобождает single-flight только завершившейся проверки.
   */
  const clearRestoration = (): void => {
    if (restoration === pending) {
      restoration = null
    }
  }
  void pending.then(clearRestoration, clearRestoration)
  return pending
}

/**
 * Закрывает старый UI сразу по уведомлению и затем проверяет credential под блокировкой.
 */
const handleCredentialChange = (): void => {
  if (!isRestorationEnabled) {
    return
  }
  try {
    const credential = getBackendAdminApiCredential()
    const state = authStore.getState()
    if (state.sessionId !== null && state.sessionId !== credential?.id) {
      authStore.getState().reset(credential === null ? createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED) : null)
    }
    const previousAttempt = activeAction ?? restoration ?? Promise.resolve()
    void previousAttempt.catch(reportAuthenticationFailure).then(() => {
      if (coordination !== null && mountedProviders > 0) {
        return restoreAuthentication(false)
      }
    }).catch(reportAuthenticationFailure)
  } catch (error) {
    failAttempt(authStore.getState().revision, error)
    reportAuthenticationFailure(error)
  }
}

/**
 * Отслеживает действие, чтобы фоновая проверка не вытеснила пользовательское намерение.
 */
const trackAction = (pending: Promise<void>): Promise<void> => {
  activeAction = pending
  /**
   * Снимает только закончившееся действие, сохраняя новое намерение пользователя.
   */
  const clearAction = (): void => {
    if (activeAction === pending) {
      activeAction = null
    }
  }
  void pending.then(clearAction, clearAction)
  return pending
}

/**
 * Сохраняет JWT только при неизменном общем поколении, включая logout из гостевой вкладки.
 * Обычные уведомления/restore не меняют поколение и не отменяют попытку сами по себе.
 */
const establishSession = (start: () => Promise<SessionCredentials>): Promise<void> => {
  const connection = requireCoordination()
  const sharedRevision = getBackendAdminApiCredentialSnapshot().revision
  const revision = authStore.getState().begin(false)
  return trackAction(connection.runExclusive(async () => {
    assertCurrentAttempt(revision)
    if (getBackendAdminApiCredentialSnapshot().revision !== sharedRevision) {
      throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
    }
    let hasStoredCredential = false
    try {
      const credentials = await start()
      try {
        assertCurrentAttempt(revision)
        if (getBackendAdminApiCredentialSnapshot().revision !== sharedRevision) {
          throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
        }
      } catch (error) {
        // Включая logout другой гостевой вкладки: поздний JWT не сохраняется и явно отзывается.
        await revokeSession(credentials.accessToken)
        throw error
      }
      const credential = setBackendAdminApiAccessToken(credentials.accessToken, credentials.sessionExpiresAt)
      hasStoredCredential = true
      connection.notify()
      await acceptSession(credential, revision)
    } catch (error) {
      if (hasStoredCredential) {
        failAttempt(revision, error)
      } else if (authStore.getState().revision === revision &&
        authStore.getState().authentication.status !== AUTH_STATUS.AUTHENTICATED) {
        const authError = isAuthError(error) ? error : createAuthError(AUTH_ERROR_CODE.UNAVAILABLE)
        authStore.getState().reset(authError)
      }
      throw error
    }
  }))
}

/**
 * Выполняет локальный вход без refresh cookie.
 */
export const signIn = (input: SignInInput): Promise<void> => establishSession(() => startSession(input))

/**
 * Однократно завершает Keycloak flow, включая StrictMode и remount приватного кеша.
 */
export const signInWithKeycloakCompletion = (): Promise<void> => {
  if (keycloakCompletion === null) {
    keycloakCompletion = Promise.resolve().then(() => establishSession(completeKeycloakSession))
  }
  return keycloakCompletion
}

/**
 * Захватывает Bearer до локальной очистки; поздний ответ logout не затрагивает новый вход.
 */
export const logout = async (): Promise<void> => {
  const previousAction = activeAction
  const state = authStore.getState()
  let accessToken: string | null = null
  try {
    const credential = getBackendAdminApiCredential()
    if (credential !== null && state.sessionId !== null && state.sessionId !== credential.id) {
      authStore.getState().reset(createAuthError(AUTH_ERROR_CODE.SUPERSEDED))
      throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
    }
    accessToken = credential?.accessToken ?? null
    clearAuthentication()
    coordination?.notify()
  } catch (error) {
    if (isAuthError(error)) {
      throw error
    }
    authStore.getState().reset(createAuthError(AUTH_ERROR_CODE.LOGOUT_INCOMPLETE))
    throw createAuthError(AUTH_ERROR_CODE.LOGOUT_INCOMPLETE)
  }

  const revision = authStore.getState().revision
  try {
    await trackAction((async () => {
      if (accessToken !== null) {
        await revokeSession(accessToken)
      }
      // Предыдущий login сам отзывает выданный после локального выхода credential.
      await previousAction?.catch((error: unknown) => {
        if (isAuthError(error) && error.code === AUTH_ERROR_CODE.LOGOUT_INCOMPLETE) {
          throw error
        }
        reportAuthenticationFailure(error)
      })
    })())
  } catch (error) {
    if (authStore.getState().revision === revision) {
      authStore.getState().reset(createAuthError(AUTH_ERROR_CODE.LOGOUT_INCOMPLETE))
    }
    throw error
  }
}

/**
 * Явно повторяет проверку сохранённого JWT после сетевой ошибки.
 */
export const retryBootstrap = (): Promise<void> => restoreAuthentication(true)

/**
 * Закрывает истёкшую сессию и синхронизирует изменения после сна вкладки, без продления TTL.
 */
export const checkAuthenticationExpiry = (): void => handleCredentialChange()

/**
 * Подключает lifecycle; unmount очищает runtime, но не сохранённый credential.
 */
export const connectAuthentication = (shouldRestoreSession = true): (() => void) => {
  mountedProviders += 1
  isRestorationEnabled = shouldRestoreSession
  if (coordination === null) {
    try {
      authStore.getState().begin()
      coordination = openSessionCoordination(handleCredentialChange)
    } catch (error) {
      authStore.getState().reset(createAuthError(AUTH_ERROR_CODE.UNSUPPORTED_BROWSER))
      reportAuthenticationFailure(error)
    }
  }
  if (shouldRestoreSession && coordination !== null) {
    handleCredentialChange()
  }

  return () => {
    mountedProviders -= 1
    queueMicrotask(() => {
      if (mountedProviders === 0) {
        coordination?.dispose()
        coordination = null
        authStore.getState().reset(null)
      }
    })
  }
}
