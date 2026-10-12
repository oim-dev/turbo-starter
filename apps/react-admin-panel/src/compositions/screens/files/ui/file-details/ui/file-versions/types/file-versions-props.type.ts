/**
 * Контракт истории документа.
 */
export type FileVersionsProps = {
  /**
   * UUID документа.
   */
  fileId: string
  /**
   * Номер версии, выдаваемой по постоянной ссылке.
   */
  currentVersion: number
  /**
   * Разрешено выбирать текущую версию документа.
   */
  canUpdate: boolean
}
