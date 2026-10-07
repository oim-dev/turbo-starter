import { useEffect, useMemo } from 'react'
import { SWRConfig } from 'swr'
import { useStore } from 'zustand'
import {
  connectAuthentication,
  reportAuthenticationFailure,
  retryBootstrap
} from '../../operations/session-lifecycle.operation'
import { authStore } from '../../stores/auth.store'
import { AUTH_STATUS } from '../../types/authentication.type'
import type { AuthProviderProps } from './types/auth-provider-props.type'

/**
 * Подключает жизненный цикл административной сессии и изолированный приватный кеш.
 *
 * Используется для:
 *  - восстановления сессии при запуске и планового обновления credential
 *  - отделения кеша следующего входа от ответов завершённой сессии
 */
export const AuthProvider = (props: AuthProviderProps) => {
  const { children } = props
  const cacheEpoch = useStore(authStore, (state) => state.cacheEpoch)
  const refreshAt = useStore(authStore, (state) => state.refreshAt)
  const status = useStore(authStore, (state) => state.authentication.status)
  const cacheScope = useMemo(() => ({ epoch: cacheEpoch, cache: new Map() }), [cacheEpoch])
  const cacheConfig = useMemo(() => ({ provider: () => cacheScope.cache }), [cacheScope])

  useEffect(connectAuthentication, [])
  useEffect(() => () => cacheScope.cache.clear(), [cacheScope])
  useEffect(() => {
    if (status !== AUTH_STATUS.AUTHENTICATED || refreshAt === null) {
      return
    }

    const timeout = window.setTimeout(() => {
      void retryBootstrap().catch(reportAuthenticationFailure)
    }, Math.max(1000, refreshAt - Date.now()))

    return () => window.clearTimeout(timeout)
  }, [refreshAt, status])

  return (
    <SWRConfig key={cacheScope.epoch} value={cacheConfig}>
      {children}
    </SWRConfig>
  )
}
