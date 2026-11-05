/**
 * Отбрасывает запрос или ответ, относящийся к уже заменённой сессии.
 */
export class SessionChangedError extends Error {
  constructor() {
    super('API session changed during the operation')
    this.name = 'SessionChangedError'
  }
}
