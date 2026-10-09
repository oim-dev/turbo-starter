import { useEffect, useMemo } from 'react'
import { SWRConfig } from 'swr'
import { useStore } from 'zustand'
import {
  connectAuthentication,
  checkAuthenticationExpiry
} from '../../operations/session-lifecycle.operation'
import { authStore } from '../../stores/auth.store'
import type { AuthProviderProps } from './types/auth-provider-props.type'

/**
 * Подключает жизненный цикл административной сессии и изолированный приватный кеш.
 *
 * Используется для:
 *  - проверки сохранённого JWT при запуске и завершения по абсолютному сроку
 *  - отделения кеша следующего входа от ответов завершённой сессии
 */
export const AuthProvider = (props: AuthProviderProps) => {
  const { children, shouldRestoreSession = true } = props
  const cacheEpoch = useStore(authStore, (state) => state.cacheEpoch)
  const sessionExpiresAt = useStore(authStore, (state) => state.sessionExpiresAt)
  const cacheScope = useMemo(() => ({ epoch: cacheEpoch, cache: new Map() }), [cacheEpoch])
  const cacheConfig = useMemo(() => ({ provider: () => cacheScope.cache }), [cacheScope])

  useEffect(() => connectAuthentication(shouldRestoreSession), [shouldRestoreSession])
  useEffect(() => () => cacheScope.cache.clear(), [cacheScope])
  useEffect(() => {
    if (!shouldRestoreSession || sessionExpiresAt === null) {
      return
    }

    const timeout = window.setTimeout(checkAuthenticationExpiry, Math.max(0, sessionExpiresAt - Date.now()))

    return () => window.clearTimeout(timeout)
  }, [sessionExpiresAt, shouldRestoreSession])

  return (
    <SWRConfig key={cacheScope.epoch} value={cacheConfig}>
      {children}
    </SWRConfig>
  )
}
