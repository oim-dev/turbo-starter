import { hasOwn, isNumber, isRecord, isString } from 'shared/value-predicates'

/**
 * Проверяет формат JWT и читает exp; подпись и отзыв проверяет только сервер.
 */
export const getJwtExpiresAt = (token: string): number | null => {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    return null
  }

  const [encodedHeader, encodedPayload] = token.split('.')
  try {
    const header: unknown = JSON.parse(atob(encodedHeader.replace(/-/g, '+').replace(/_/g, '/')))
    const payload: unknown = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')))
    if (
      !isRecord(header) || !hasOwn(header, 'alg') || !isString(header.alg) ||
      header.alg === '' || header.alg.toLowerCase() === 'none' ||
      !isRecord(payload) || !hasOwn(payload, 'exp') || !isNumber(payload.exp) ||
      !Number.isSafeInteger(payload.exp) || payload.exp <= 0
    ) {
      return null
    }

    const expiresAt = payload.exp * 1000
    return Number.isSafeInteger(expiresAt) ? expiresAt : null
  } catch {
    return null
  }
}
