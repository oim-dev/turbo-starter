/**
 * Параметры компонента AccountPasswordDialog.
 */
export type AccountPasswordDialogParams = {
  /**
   * Идентификатор выбранного пользователя.
   */
  accountId: string
  /**
   * Версия аккаунта, показанная перед изменением пароля.
   */
  version: number
  /**
   * Имя получателя нового пароля.
   */
  displayName: string
  /**
   * Закрывает диалог и удаляет пароль из локальной формы.
   */
  onClose: () => void
  /**
   * Обрабатывает подтверждённое изменение и собственную отозванную сессию.
   */
  onSaved: () => Promise<void>
}

/**
 * Значения новой пары credentials, существующий пароль не читается.
 */
export type AccountPasswordValues = {
  /**
   * Новый локальный пароль.
   */
  password: string
  /**
   * Подтверждение нового пароля.
   */
  confirmation: string
}

/**
 * Свойства компонента AccountPasswordDialog.
 */
export type AccountPasswordDialogProps = AccountPasswordDialogParams
