import type { ImageFormatGroup, ImageStatus, ImageVariant, ProjectImage } from '../types/image.type'

/**
 * Локализованные статусы общей обработки изображений.
 */
const IMAGE_STATUS_LABELS: Record<ImageStatus, string> = {
  uploading: 'Загружается',
  queued: 'В очереди',
  processing: 'Обрабатывается',
  ready: 'Готово',
  failed: 'Ошибка обработки'
}

/**
 * Возвращает подпись состояния изображения.
 */
export const getImageStatusLabel = (status: ImageStatus): string => IMAGE_STATUS_LABELS[status]

/**
 * Форматирует счётчик медиатеки с согласованием подписи.
 */
export const formatImageCount = (count: number): string => {
  const plural = new Intl.PluralRules('ru-RU').select(count)
  const label = plural === 'one' ? 'изображение' : plural === 'few' ? 'изображения' : 'изображений'
  return `${count.toLocaleString('ru-RU')} ${label}`
}

/**
 * Определяет необходимость обновления незавершённой обработки.
 */
export const isImagePending = (image: ProjectImage): boolean => {
  return image.status === 'queued' || image.status === 'processing'
}

/**
 * Допускает повтор только для завершённого загрузкой задания обработки.
 */
export const canRetryImageProcessing = (image: ProjectImage): boolean => {
  return image.status === 'failed' && image.error?.code !== 'UPLOAD_EXPIRED'
}

/**
 * Отличает сохранённый оригинал от незавершённой передачи.
 */
export const canDownloadImageOriginal = (image: ProjectImage): boolean => {
  return image.status !== 'uploading' && image.error?.code !== 'UPLOAD_EXPIRED'
}

/**
 * Объясняет путь исправления неудачной обработки без обещания восстановить исходные байты.
 */
export const getImageFailureDescription = (image: ProjectImage): string => {
  if (image.error?.code === 'UPLOAD_EXPIRED') {
    return 'Загрузка оригинала не была завершена вовремя. Выберите «Загрузить изображения» и добавьте файл заново.'
  }
  if (['INVALID_IMAGE', 'UNSUPPORTED_IMAGE_TYPE', 'ANIMATION_UNSUPPORTED'].includes(image.error?.code ?? '')) {
    return 'Не удалось прочитать исходник. Проверьте, что это корректное неанимированное изображение JPEG, PNG или WebP. Повтор обработки не исправит повреждённые байты; исправленный файл нужно загрузить заново.'
  }
  return image.error?.message ?? 'Обработка прервана. Оригинал сохранён, задание можно повторить.'
}

/**
 * Форматирует вес файла без обещаний о сжатии.
 */
export const formatImageBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} КБ`
  return `${(bytes / 1024 ** 2).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`
}

/**
 * Возвращает геометрию уже распознанного оригинала.
 */
export const getImageDimensions = (image: ProjectImage): string => {
  if (image.original.width === null || image.original.height === null) {
    return image.status === 'failed' ? 'Размеры не определены' : 'Размеры определяются'
  }
  return `${image.original.width} × ${image.original.height}`
}

/**
 * Группирует реальные файлы по формату и сортирует размеры внутри группы.
 */
export const getImageFormatGroups = (variants: readonly ImageVariant[]): ImageFormatGroup[] => {
  const formats = [...new Set(variants.map((variant) => variant.format))].sort()
  return formats.map((format) => ({
    format,
    label: format.toUpperCase(),
    variants: variants.filter((variant) => variant.format === format).sort((first, second) => first.width - second.width)
  }))
}

/**
 * Выбирает одну опубликованную группу формата для preview и общей ссылки.
 */
export const getImagePreviewVariants = (image: ProjectImage, format?: string): ImageVariant[] => {
  if (image.status !== 'ready') return []
  const groups = getImageFormatGroups(image.variants)
  const selected = groups.find((group) => group.format === format)
    ?? groups.find((group) => group.format === 'jpeg')
    ?? groups.find((group) => group.format === 'png')
    ?? groups[0]
  return selected?.variants ?? []
}

/**
 * Приводит классификацию к единому свободному набору тегов.
 */
export const normalizeImageTags = (tags: readonly string[]): string[] => {
  return [...new Set(tags.map((tag) => tag.normalize('NFC').trim().toLocaleLowerCase('ru-RU')).filter(Boolean))].sort()
}

/**
 * Убирает пустые сегменты пути папки.
 */
export const normalizeImageFolder = (folder: string | null): string | null => {
  const normalized = folder?.split('/').map((segment) => segment.trim()).filter(Boolean).join('/') ?? ''
  return normalized === '' ? null : normalized
}
