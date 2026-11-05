import { hasOwn, isRecord } from 'shared/value-predicates'
import { getSafeReturnTo } from './get-safe-return-to'

/**
 * Извлекает безопасный адрес возврата из состояния навигации.
 */
export const getSessionReturnTo = (state: unknown): string => {
  if (!isRecord(state) || !hasOwn(state, 'returnTo')) {
    return '/'
  }

  return getSafeReturnTo(state.returnTo)
}
