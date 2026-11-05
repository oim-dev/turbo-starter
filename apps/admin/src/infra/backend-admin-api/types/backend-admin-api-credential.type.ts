/**
 * Проверенная техническая запись credential без профиля и прав пользователя.
 */
export type BackendAdminApiCredential = {
  /**
   * Локальное поколение записи для защиты от поздних ответов.
   */
  readonly id: string
  /**
   * Основной Bearer JWT, доступный только техническому клиенту и auth lifecycle.
   */
  readonly accessToken: string
  /**
   * Неизменяемая верхняя граница срока в миллисекундах Unix.
   */
  readonly expiresAt: number
}

/**
 * Единый снимок credential и его общего поколения, включая запись без JWT.
 */
export type BackendAdminApiCredentialSnapshot = {
  /**
   * Поколение последней записи; null только до первой записи в этом API scope.
   */
  readonly revision: string | null
  /**
   * Действующий по локальному сроку credential либо отсутствие credential в tombstone.
   */
  readonly credential: BackendAdminApiCredential | null
}
