import type { CurrentUser } from 'domains/auth'

/**
 * Подтверждённый профиль для формы собственного аккаунта.
 */
export type ProfileSettingsParams = {
  /**
   * Профиль и доступные действия.
   */
  profile: CurrentUser
}
/**
 * Свойства настроек личного аккаунта.
 */
export type ProfileSettingsProps = ProfileSettingsParams
/**
 * Данные формы личного имени.
 */
export type ProfileSettingsValues = {
  /**
   * Имя пользователя.
   */
  name: string
}
