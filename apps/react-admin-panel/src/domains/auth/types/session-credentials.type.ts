/**
 * Внутренний результат входа; не публикуется потребителям домена.
 */
export type SessionCredentials = {
  /**
   * Основной JWT, persistence которого принадлежит API-клиенту.
   */
  readonly accessToken: string
  /**
   * Абсолютная граница жизни сессии, в миллисекундах Unix.
   */
  readonly sessionExpiresAt: number
}
