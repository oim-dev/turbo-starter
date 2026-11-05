/**
 * Файлы одного нативного drop без рекурсивного чтения каталогов.
 */
export type NativeFileDrop = {
  /**
   * Обычные файлы из DataTransfer.
   */
  files: readonly File[]
  /**
   * Число пропущенных каталогов.
   */
  directoryCount: number
}

/**
 * Подписка одного активного владельца на drop в текущем документе.
 */
export type NativeFileDropOptions = {
  /**
   * Только один потребитель документа включён одновременно.
   */
  isEnabled: boolean
  /**
   * Разрешено ли действие; запрещённый drop всё равно доставляется для feedback.
   */
  canDrop: boolean
  /**
   * Получение файлов после предотвращения навигации браузера.
   */
  onDrop: (batch: NativeFileDrop) => void
}
