import type { AdminRole } from './admin-role.type'

/**
 * Подтверждённый текущий администратор без технических полей источника.
 */
export type CurrentUser = {
  /**
   * Идентификатор администратора.
   */
  readonly id: string
  /**
   * Логин для отображения в панели.
   */
  readonly login: string
  /**
   * Актуальная роль, полученная из защищённого профиля.
   */
  readonly role: AdminRole
  /**
   * Отображаемое название роли.
   */
  readonly roleName: string
  /**
   * Подтверждённые сервером доступные действия.
   */
  readonly permissions: string[]
  /**
   * Отображаемое имя аккаунта.
   */
  readonly name: string
  /**
   * Признак активности учётной записи.
   */
  readonly isActive: boolean
  /**
   * У администратора установлен локальный пароль; false означает вход только через SSO.
   */
  readonly hasLocalPassword: boolean
  /**
   * Дата создания в формате серверного date-time.
   */
  readonly createdAt: string
  /**
   * Дата последнего изменения в формате серверного date-time.
   */
  readonly updatedAt: string
}
