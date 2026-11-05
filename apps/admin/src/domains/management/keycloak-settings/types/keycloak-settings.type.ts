/**
 * Сохранённые настройки провайдера без секретного значения.
 */
export type KeycloakSettings = {
  /**
   * Доступен ли вход через провайдера.
   */
  enabled: boolean
  /**
   * Точный issuer realm.
   */
  issuer: string
  /**
   * Confidential client приложения.
   */
  clientId: string
  /**
   * Публичный адрес callback backend.
   */
  callbackUrl: string
  /**
   * Адрес завершения входа в SPA.
   */
  frontendCallbackUrl: string
  /**
   * Версия настроек для защиты от конкурентной перезаписи.
   */
  version: number
  /**
   * Сохранён ли secret в БД.
   */
  hasSecret: boolean
  /**
   * Настроен ли серверный ключ шифрования.
   */
  canStoreSecret: boolean
}
/**
 * Запись настроек: отсутствие нового секрета сохраняет прежний.
 */
export type KeycloakSettingsInput = Omit<KeycloakSettings, 'hasSecret' | 'canStoreSecret'> & {
  /**
   * Новый секрет только для записи.
   */
  clientSecret?: string
  /**
   * Удалить сохранённый секрет при отключённом провайдере.
   */
  clearSecret?: boolean
}
