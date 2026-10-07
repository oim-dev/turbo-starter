/**
 * Запрещает повтор обмена одноразового токена после неопределённого результата.
 */
export class SessionRefreshError extends Error {
  constructor() {
    super('Session refresh requires a new login')
    this.name = 'SessionRefreshError'
  }
}
