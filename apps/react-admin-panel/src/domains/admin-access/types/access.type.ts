/**
 * Серверное действие, доступное для настройки роли.
 */
export type AccessPermission = {
  /**
   * Стабильный ключ действия.
   */
  key: string
  /**
   * Название действия.
   */
  name: string
  /**
   * Только для владельца; не назначается дополнительным ролям.
   */
  system: boolean
}
/**
 * Роль административного аккаунта.
 */
export type AccessRole = {
  /**
   * Уникальный ключ роли.
   */
  key: string
  /**
   * Название роли.
   */
  name: string
  /**
   * Разрешённые действия.
   */
  permissions: string[]
  /**
   * Неизменяемая встроенная роль.
   */
  isBuiltin: boolean
  /**
   * Версия для защиты от перезаписи чужих изменений.
   */
  version: number
}
/**
 * Аккаунт, доступом которого управляет владелец.
 */
export type ManagedAccount = {
  /**
   * Идентификатор аккаунта.
   */
  id: string
  /**
   * Логин.
   */
  login: string
  /**
   * Отображаемое имя.
   */
  name: string
  /**
   * Ключ роли.
   */
  role: string
  /**
   * Разрешён ли вход.
   */
  isActive: boolean
  /**
   * Доступен ли локальный пароль.
   */
  hasLocalPassword: boolean
  /**
   * Активные привязки внешней личности.
   */
  identities: ManagedIdentity[]
  /**
   * Версия доступа к аккаунту.
   */
  version: number
}
/**
 * Заранее привязанный пользователь Keycloak.
 */
export type ManagedIdentity = {
  /**
   * Идентификатор привязки в приложении.
   */
  id: string
  /**
   * Точный issuer realm.
   */
  issuer: string
  /**
   * Неизменяемый sub пользователя провайдера.
   */
  subject: string
}
/**
 * Согласованные данные экрана управления доступом.
 */
export type AccessData = {
  /**
   * Каталог permissions.
   */
  permissions: AccessPermission[]
  /**
   * Существующие роли.
   */
  roles: AccessRole[]
  /**
   * Аккаунты админки.
   */
  accounts: ManagedAccount[]
}
/**
 * Входные данные создания аккаунта.
 */
export type NewAccount = {
  /**
   * Новый логин.
   */
  login: string
  /**
   * Первоначальный пароль.
   */
  password: string
  /**
   * Имя пользователя.
   */
  name: string
  /**
   * Назначаемая роль.
   */
  role: string
}
