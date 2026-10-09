import type { CurrentUser } from 'domains/auth'

/**
 * Подтверждённый профиль для формы собственного аккаунта.
 */
export type ProfileSettingsProps = {
  /**
   * Профиль и доступные действия.
   */
  profile: CurrentUser
}
/**
 * Ввод выбранного действия над собственным аккаунтом.
 */
export type ProfileSettingsValues = {
  /**
   * Имя пользователя.
   */
  name: string
  /**
   * Новый логин.
   */
  login: string
  /**
   * Подтверждение текущим паролем.
   */
  currentPassword: string
  /**
   * Новый пароль.
   */
  newPassword: string
}
