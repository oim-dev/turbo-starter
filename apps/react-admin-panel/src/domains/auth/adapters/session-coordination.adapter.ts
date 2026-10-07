import { createBrowserCoordination, readBrowserStorage, writeBrowserStorage } from 'infra/browser-storage'
import { hasOwn, isNonEmptyString, isOneOf, isRecord } from 'shared/value-predicates'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'
import type { AuthErrorCode } from '../errors/auth.error'

/** Изолированный ключ протокола общей административной cookie. */
const SESSION_RECORD_KEY = 'admin-auth-session-v1'

/** Фазы обмена, сохраняемые без credential и профиля. */
export const SESSION_PHASE = {
  READY: 'ready',
  EXCHANGING: 'exchanging',
  SIGNED_OUT: 'signed-out'
} as const

/** Нечувствительный маркер сессии для координации вкладок и обнаружения прерванного обмена. */
export type SessionRecord = {
  /** Случайное поколение входа; не является серверным идентификатором сессии. */
  readonly id: string
  /** Возможность следующего обмена cookie. */
  readonly phase: (typeof SESSION_PHASE)[keyof typeof SESSION_PHASE]
  /** Причина завершения, доступная другим вкладкам. */
  readonly reason: AuthErrorCode | null
}

/**
 * Открывает origin-scoped блокировку обменов и уведомления об изменении сессии.
 */
export const openSessionCoordination = (onChange: () => void): ReturnType<typeof createBrowserCoordination> => {
  try {
    return createBrowserCoordination(SESSION_RECORD_KEY, onChange)
  } catch {
    throw createAuthError(AUTH_ERROR_CODE.UNSUPPORTED_BROWSER)
  }
}

/**
 * Читает проверенный маркер; повреждённые данные требуют явного нового входа.
 */
export const readSessionRecord = (): SessionRecord | null => {
  let rawRecord: string | null
  try {
    rawRecord = readBrowserStorage(SESSION_RECORD_KEY)
  } catch {
    throw createAuthError(AUTH_ERROR_CODE.UNSUPPORTED_BROWSER)
  }

  if (rawRecord === null) {
    return null
  }

  let record: unknown
  try {
    record = JSON.parse(rawRecord)
  } catch {
    throw createAuthError(AUTH_ERROR_CODE.REFRESH_UNCERTAIN)
  }

  if (
    !isRecord(record) || !hasOwn(record, 'id') || !isNonEmptyString(record.id) ||
    !hasOwn(record, 'phase') || !isOneOf(record.phase, Object.values(SESSION_PHASE)) ||
    !hasOwn(record, 'reason') ||
    (record.reason !== null && !isOneOf(record.reason, Object.values(AUTH_ERROR_CODE)))
  ) {
    throw createAuthError(AUTH_ERROR_CODE.REFRESH_UNCERTAIN)
  }

  return { id: record.id, phase: record.phase, reason: record.reason }
}

/**
 * Фиксирует фазу до отправки изменяющего cookie запроса и после его завершения.
 */
export const writeSessionRecord = (record: SessionRecord): void => {
  try {
    writeBrowserStorage(SESSION_RECORD_KEY, JSON.stringify(record))
  } catch {
    throw createAuthError(AUTH_ERROR_CODE.UNSUPPORTED_BROWSER)
  }
}
