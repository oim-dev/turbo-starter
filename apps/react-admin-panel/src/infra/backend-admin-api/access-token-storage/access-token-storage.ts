import {
  createBrowserCoordination,
  readBrowserStorage,
  writeBrowserStorage
} from 'infra/browser-storage'
import { hasOwn, isNonEmptyString, isNumber, isRecord } from 'shared/value-predicates'
import { BACKEND_ADMIN_API_BASE_URL } from '../config/backend-admin-api.config'
import { getJwtExpiresAt } from '../helpers/get-jwt-expires-at'
import type {
  BackendAdminApiCredential,
  BackendAdminApiCredentialSnapshot
} from '../types/backend-admin-api-credential.type'

/**
 * Версия схемы входит и в ключ, и в запись; старые auth-cookie маркеры не мигрируются.
 */
const CREDENTIAL_VERSION = 1

/**
 * Объединяет persistence и уведомления в одном scope нормализованного публичного API URL.
 */
const getCredentialKey = (): string => {
  const baseUrl = new URL(BACKEND_ADMIN_API_BASE_URL, window.location.origin).href.replace(/\/+$/, '')
  return `admin-api-credential:v${CREDENTIAL_VERSION}:${encodeURIComponent(baseUrl)}`
}

/**
 * Заменяет credential одной записью без JWT с новым поколением, даже если JWT уже отсутствовал.
 * Tombstone не удаляется при чтении: его поколение отменяет незавершённые попытки других вкладок.
 */
export const clearBackendAdminApiAccessToken = (): BackendAdminApiCredentialSnapshot => {
  const revision = crypto.randomUUID()
  writeBrowserStorage(getCredentialKey(), JSON.stringify({
    version: CREDENTIAL_VERSION,
    id: revision,
    accessToken: null,
    expiresAt: null
  }))
  return { revision, credential: null }
}

/**
 * Читает совместимый v1 credential или tombstone одним снимком, не меняя его поколение.
 * Повреждённый/истёкший JWT заменяется tombstone; storage failure не маскируется отсутствием JWT.
 */
export const getBackendAdminApiCredentialSnapshot = (): BackendAdminApiCredentialSnapshot => {
  const key = getCredentialKey()
  const rawCredential = readBrowserStorage(key)
  if (rawCredential === null) {
    return { revision: null, credential: null }
  }

  let credential: unknown
  try {
    credential = JSON.parse(rawCredential)
  } catch {
    return clearBackendAdminApiAccessToken()
  }

  if (
    !isRecord(credential) || !hasOwn(credential, 'version') || credential.version !== CREDENTIAL_VERSION ||
    !hasOwn(credential, 'id') || !isNonEmptyString(credential.id) ||
    !hasOwn(credential, 'accessToken') || !hasOwn(credential, 'expiresAt')
  ) {
    return clearBackendAdminApiAccessToken()
  }

  if (credential.accessToken === null && credential.expiresAt === null) {
    return { revision: credential.id, credential: null }
  }
  if (
    !isNonEmptyString(credential.accessToken) || !isNumber(credential.expiresAt) ||
    !Number.isSafeInteger(credential.expiresAt)
  ) {
    return clearBackendAdminApiAccessToken()
  }

  const jwtExpiresAt = getJwtExpiresAt(credential.accessToken)
  if (jwtExpiresAt === null || credential.expiresAt > jwtExpiresAt || credential.expiresAt <= Date.now()) {
    return clearBackendAdminApiAccessToken()
  }

  return {
    revision: credential.id,
    credential: { id: credential.id, accessToken: credential.accessToken, expiresAt: credential.expiresAt }
  }
}

/**
 * Возвращает только credential; tombstone не является авторизацией и не попадает в Bearer.
 */
export const getBackendAdminApiCredential = (): BackendAdminApiCredential | null => {
  return getBackendAdminApiCredentialSnapshot().credential
}

/**
 * Читает актуальный persisted JWT перед защищённым вызовом, не продлевая его срок.
 */
export const getBackendAdminApiAccessToken = (): string | null => {
  return getBackendAdminApiCredential()?.accessToken ?? null
}

/**
 * Фиксирует credential нового входа с верхней границей из JWT и ответа сервера.
 */
export const setBackendAdminApiAccessToken = (
  accessToken: string,
  sessionExpiresAt: number
): BackendAdminApiCredential => {
  const jwtExpiresAt = getJwtExpiresAt(accessToken)
  const expiresAt = Math.min(jwtExpiresAt ?? 0, sessionExpiresAt)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    throw new TypeError('Invalid or expired API credential')
  }

  const credential = { id: crypto.randomUUID(), accessToken, expiresAt }
  writeBrowserStorage(getCredentialKey(), JSON.stringify({ version: CREDENTIAL_VERSION, ...credential }))
  return credential
}

/**
 * Создаёт value-free уведомления и Web Lock в том же scope, что и credential.
 */
export const openBackendAdminApiCredentialCoordination = (
  onChange: () => void
): ReturnType<typeof createBrowserCoordination> => {
  return createBrowserCoordination(getCredentialKey(), onChange)
}
