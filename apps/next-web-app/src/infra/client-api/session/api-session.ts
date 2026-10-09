import type { LoginDto } from '@oim/client-rest-api-sdk/data-contracts'
import { clientApi, httpClient } from '../browser-api'
import { SessionChangedError } from '../errors/session-changed-error'
import { getReadyApiCredential } from '../helpers/get-ready-api-credential'
import { isCurrentSession } from '../helpers/is-current-session'
import { readApiCredential } from '../helpers/read-api-credential'
import { revokeApiSession } from '../helpers/revoke-api-session'
import { verifyApiSession } from '../helpers/verify-api-session'
import { peekApiCredential, replaceApiSession, syncApiSessionScope } from '../stores/api-session.store'
import type { ApiCredential } from '../types/api-session.type'

/**
 * В browser lifecycle читает сохранённый срок и проверяет профиль без продления сессии.
 * Ошибка проверки запрещает приватные запросы до явного повтора проверки или нового входа.
 */
export const restoreApiSession = async (expectedCredential: ApiCredential | null = null): Promise<ApiCredential | null> => {
  const current = peekApiCredential()
  if (expectedCredential && !isCurrentSession(expectedCredential)) throw new SessionChangedError()
  if (!current) return null
  return verifyApiSession(httpClient, current)
}

/**
 * Предоставляет потребителю готовый credential настроенного браузерного клиента.
 */
export const getApiCredential = async (): Promise<ApiCredential | null> => getReadyApiCredential()

/**
 * Сохраняет JWT и фиксированный срок, затем проверяет профиль в новой области данных.
 * Поздний login не отменяет logout или смену аккаунта: выданный ему JWT отзывается отдельно.
 */
export const loginApiSession = async (input: LoginDto): Promise<void> => {
  const scope = syncApiSessionScope()
  const response = await clientApi.auth.login(input)
  try {
    if (syncApiSessionScope() !== scope) throw new SessionChangedError()
    const nextCredential = readApiCredential(response, scope)
    const installedCredential = replaceApiSession(nextCredential)
    await restoreApiSession(installedCredential)
    if (!installedCredential || !isCurrentSession(installedCredential)) throw new SessionChangedError()
  } catch (error) {
    if (error instanceof SessionChangedError) await revokeApiSession(httpClient, response.accessToken)
    throw error
  }
}

/**
 * Сначала закрывает локальную область, затем отзывает захваченный Bearer на backend.
 * Сетевой сбой сообщается вызывающему коду, но никогда не восстанавливает локальную сессию.
 */
export const logoutApiSession = async (): Promise<void> => {
  const current = peekApiCredential()
  replaceApiSession(null)
  if (!current) return
  await revokeApiSession(httpClient, current.accessToken)
}
