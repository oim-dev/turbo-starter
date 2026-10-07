import { isNotDefined } from '@biocad/value-predicates'
import { useContext } from 'react'

import { AuthContext } from '../context/auth.context'
import type { AuthContextValue } from '../context/auth.context'

/**
 * Возвращает внутреннее состояние и dispatch auth-домена.
 */
export const useAuth = (): AuthContextValue => {
  const auth = useContext(AuthContext)

  if (isNotDefined(auth)) {
    throw new Error('useAuth must be used within AuthRoot')
  }

  return auth
}
