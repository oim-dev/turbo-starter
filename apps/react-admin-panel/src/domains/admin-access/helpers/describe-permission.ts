/**
 * Пользовательское объяснение серверного разрешения; не определяет выдачу доступа.
 */
type PermissionDescription = {
  /**
   * Человекочитаемое действие.
   */
  name: string
  /**
   * Область действия разрешения.
   */
  description: string
}

/**
 * Описания известных действий административного API.
 */
const PERMISSION_DESCRIPTIONS: Record<string, PermissionDescription> = {
  'account.read': {
    name: 'Просмотр своего аккаунта',
    description: 'Открывать панель и просматривать данные своего профиля.'
  },
  'account.update': { name: 'Изменение своего профиля', description: 'Изменять отображаемое имя в своём аккаунте.' },
  'account.login.change': {
    name: 'Смена своего логина',
    description: 'Изменять логин, используемый для входа в панель.'
  },
  'account.password.change': {
    name: 'Смена своего пароля',
    description: 'Изменять локальный пароль своей учётной записи.'
  },
  'system.access.manage': {
    name: 'Управление доступом',
    description: 'Управлять пользователями, назначать роли и настраивать их права.'
  },
  'accounts.read': {
    name: 'Просмотр пользователей',
    description: 'Открывать список и карточки пользователей админки без изменения их данных.'
  },
  'accounts.activate': {
    name: 'Разрешение входа пользователям',
    description: 'Включать вход существующим пользователям, сохраняя назначенные роли и способы входа.'
  },
  'system.keycloak.manage': {
    name: 'Настройка корпоративного входа',
    description: 'Подключать Keycloak и изменять конфигурацию провайдера.'
  }
}

/**
 * Дополняет серверное имя пояснением, сохраняя неизвестные новые действия видимыми.
 */
export const describePermission = (key: string, name?: string): PermissionDescription => {
  return (
    PERMISSION_DESCRIPTIONS[key] ?? { name: name ?? key, description: 'Действие, предоставленное сервером приложения.' }
  )
}
