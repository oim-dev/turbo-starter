'use client'

import { createContext, useEffect } from 'react'
import { isNonEmptyString } from '@biocad/value-predicates'

import { appStore } from '../app-storage.store'
import { APP_STORAGE_TOKEN_KEY } from '../config/app-storage.config'
import type { AppStorageProviderProps } from '../types/app-storage-provider-props.type'
import type { AppStorageStoreApi } from '../types/app-storage-store.type'

export const AppStorageContext = createContext<AppStorageStoreApi | null>(null)

/**
 * Синхронизирует token store с текущим browser localStorage.
 */
const syncAppStorageToken = (): void => {
  const storedToken = window.localStorage.getItem(APP_STORAGE_TOKEN_KEY)?.trim()

  appStore.setState({ token: isNonEmptyString(storedToken) ? storedToken : null })
}

/**
 * Проверяет, относится ли storage event к app storage token.
 */
const isAppStorageTokenEvent = (event: StorageEvent): boolean => {
  return event.key === APP_STORAGE_TOKEN_KEY || event.key === null
}

/**
 * Provider app storage для client tree кабинета.
 */
export const AppStorageProvider = (props: AppStorageProviderProps) => {
  const { children } = props

  useEffect(() => {
    syncAppStorageToken()

    const handleStorageChange = (event: StorageEvent): void => {
      if (isAppStorageTokenEvent(event)) {
        syncAppStorageToken()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return (
    <AppStorageContext.Provider value={appStore}>
      {children}
    </AppStorageContext.Provider>
  )
}
