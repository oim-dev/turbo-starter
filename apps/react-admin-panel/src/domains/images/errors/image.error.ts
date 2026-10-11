/**
 * Ожидаемые исходы операций медиатеки.
 */
export const IMAGE_ERROR_CODE = {
  /**
   * Сервис временно недоступен.
   */
  UNAVAILABLE: 'UNAVAILABLE',
  /**
   * Недостаточно прав.
   */
  FORBIDDEN: 'FORBIDDEN',
  /**
   * Файл больше не существует.
   */
  NOT_FOUND: 'NOT_FOUND',
  /**
   * Параметры или формат не поддержаны.
   */
  INVALID_INPUT: 'INVALID_INPUT',
  /**
   * Текущее состояние не допускает операцию.
   */
  CONFLICT: 'CONFLICT',
  /**
   * Не завершена передача оригинала.
   */
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  /**
   * Файл превышает серверный лимит.
   */
  TOO_LARGE: 'TOO_LARGE'
} as const

/**
 * Ожидаемая ошибка сценария изображения без технического ответа сервера.
 */
export class ImageError extends Error {
  /**
   * Создаёт типизированный ожидаемый исход.
   */
  constructor(readonly code: (typeof IMAGE_ERROR_CODE)[keyof typeof IMAGE_ERROR_CODE]) {
    super(`image:${code}`)
    this.name = 'ImageError'
  }
}

/**
 * Проверяет ожидаемый неуспешный исход операции изображения.
 */
export const isImageError = (error: unknown): error is ImageError => error instanceof ImageError

/**
 * Возвращает безопасную подсказку восстановления сценария.
 */
export const getImageErrorMessage = (error: ImageError): string => {
  switch (error.code) {
    case 'UNAVAILABLE': return 'Сервис изображений временно недоступен. Попробуйте ещё раз.'
    case 'FORBIDDEN': return 'Для этого действия недостаточно прав. Обратитесь к администратору.'
    case 'NOT_FOUND': return 'Изображение не найдено. Обновите медиатеку.'
    case 'INVALID_INPUT': return 'Проверьте формат файла, папку и теги.'
    case 'CONFLICT': return 'Состояние изображения изменилось. Обновите данные перед повтором.'
    case 'UPLOAD_FAILED': return 'Не удалось передать оригинал. Проверьте соединение и повторите загрузку.'
    case 'TOO_LARGE': return 'Файл превышает допустимый размер. Выберите изображение меньшего размера.'
  }
}
