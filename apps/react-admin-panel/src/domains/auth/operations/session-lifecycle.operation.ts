import { getBackendAdminApiAccessToken, setBackendAdminApiAccessToken } from 'infra/backend-admin-api'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { getCurrentUser } from '../adapters/get-current-user.adapter'
import { revokeSession } from '../adapters/revoke-session.adapter'
import { rotateSession } from '../adapters/rotate-session.adapter'
import {
  openSessionCoordination,
  readSessionRecord,
  SESSION_PHASE,
  writeSessionRecord
} from '../adapters/session-coordination.adapter'
import type { SessionRecord } from '../adapters/session-coordination.adapter'
import { startSession } from '../adapters/start-session.adapter'
import { AUTH_ERROR_CODE, createAuthError, isAuthError } from '../errors/auth.error'
import { authStore } from '../stores/auth.store'
import { AUTH_STATUS } from '../types/authentication.type'
import type { SessionCredentials } from '../types/session-credentials.type'
import type { SignInInput } from '../types/sign-in-input.type'
import { clearAuthentication } from './clear-authentication.operation'

let coordination: ReturnType<typeof openSessionCoordination> | null = null
let mountedProviders = 0
let observedSessionId: string | null = null
let restoration: Promise<void> | null = null
let activeAction: Promise<void> | null = null

/**
 * Не позволяет позднему ответу заменить более новое пользовательское намерение.
 */
const assertCurrentAttempt = (revision: number): void => {
  if (mountedProviders === 0 || authStore.getState().revision !== revision) {
    throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
  }
}

/**
 * Возвращает активную координацию, принадлежащую подключённому AuthProvider.
 */
const requireCoordination = (): NonNullable<typeof coordination> => {
  if (coordination === null) {
    throw createAuthError(AUTH_ERROR_CODE.UNSUPPORTED_BROWSER)
  }

  return coordination
}

/**
 * Публикует только маркер изменения; вкладки перечитывают его под блокировкой.
 */
const publishRecord = (record: SessionRecord): void => {
  writeSessionRecord(record)
  observedSessionId = record.id
  coordination?.notify()
}

/**
 * Передаёт дефект фонового сценария общему безопасному каналу диагностики.
 */
export const reportAuthenticationFailure = (error: unknown): void => {
  if (!isAuthError(error)) {
    reportApplicationDefect(toApplicationDefect('auth.lifecycle', error))
  }
}

/**
 * Закрывает доступ при неуспехе актуальной попытки, сохраняя возможность безопасного повтора.
 */
const failAttempt = (revision: number, error: unknown): void => {
  if (authStore.getState().revision !== revision || mountedProviders === 0) {
    return
  }

  const authError = isAuthError(error) ? error : createAuthError(AUTH_ERROR_CODE.REFRESH_UNCERTAIN)
  const isRecoverable = authError.code === AUTH_ERROR_CODE.RATE_LIMITED ||
    authError.code === AUTH_ERROR_CODE.REQUEST_REJECTED || authError.code === AUTH_ERROR_CODE.UNAVAILABLE

  clearAuthentication(authError, isRecoverable)
}

/**
 * Подтверждает выданный credential активным профилем до открытия приватного интерфейса.
 */
const acceptSession = async (id: string, credentials: SessionCredentials, revision: number): Promise<void> => {
  assertCurrentAttempt(revision)
  setBackendAdminApiAccessToken(credentials.accessToken)
  const currentUser = await getCurrentUser()
  assertCurrentAttempt(revision)

  if (currentUser === null) {
    throw createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED)
  }

  authStore.getState().accept(id, credentials)
  authStore.getState().confirm()
}

/**
 * Отмечает обмен до HTTP-вызова: закрытие вкладки или потеря ответа запрещают повтор той же cookie.
 */
const restoreUnderLock = async (isForced: boolean, queuedRevision: number): Promise<void> => {
  assertCurrentAttempt(queuedRevision)
  let revision = queuedRevision

  try {
    const record = readSessionRecord()
    const state = authStore.getState()
    const isSameSession = record !== null && state.sessionId === record.id

    if (record !== null && record.phase !== SESSION_PHASE.READY) {
      const reason = record.phase === SESSION_PHASE.EXCHANGING ? AUTH_ERROR_CODE.REFRESH_UNCERTAIN : record.reason
      observedSessionId = record.id
      if (state.authentication.status !== AUTH_STATUS.GUEST || (state.authentication.error?.code ?? null) !== reason) {
        clearAuthentication(reason === null ? null : createAuthError(reason))
      }
      return
    }

    if (
      isSameSession && getBackendAdminApiAccessToken() !== null &&
      state.refreshAt !== null && state.refreshAt > Date.now()
    ) {
      return
    }

    if (
      !isForced && record?.id === observedSessionId &&
      (state.authentication.status === AUTH_STATUS.GUEST || state.authentication.status === AUTH_STATUS.ERROR)
    ) {
      return
    }

    if (isSameSession && state.sessionExpiresAt !== null && state.sessionExpiresAt <= Date.now()) {
      publishRecord({ id: record.id, phase: SESSION_PHASE.SIGNED_OUT, reason: AUTH_ERROR_CODE.SESSION_EXPIRED })
      clearAuthentication(createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED))
      return
    }

    if (state.sessionId !== null && !isSameSession) {
      clearAuthentication()
    }

    revision = authStore.getState().begin()
    const id = record?.id ?? crypto.randomUUID()
    publishRecord({ id, phase: SESSION_PHASE.EXCHANGING, reason: null })

    let credentials: SessionCredentials
    try {
      credentials = await rotateSession()
    } catch (error) {
      if (isAuthError(error) && error.code === AUTH_ERROR_CODE.SESSION_EXPIRED) {
        publishRecord({ id, phase: SESSION_PHASE.SIGNED_OUT, reason: record === null ? null : error.code })
        if (record === null) {
          clearAuthentication()
          return
        }
      } else if (
        isAuthError(error) &&
        (error.code === AUTH_ERROR_CODE.RATE_LIMITED || error.code === AUTH_ERROR_CODE.REQUEST_REJECTED)
      ) {
        publishRecord({ id, phase: SESSION_PHASE.READY, reason: null })
      }
      throw error
    }

    publishRecord({ id, phase: SESSION_PHASE.READY, reason: null })
    await acceptSession(id, credentials, revision)
  } catch (error) {
    failAttempt(revision, error)
    throw error
  }
}

