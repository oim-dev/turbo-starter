/**
 * Контракт проверки актуального состояния формы перед навигацией.
 */
export type FormLeaveGuardParams = {
  /**
   * Проверяет актуальный ввод, включая сброс после успешной записи.
   */
  shouldBlock: () => boolean
}

/**
 * Свойства гарда без собственного корневого DOM-элемента.
 */
export type FormLeaveGuardProps = FormLeaveGuardParams
