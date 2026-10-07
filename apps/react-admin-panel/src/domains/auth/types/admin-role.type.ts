/**
 * Роли административного аккаунта, подтверждённые сервером.
 */
export const ADMIN_ROLE = {
  /**
   * Владелец административной панели.
   */
  OWNER: 'OWNER',
  /**
   * Администратор поддержки.
   */
  SUPPORT: 'SUPPORT'
} as const

/**
 * Роль текущего администратора.
 */
export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE]
