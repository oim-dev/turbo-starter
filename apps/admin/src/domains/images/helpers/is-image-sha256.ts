import { isString } from 'shared/value-predicates'

/**
 * Проверяет канонический SHA-256 оригинала, полученный от сервера.
 */
export const isImageSha256 = (hash: unknown): hash is string => {
  return isString(hash) && /^[a-f0-9]{64}$/.test(hash)
}
