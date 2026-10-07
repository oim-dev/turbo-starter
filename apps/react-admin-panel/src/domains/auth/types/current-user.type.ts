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
   * Признак активности учётной записи.
   */
  readonly isActive: boolean
  /**
   * Дата создания в формате серверного date-time.
   */
  readonly createdAt: string
  /**
   * Дата последнего изменения в формате серверного date-time.
   */
  readonly updatedAt: string
}
