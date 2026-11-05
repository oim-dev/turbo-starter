import type { UploadEntry } from '../types/upload-entry.type'

/**
 * Описывает проверку, передачу и подтверждённый исход без ложного процента хеширования.
 */
export const getUploadStatusLabel = (entry: UploadEntry): string => {
  switch (entry.status) {
    case 'waiting': return 'В очереди'
    case 'checking': return 'Проверяем файл · SHA-256'
    case 'uploading': return `Передаём оригинал · ${entry.progress}%`
    case 'confirming': return 'Подтверждаем загрузку'
    case 'reused': return 'Уже есть в медиатеке'
    case 'done': return 'Новый файл добавлен'
    case 'failed': return 'Не удалось загрузить'
    case 'cancelled': return 'Загрузка остановлена'
  }
}
