import type { AccessRole, ManagedAccount } from 'domains/admin-access'

/**
 * Контракт формы аккаунта.
 */
export type AccountEditorParams = {
  /**
   * Существующий аккаунт либо создание нового.
   */
  account?: ManagedAccount
  /**
   * Доступные роли.
   */
  roles: AccessRole[]
  /**
   * Защита последнего активного владельца.
   */
  isLastOwner: boolean
  /**
   * Адрес списка с сохранёнными фильтрами.
   */
  returnTo: string
  /**
   * Открывает страницу созданного аккаунта.
   */
  onCreated: (account: ManagedAccount) => void
}
/**
 * Свойства сценария редактирования без собственного корневого DOM.
 */
export type AccountEditorProps = AccountEditorParams
/**
 * Пользовательский ввод создания или изменения аккаунта.
 */
export type AccountFormValues = {
  /**
   * Первоначальный логин.
   */
  login: string
  /**
   * Первоначальное имя.
   */
  name: string
  /**
   * Первоначальный пароль.
   */
  password: string
  /**
   * Подтверждение первоначального пароля.
   */
  confirmation: string
  /**
   * Назначаемая роль.
   */
  role: string
  /**
   * Активность существующего аккаунта.
   */
  isActive: boolean
}
