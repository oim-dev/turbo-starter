/** Внутренний результат обмена cookie; не публикуется потребителям домена. */
export type SessionCredentials = {
  /** Непрозрачный токен, предназначенный только для памяти API-клиента. */
  readonly accessToken: string
  /** Момент очередного обновления, в миллисекундах Unix. */
  readonly refreshAt: number
  /** Абсолютная граница жизни сессии, в миллисекундах Unix. */
  readonly sessionExpiresAt: number
}
