import { SESSION_SCOPE_KEY } from '../config/api-session.config'
import type { ApiCredential, ApiRefreshFlight, ApiSessionSnapshot } from '../types/api-session.type'

const SERVER_SNAPSHOT: ApiSessionSnapshot = { version: 0, isReady: false }
const listeners = new Set<() => void>()
let snapshot = SERVER_SNAPSHOT
let credential: ApiCredential | null = null
let scope: string | undefined
let bootstrapFailure: unknown
let refreshFlight: ApiRefreshFlight | undefined

/**
 * Возвращает разделяемый результат ротации текущей вкладки.
 */
export const getApiRefreshFlight = (): ApiRefreshFlight | undefined => refreshFlight

/**
 * Запоминает ротацию или очищает её после подтверждённого входа и выхода.
 */
export const setApiRefreshFlight = (nextFlight: ApiRefreshFlight | undefined): void => {
  refreshFlight = nextFlight
}

/**
 * Публикует изменение технического ресурса его подписчикам.
 */
const publishSnapshot = (isReady: boolean, shouldReplaceScope: boolean): void => {
  snapshot = { version: snapshot.version + Number(shouldReplaceScope), isReady }
  for (const listener of listeners) listener()
}

/**
 * Сверяет ревизию cookies перед запросом, не полагаясь на своевременную доставку storage event.
 */
export const syncApiSessionScope = (): string => {
  const nextScope = localStorage.getItem(SESSION_SCOPE_KEY) ?? ''
  if (scope !== undefined && scope !== nextScope) {
    credential = null
    bootstrapFailure = undefined
    scope = nextScope
    publishSnapshot(nextScope.startsWith('guest:'), true)
  }
  scope = nextScope
  return nextScope
}

/**
 * Применяет смену сессии из другой вкладки.
 */
const handleStorage = (event: StorageEvent): void => {
  if (event.key === SESSION_SCOPE_KEY || event.key === null) syncApiSessionScope()
}

/**
 * Подписывает владельца lifecycle на смену credentials без раскрытия самих токенов.
 */
export const subscribeApiSession = (listener: () => void): (() => void) => {
  listeners.add(listener)
  window.addEventListener('storage', handleStorage)
  syncApiSessionScope()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', handleStorage)
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
 * Устанавливает результат ротации, сохраняя логическую область сессии.
 */
export const setApiCredential = (nextCredential: ApiCredential): void => {
  credential = nextCredential
  bootstrapFailure = undefined
}

/**
 * Завершает browser bootstrap; ошибку затем интерпретирует вызывающий домен.
 */
export const finishApiBootstrap = (failure?: unknown): void => {
  bootstrapFailure = failure
  publishSnapshot(true, false)
}

/**
 * Передаёт неуспешный bootstrap доменному адаптеру без нового refresh-запроса.
 */
export const assertApiBootstrap = (): void => {
  if (bootstrapFailure !== undefined) throw bootstrapFailure
}

/**
 * Начинает новую область после подтверждённого входа или завершения сессии.
 */
export const replaceApiSession = (nextCredential: ApiCredential | null): void => {
  const nextScope = `${nextCredential ? 'active' : 'guest'}:${crypto.randomUUID()}`
  localStorage.setItem(SESSION_SCOPE_KEY, nextScope)
  scope = nextScope
  credential = nextCredential ? { ...nextCredential, scope: nextScope } : null
  bootstrapFailure = undefined
  publishSnapshot(true, true)
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
