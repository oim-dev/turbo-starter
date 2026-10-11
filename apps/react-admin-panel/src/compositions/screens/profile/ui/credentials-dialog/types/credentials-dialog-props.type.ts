/**
 * Параметры компонента CredentialsDialog.
 */
export type CredentialsDialogParams = {
  /**
   * Выбранное изменение учётных данных.
   */
  action: 'login' | 'password'
  /**
   * Текущий логин аккаунта.
   */
  login: string
  /**
   * Требуется ли подтверждение локальным паролем.
   */
  hasLocalPassword: boolean
  /**
   * Закрывает диалог и очищает введённые пароли.
   */
  onClose: () => void
}

/**
 * Атрибуты корневого элемента компонента.
 */
export type CredentialsValues = {
  /**
   * Новый логин.
   */
  login: string
  /**
   * Действующий пароль.
   */
  currentPassword: string
  /**
   * Новый пароль.
   */
  newPassword: string
  /**
   * Повтор нового пароля.
   */
  confirmation: string
}

/**
 * Свойства компонента CredentialsDialog.
 */
export type CredentialsDialogProps = CredentialsDialogParams
