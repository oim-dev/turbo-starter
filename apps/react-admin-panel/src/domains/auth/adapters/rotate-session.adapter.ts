import { backendAdminApi } from 'infra/backend-admin-api'
import { mapSessionCredentials } from '../mappers/session-credentials.mapper'
import { classifySessionError } from '../source-errors/classify-session-error'
import type { SessionCredentials } from '../types/session-credentials.type'

/**
 * Однократно обменивает HttpOnly cookie на новый credential без повторов запроса.
 */
export const rotateSession = async (): Promise<SessionCredentials> => {
  const requestedAt = Date.now()
  const payload = await backendAdminApi.auth.adminBrowserRefresh().catch((error: unknown) => {
    throw classifySessionError(error, true)
  })

  return mapSessionCredentials(payload, requestedAt)
}
