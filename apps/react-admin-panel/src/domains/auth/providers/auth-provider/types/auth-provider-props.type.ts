import type { ReactNode } from 'react'

/**
 * Дерево приложения с единственным глобальным lifecycle авторизации.
 */
export type AuthProviderProps = {
  /**
   * Потребители сессии и приватного кеша.
   */
  children: ReactNode
  /**
   * Разрешает bootstrap и проверку срока JWT; callback нового входа временно приостанавливает их.
   */
  shouldRestoreSession?: boolean
}
