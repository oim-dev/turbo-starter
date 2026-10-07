'use client'

import { useContext } from 'react'
import { useStore } from 'zustand'
import { isNotDefined } from '@biocad/value-predicates'

import { AppStorageContext } from '../providers/app-storage.provider'
import type { AppStorageStore } from '../types/app-storage-store.type'

/**
 * Возвращает выбранную часть app storage.
 */
export const useAppStorage = <TValue,>(selector: (store: AppStorageStore) => TValue): TValue => {
  const appStorageContext = useContext(AppStorageContext)

  if (isNotDefined(appStorageContext)) {
    throw new Error('useAppStorage must be used within AppStorageProvider')
  }

  return useStore(appStorageContext, selector)
}
