import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useStore } from 'zustand'
import { getCurrentUser } from '../../adapters/get-current-user.adapter'
import type { GetCurrentUserError } from '../../errors/auth.error'
import { authStore } from '../../stores/auth.store'
import type { CurrentUser } from '../../types/current-user.type'
import { getCurrentUserKey } from './get-current-user-key'

/**
 * Предоставляет профиль текущего администратора через приватный SWR-кеш.
 */
export const useGetCurrentUser = (): SWRResponse<CurrentUser | null, GetCurrentUserError> => {
  const sessionId = useStore(authStore, (state) => state.sessionId)
  const cacheEpoch = useStore(authStore, (state) => state.cacheEpoch)
  const key = getCurrentUserKey(sessionId, cacheEpoch)

  return useSWR<CurrentUser | null, GetCurrentUserError>(key, getCurrentUser, {
    keepPreviousData: false,
    shouldRetryOnError: false
  })
}