/**
 * Объединяет одновременные запросы восстановления в одной вкладке.
 */
const restoreAuthentication = (isForced: boolean): Promise<void> => {
  if (activeAction !== null) {
    return Promise.reject(createAuthError(AUTH_ERROR_CODE.SUPERSEDED))
  }
  if (restoration !== null) {
    return restoration
  }

  const queuedRevision = authStore.getState().revision
  const pending = requireCoordination().runExclusive(() => restoreUnderLock(isForced, queuedRevision)).catch((error) => {
    failAttempt(queuedRevision, error)
    throw error
  })
  restoration = pending

  /**
   * Освобождает single-flight, оставляя обработку исходного отказа вызывающему коду.
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
 * Отслеживает пользовательское действие, чтобы уведомления не вытесняли его проверкой сессии.
 */
const trackAction = (pending: Promise<void>): Promise<void> => {
  activeAction = pending

  /**
   * Снимает только завершившееся действие, сохраняя более новое намерение пользователя.
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
 * Выполняет новый вход и подтверждает его до открытия защищённой ветки.
 */
export const signIn = async (input: SignInInput): Promise<void> => {
  const connection = requireCoordination()
  if (authStore.getState().sessionId !== null) {
    clearAuthentication()
  }
  const revision = authStore.getState().begin(false)

  return trackAction(connection.runExclusive(async () => {
    assertCurrentAttempt(revision)
    const id = crypto.randomUUID()

    try {
      publishRecord({ id, phase: SESSION_PHASE.EXCHANGING, reason: null })
      const credentials = await startSession(input)
      publishRecord({ id, phase: SESSION_PHASE.READY, reason: null })
      await acceptSession(id, credentials, revision)
    } catch (error) {
      if (authStore.getState().revision === revision) {
        clearAuthentication(isAuthError(error) ? error : createAuthError(AUTH_ERROR_CODE.REFRESH_UNCERTAIN))
      }
      if (isAuthError(error) && error.code !== AUTH_ERROR_CODE.SUPERSEDED) {
        publishRecord({ id, phase: SESSION_PHASE.SIGNED_OUT, reason: error.code })
      }
      throw error
    }
  }))
}

/**
 * Закрывает локальный доступ немедленно и сериализованно отзывает серверную сессию.
 */
export const logout = async (): Promise<void> => {
  const expectedSessionId = observedSessionId
  clearAuthentication()
  const revision = authStore.getState().revision

  try {
    await trackAction(requireCoordination().runExclusive(async () => {
      assertCurrentAttempt(revision)
      const record = readSessionRecord()
      if (expectedSessionId !== null && record !== null && record.id !== expectedSessionId) {
        observedSessionId = record.id
        clearAuthentication(createAuthError(AUTH_ERROR_CODE.SUPERSEDED))
        throw createAuthError(AUTH_ERROR_CODE.SUPERSEDED)
      }

      const id = record?.id ?? crypto.randomUUID()
      publishRecord({ id, phase: SESSION_PHASE.SIGNED_OUT, reason: AUTH_ERROR_CODE.LOGOUT_INCOMPLETE })
      await revokeSession()
      publishRecord({ id, phase: SESSION_PHASE.SIGNED_OUT, reason: null })
    }))
  } catch (error) {
    if (isAuthError(error) && error.code === AUTH_ERROR_CODE.SUPERSEDED) {
      throw error
    }
    if (authStore.getState().revision === revision) {
      clearAuthentication(createAuthError(AUTH_ERROR_CODE.LOGOUT_INCOMPLETE))
    }
    if (isAuthError(error)) {
      throw createAuthError(AUTH_ERROR_CODE.LOGOUT_INCOMPLETE)
    }
    throw error
  }
}

/**
 * Явно повторяет восстановление только при разрешающем его состоянии общей cookie.
 */
export const retryBootstrap = async (): Promise<void> => restoreAuthentication(true)

/**
 * Подключает глобальный lifecycle; отложенная очистка сохраняет single-flight при React StrictMode.
 */
export const connectAuthentication = (): (() => void) => {
  mountedProviders += 1

  if (coordination === null) {
    try {
      authStore.getState().begin()
      coordination = openSessionCoordination(() => {
        void restoreAuthentication(false).catch(reportAuthenticationFailure)
      })
      const previousAttempt = activeAction ?? restoration ?? Promise.resolve()
      void previousAttempt.catch(reportAuthenticationFailure).then(() => {
        if (coordination !== null) {
          return restoreAuthentication(false)
        }
      }).catch(reportAuthenticationFailure)
    } catch (error) {
      clearAuthentication(isAuthError(error) ? error : createAuthError(AUTH_ERROR_CODE.UNSUPPORTED_BROWSER))
      reportAuthenticationFailure(error)
    }
  }

  return () => {
    mountedProviders -= 1
    queueMicrotask(() => {
      if (mountedProviders === 0) {
        coordination?.dispose()
        coordination = null
        clearAuthentication()
      }
    })
  }
}
