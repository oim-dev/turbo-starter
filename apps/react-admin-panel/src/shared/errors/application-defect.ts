/** Неожиданный сбой, передаваемый общей границе приложения. */
export class ApplicationDefect extends Error {
  readonly name = 'ApplicationDefect'

  constructor(
    readonly operation: string,
    readonly cause: unknown
  ) {
    super(`Unexpected defect in ${operation}`)
  }
}

/** Нормализует неизвестный сбой без повторного оборачивания. */
export const toApplicationDefect = (
  operation: string,
  cause: unknown
): ApplicationDefect => {
  if (cause instanceof ApplicationDefect) {
    return cause
  }

  return new ApplicationDefect(operation, cause)
}

/** Публикует только безопасные метаданные неожиданного сбоя. */
export const reportApplicationDefect = (defect: ApplicationDefect): void => {
  console.error({
    type: 'application-defect',
    operation: defect.operation
  })
}
