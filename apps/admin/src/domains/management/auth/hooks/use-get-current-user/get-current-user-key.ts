/** Приватный ключ профиля, изолированный от предыдущих входов и поздних ответов. */
export type GetCurrentUserKey = readonly ['private', string, 'auth/current-user', number]

/**
 * Отключает чтение профиля до выдачи credential и открытия нового cache scope.
 */
export const getCurrentUserKey = (sessionId: string | null, cacheEpoch: number): GetCurrentUserKey | null => {
  return sessionId === null ? null : ['private', sessionId, 'auth/current-user', cacheEpoch]
}
