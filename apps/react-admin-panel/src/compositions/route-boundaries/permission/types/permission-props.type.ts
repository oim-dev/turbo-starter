/**
 * Требование к доступу маршрутной ветки.
 */
export type PermissionParams = {
  /**
   * Необходимое право либо список, из которого достаточно одного подтверждённого права.
   */
  permission: string | readonly string[]
}

/**
 * Свойства маршрутной границы без собственного корневого DOM.
 */
export type PermissionProps = PermissionParams
