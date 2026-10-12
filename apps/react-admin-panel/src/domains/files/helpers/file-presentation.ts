import type { FileStatus } from '../types/file.type'

/**
 * Форматирует фактический размер документа.
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} КиБ`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МиБ`
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ГиБ`
  return `${(bytes / 1024 ** 4).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ТиБ`
}

/**
 * Переводит состояние документа на язык интерфейса.
 */
export const getFileStatusLabel = (status: FileStatus): string => {
  switch (status) {
    case 'ready': return 'Готов'
    case 'uploading': return 'Не завершён'
    case 'expired': return 'Срок истёк'
  }
}
