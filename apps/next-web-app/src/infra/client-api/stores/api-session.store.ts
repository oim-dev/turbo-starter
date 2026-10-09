import { SESSION_STORAGE_KEY } from '../config/api-session.config'
import { readPersistedApiSession } from '../helpers/read-persisted-api-session'
import type { ApiCredential, ApiSessionSnapshot, PersistedApiSession } from '../types/api-session.type'

const SERVER_SNAPSHOT: ApiSessionSnapshot = { version: 0, isReady: false }
const listeners = new Set<() => void>()
let snapshot = SERVER_SNAPSHOT
let credential: ApiCredential | null = null
let scope: string | undefined
let bootstrapFailure: unknown
let storedSession: string | null | undefined
let storageFailure: unknown
let expiryTimer: number | undefined

/**
 * Публикует изменение технического ресурса его подписчикам.
 */
const publishSnapshot = (isReady: boolean, shouldReplaceScope: boolean): void => {
  snapshot = { version: snapshot.version + Number(shouldReplaceScope), isReady }
  for (const listener of listeners) listener()
}

/**
 * Закрывает доступ при недоступном storage, не восстанавливая старый credential из памяти.
 */
const failStorage = (error: unknown): never => {
  window.clearTimeout(expiryTimer)
  credential = null
  storageFailure = error
  bootstrapFailure = error
  publishSnapshot(true, true)
  throw error
}

/**
 * Проверяет срок и смену вкладки при возвращении фокуса или срабатывании таймера.
 */
const handleSessionWake = (): void => {
  try {
    syncApiSessionScope()
    scheduleExpiration()
  } catch (error) {
    // Ошибка storage уже опубликована; lifecycle получит её через getApiCredential.
    if (error !== storageFailure) throw error
  }
}

/**
 * Планирует только завершение доступа, без фонового продления JWT.
 */
const scheduleExpiration = (): void => {
  window.clearTimeout(expiryTimer)
  expiryTimer = undefined
  if (!credential || listeners.size === 0) return
  expiryTimer = window.setTimeout(handleSessionWake, Math.min(2_147_483_647, Math.max(0, credential.expiresAt - Date.now())))
}

/**
 * Сверяет атомарную запись перед запросом, не полагаясь на своевременный storage event.
 */
export const syncApiSessionScope = (): string => {
  if (typeof window === 'undefined') throw new TypeError('Browser API session cannot run during SSR')
  if (storageFailure !== undefined) throw storageFailure
  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(SESSION_STORAGE_KEY)
  } catch (error) {
    return failStorage(error)
  }
  if (serialized !== storedSession) {
    let persisted: PersistedApiSession | null = null
    try {
      if (serialized !== null) persisted = readPersistedApiSession(serialized)
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof SyntaxError ||
        error instanceof DOMException && error.name === 'InvalidCharacterError')) throw error
      replaceApiSession(null)
      return scope ?? ''
    }
    storedSession = serialized
    scope = persisted?.scope ?? ''
    credential = persisted?.credential ?? null
    bootstrapFailure = undefined
    if (credential && credential.expiresAt <= Date.now()) {
      replaceApiSession(null)
      return scope ?? ''
    }
    scheduleExpiration()
    publishSnapshot(credential === null, true)
  }
  if (credential && credential.expiresAt <= Date.now()) replaceApiSession(null)
  return scope ?? ''
}

/**
 * Применяет смену сессии из другой вкладки.
 */
const handleStorage = (event: StorageEvent): void => {
  if (event.storageArea === window.localStorage && (event.key === SESSION_STORAGE_KEY || event.key === null)) {
    handleSessionWake()
  }
}

/**
 * Подписывает владельца lifecycle на смену credentials без раскрытия самих токенов.
 */
export const subscribeApiSession = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') throw new TypeError('Browser API session cannot run during SSR')
  listeners.add(listener)
  window.addEventListener('storage', handleStorage)
  window.addEventListener('focus', handleSessionWake)
  document.addEventListener('visibilitychange', handleSessionWake)
  handleSessionWake()
  scheduleExpiration()
  return () => {
    listeners.delete(listener)
    if (listeners.size !== 0) return
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('focus', handleSessionWake)
    document.removeEventListener('visibilitychange', handleSessionWake)
    window.clearTimeout(expiryTimer)
    expiryTimer = undefined
  }
}

/**
 * Возвращает стабильный снимок технической готовности браузерной сессии.
 */
export const getApiSessionSnapshot = (): ApiSessionSnapshot => snapshot

/**
 * Сохраняет одинаковое неизвестное состояние для SSR и первой гидратации.
 */
export const getServerSessionSnapshot = (): ApiSessionSnapshot => SERVER_SNAPSHOT

/**
 * Читает только актуальный credential текущей вкладки.
 */
export const peekApiCredential = (): ApiCredential | null => {
  syncApiSessionScope()
  return credential
}

/**
 * Начинает проверку профиля без изменения сохранённого срока и ревизии.
 */
export const beginApiBootstrap = (): void => {
  bootstrapFailure = undefined
  publishSnapshot(false, false)
}

/**
 * Завершает browser bootstrap; ошибку затем интерпретирует вызывающий домен.
 */
export const finishApiBootstrap = (failure?: unknown): void => {
  bootstrapFailure = failure
  publishSnapshot(true, false)
}

/**
 * Не выдаёт непроверенный credential за готовый, передаёт исходную ошибку владельцу lifecycle.
 */
export const assertApiBootstrap = (): void => {
  if (bootstrapFailure !== undefined) throw bootstrapFailure
  if (!snapshot.isReady) throw new TypeError('API session must be verified before private requests')
}

/**
 * Атомарно сохраняет новую область. Вход требует проверки профиля, выход закрывает доступ немедленно.
 */
export const replaceApiSession = (nextCredential: ApiCredential | null): ApiCredential | null => {
  if (typeof window === 'undefined') throw new TypeError('Browser API session cannot run during SSR')
  const nextScope = `${nextCredential ? 'active' : 'guest'}:${crypto.randomUUID()}`
  const nextSession: PersistedApiSession = {
    version: 1,
    scope: nextScope,
    credential: nextCredential ? { ...nextCredential, scope: nextScope } : null
  }
  const serialized = JSON.stringify(nextSession)
  // Даже при ошибке записи старый приватный UI больше не может использовать credential.
  credential = null
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, serialized)
  } catch (error) {
    failStorage(error)
  }
  storedSession = serialized
  scope = nextScope
  credential = nextSession.credential
  bootstrapFailure = undefined
  storageFailure = undefined
  scheduleExpiration()
  publishSnapshot(credential === null, true)
  return nextSession.credential
}

/**
 * По решению домена удаляет только credential отклонённого запроса, сохраняя более новый вход.
 */
export const rejectApiCredential = (expectedToken: string | null, expectedVersion: number): boolean => {
  if ((peekApiCredential()?.accessToken ?? null) !== expectedToken) return false
  if (snapshot.version !== expectedVersion) return false
  replaceApiSession(null)
  return true
}
