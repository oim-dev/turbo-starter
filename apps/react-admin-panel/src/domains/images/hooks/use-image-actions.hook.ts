import { useCallback, useState } from 'react'
import { useSWRConfig } from 'swr'
import { useGetCurrentUser } from 'domains/management/auth'
import { getImageOriginal, retryImage, updateImage, uploadImage } from '../adapters/images.adapter'
import { isImagePending } from '../helpers/image-presentation'
import type { ProjectImage } from '../types/image.type'
import type { ImageProcessingWatch } from '../types/image-processing-watch.type'

/**
 * Локальная область наблюдения подтверждённого аккаунта.
 */
type PendingImageScope = {
  /**
   * Identity владельца запросов, без credential.
   */
  userId: string | null
  /**
   * Подтверждённые pending-задания этой identity.
   */
  ids: readonly string[]
}

/**
 * Стабильное пустое наблюдение для ещё не подтверждённой identity.
 */
const NO_PENDING_IDS: readonly string[] = []

/**
 * Действия медиатеки с синхронизацией всех активных запросов своего домена.
 */
type ImageActions = {
  /**
   * Наблюдение за своими заданиями независимо от фильтра текущей страницы.
   */
  processing: ImageProcessingWatch
  /**
   * Сохраняет классификацию.
   */
  save: typeof updateImage
  /**
   * Передаёт оригинал и подтверждает обработку.
   */
  upload: typeof uploadImage
  /**
   * Повторяет обработку.
   */
  retry: (id: string) => Promise<void>
  /**
   * Получает приватный оригинал.
   */
  original: typeof getImageOriginal
  /**
   * Обновляет активные запросы без повторения записи.
   */
  refresh: () => Promise<void>
}

/**
 * Владеет обновлением кеша после подтверждённых сервером изменений.
 */
export const useImageActions = (): ImageActions => {
  const { mutate } = useSWRConfig()
  const profile = useGetCurrentUser()
  const userId = profile.error === undefined ? profile.data?.id ?? null : null
  const [pendingScope, setPendingScope] = useState<PendingImageScope>({ userId: null, ids: [] })
  const pendingIds = pendingScope.userId === userId ? pendingScope.ids : NO_PENDING_IDS
  /**
   * Запоминает только идентификатор подтверждённого pending-задания, не копируя серверную модель.
   */
  const trackProcessing = (image: ProjectImage): void => {
    if (userId === null || !isImagePending(image)) return
    setPendingScope((current) => {
      if (current.userId !== userId) return { userId, ids: [image.id] }
      return current.ids.includes(image.id) ? current : { userId, ids: [...current.ids, image.id] }
    })
  }
  /**
   * Завершает наблюдение по свежему ответу сервера без сброса параллельно добавленных заданий.
   */
  const handleSettled = useCallback((ids: readonly string[]): void => {
    setPendingScope((current) => {
      if (current.userId !== userId || !current.ids.some((id) => ids.includes(id))) return current
      return { userId, ids: current.ids.filter((id) => !ids.includes(id)) }
    })
  }, [userId])
  /**
   * Повторно читает только активные записи медиатеки в текущем приватном scope.
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (userId === null) return
    await mutate((key) => Array.isArray(key) && key[0] === 'private' && key[1] === userId
      && typeof key[2] === 'string' && key[2].startsWith('images/'))
  }, [mutate, userId])
  return {
    processing: { pendingIds, onSettled: handleSettled },
    refresh,
    original: getImageOriginal,
    save: async (...args) => {
      const saved = await updateImage(...args)
      await refresh()
      return saved
    },
    upload: async (...args) => {
      const uploaded = await uploadImage(...args)
      trackProcessing(uploaded)
      await refresh()
      return uploaded
    },
    retry: async (id) => {
      const queued = await retryImage(id)
      trackProcessing(queued)
      await refresh()
    }
  }
}
