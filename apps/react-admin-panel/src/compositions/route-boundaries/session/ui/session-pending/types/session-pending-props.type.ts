import type { ComponentPropsWithoutRef } from 'react'
import type { AuthError } from 'domains/auth'

/**
 * Параметры неподтверждённой сессии.
 */
type SessionPendingParams = {
  /**
   * Безопасная доменная причина сбоя проверки.
   */
  error: AuthError | null
  /**
   * Проверка ещё выполняется, а ошибка прошлого действия не должна её подменять.
   */
  isChecking: boolean
}

/**
 * Атрибуты корневой области проверки сессии.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Свойства состояния проверки сессии.
 */
export type SessionPendingProps = RootAttrs & SessionPendingParams
