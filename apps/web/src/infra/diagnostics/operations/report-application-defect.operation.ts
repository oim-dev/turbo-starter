import { ApplicationDefect } from 'shared/errors'

/**
 * Сообщает только идентификатор операции, исключая ответы API и credentials.
 */
export const reportApplicationDefect = (error: unknown): void => {
  const operation = error instanceof ApplicationDefect ? error.operation : 'web.unknown'
  console.error('Application defect', { operation })
}
