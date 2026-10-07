/**
 * Сообщает, что credential обновлён, но изменяющий запрос автоматически не повторялся.
 */
export class SessionRetryRequiredError extends Error {
  constructor() {
    super('The session was refreshed; retry the action explicitly')
    this.name = 'SessionRetryRequiredError'
  }
}
