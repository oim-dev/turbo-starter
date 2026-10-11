import { IMAGE_MAX_UPLOAD_BYTES } from 'domains/images'
import type { NativeFileDrop } from 'infra/native-file-drop'
import { isEmptyArray } from 'shared/value-predicates'
import type { UploadEntry } from '../types/upload-entry.type'

/**
 * Проверяет пачку, сохраняя валидные файлы при смешанном выборе.
 * Не создаёт browser-ресурсы: повтор инициализации React безопасен.
 */
export const prepareUploadSelection = (batch: NativeFileDrop) => {
  const acceptedFiles = batch.files.filter((file) => {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      && file.size > 0 && file.size <= IMAGE_MAX_UPLOAD_BYTES
  })
  const rejectedCount = batch.files.length - acceptedFiles.length
  const messages: string[] = []
  if (batch.directoryCount > 0) messages.push('Папки не добавлены. Перетащите файлы из папки.')
  if (rejectedCount > 0) messages.push(`Не добавлено файлов: ${rejectedCount}. Поддерживаются непустые JPEG, PNG и WebP до 20 МиБ каждый.`)
  if (isEmptyArray(batch.files) && batch.directoryCount === 0) messages.push('В переносе нет доступных файлов. Выберите изображения с устройства.')
  const entries: UploadEntry[] = acceptedFiles.map((file) => ({
    id: crypto.randomUUID(),
    file,
    status: 'waiting',
    progress: 0,
    errorMessage: null,
    imageId: null
  }))
  return { entries, errorMessage: isEmptyArray(messages) ? null : messages.join(' ') }
}
