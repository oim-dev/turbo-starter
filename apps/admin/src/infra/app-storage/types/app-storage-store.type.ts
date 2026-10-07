import type { StoreApi } from 'zustand/vanilla'

/**
 * Состояние app storage кабинета.
 */
export type AppStorageState = {
  /** Access token текущей auth-сессии. Undefined означает, что client storage ещё не прочитан. */
  token: string | null | undefined
}

/**
 * Actions app storage кабинета.
 */
export type AppStorageActions = {
  /** Сохраняет или очищает access token auth-сессии. */
  setToken: (token?: string | null) => void
}

/**
 * Zustand-store app storage кабинета.
 */
export type AppStorageStore = AppStorageState & AppStorageActions

/**
 * API Zustand-store app storage кабинета.
 */
export type AppStorageStoreApi = StoreApi<AppStorageStore>
