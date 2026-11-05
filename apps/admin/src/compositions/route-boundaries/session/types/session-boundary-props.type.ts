/**
 * Параметры доступа к маршрутной ветке.
 */
type SessionBoundaryParams = {
  /**
   * Состояние сессии, в котором доступно содержимое ветки.
   */
  access: 'guest' | 'authenticated'
}

/**
 * Свойства маршрутной границы без собственного DOM.
 */
export type SessionBoundaryProps = SessionBoundaryParams
