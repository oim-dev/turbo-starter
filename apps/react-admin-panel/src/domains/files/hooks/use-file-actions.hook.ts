import { useCallback } from 'react'
import { useSWRConfig } from 'swr'
import { useGetCurrentUser } from 'domains/management/auth'
import { setFileCurrentVersion, updateFile, uploadFile } from '../adapters/files.adapter'
import type { UploadFile } from '../types/file-upload.type'

/**
 * Действия с обновлением связанных GET-запросов.
 */
type FileActions = {
  /**
   * Сохраняет классификацию документа.
   */
  save: typeof updateFile
  /**
   * Переключает текущую версию с обновлением связанных представлений.
   */
  setCurrentVersion: typeof setFileCurrentVersion
  /**
   * Передаёт документ и обновляет список.
   */
  upload: UploadFile
  /**
   * Повторяет только чтение.
   */
  refresh: () => Promise<void>
}

/**
 * Владеет синхронизацией приватного кеша после подтверждённой записи.
 */
export const useFileActions = (): FileActions => {
  const { mutate } = useSWRConfig()
  const profile = useGetCurrentUser()
  const userId = profile.error === undefined ? profile.data?.id ?? null : null
  /**
   * Обновляет только файловые запросы identity, начавшей действие.
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (userId === null) return
    await mutate((key) => Array.isArray(key) && key[0] === 'private' && key[1] === userId
      && typeof key[2] === 'string' && key[2].startsWith('files/'), (current: unknown) => current, { revalidate: true, throwOnError: false })
  }, [mutate, userId])
  return {
    refresh,
    setCurrentVersion: async (...args) => {
      const saved = await setFileCurrentVersion(...args)
      await refresh()
      return saved
    },
    save: async (...args) => {
      const saved = await updateFile(...args)
      await refresh()
      return saved
    },
    upload: async (...args) => {
      const uploaded = await uploadFile(...args)
      await refresh()
      return uploaded
    }
  }
}
