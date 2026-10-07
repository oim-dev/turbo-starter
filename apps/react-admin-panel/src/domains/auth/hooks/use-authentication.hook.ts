import { useStore } from 'zustand'
import { authStore } from '../stores/auth.store'
import type { Authentication } from '../types/authentication.type'

/**
 * Подписывает потребителя на доменное решение о допуске к панели.
 */
export const useAuthentication = (): Authentication => useStore(authStore, (state) => state.authentication)
