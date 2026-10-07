import { isDefined, isNonEmptyString } from '@biocad/value-predicates'
import { createStore } from 'zustand/vanilla'

import { APP_STORAGE_TOKEN_KEY } from './config/app-storage.config'
import type { AppStorageState, AppStorageStore } from './types/app-storage-store.type'

/**
 * Возвращает access token из browser localStorage.
 */
const readStoredToken = (): string | null | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  const storedToken = window.localStorage.getItem(APP_STORAGE_TOKEN_KEY)?.trim()

  return isNonEmptyString(storedToken) ? storedToken : null
}

const defaultAppStorageState: AppStorageState = {
  token: readStoredToken()
}

/**
 * Создаёт Zustand-store app storage.
 */
export const createAppStorageStore = (initState: AppStorageState = defaultAppStorageState) => {
  return createStore<AppStorageStore>()((set) => ({
    ...initState,
    setToken: (token) => {
      const trimmedToken = token?.trim()
      const nextToken = isNonEmptyString(trimmedToken) ? trimmedToken : null

      if (typeof window !== 'undefined') {
        if (isDefined(nextToken)) {
          window.localStorage.setItem(APP_STORAGE_TOKEN_KEY, nextToken)
        } else {
          window.localStorage.removeItem(APP_STORAGE_TOKEN_KEY)
        }
      }

      set({ token: nextToken })
    }
  }))
}

/**
 * Singleton store приложения для React и runtime infra-кода вне React tree.
 */
export const appStore = createAppStorageStore()

/**
 * Возвращает access token из app storage без подписки на React state.
 */
export const getAppStorageToken = (): AppStorageState['token'] => {
  return appStore.getState().token
}

/**
 * Сохраняет или очищает access token через app storage.
 */
export const setAppStorageToken = (token?: string | null): void => {
  appStore.getState().setToken(token)
}
