import type { ReactNode } from 'react'

/** Дерево приложения с единственным глобальным lifecycle авторизации. */
export type AuthProviderProps = {
  /** Потребители сессии и приватного кеша. */
  children: ReactNode
}
