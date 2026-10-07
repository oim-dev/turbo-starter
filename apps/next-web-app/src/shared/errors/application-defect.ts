/**
 * Сохраняет неизвестный сбой для диагностики без публикации причины в UI.
 */
export class ApplicationDefect extends Error {
  constructor(readonly operation: string, readonly cause: unknown) {
    super(`Unexpected defect in ${operation}`)
    this.name = 'ApplicationDefect'
  }
}

/**
 * Нормализует неизвестный сбой ровно один раз.
 */
export const toApplicationDefect = (operation: string, cause: unknown): ApplicationDefect => {
  return cause instanceof ApplicationDefect ? cause : new ApplicationDefect(operation, cause)
}
