/**
 * Требует нового входа, когда действующего credential больше нет.
 */
export class SessionRequiredError extends Error {
  constructor() {
    super('API session requires a new login')
    this.name = 'SessionRequiredError'
  }
}
