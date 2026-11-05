/**
 * Состояния жизненного цикла изображения.
 */
export const IMAGE_STATUS = {
  /**
   * Ожидается загрузка оригинала.
   */
  UPLOADING: 'uploading',
  /**
   * Задание поставлено в очередь.
   */
  QUEUED: 'queued',
  /**
   * Создаются производные.
   */
  PROCESSING: 'processing',
  /**
   * Полный манифест опубликован.
   */
  READY: 'ready',
  /**
   * Обработка завершилась ошибкой.
   */
  FAILED: 'failed'
} as const

/**
 * Состояние изображения.
 */
export type ImageStatus = (typeof IMAGE_STATUS)[keyof typeof IMAGE_STATUS]

/**
 * Опубликованный файл производного изображения.
 */
export type ImageVariant = {
  /**
   * Идентификатор файла.
   */
  id: string
  /**
   * Ширина в пикселях.
   */
  width: number
  /**
   * Высота в пикселях.
   */
  height: number
  /**
   * Формат файла.
   */
  format: string
  /**
   * Тип содержимого.
   */
  mimeType: string
  /**
   * Вес файла в байтах.
   */
  byteSize: number
  /**
   * Готовый публичный URL.
   */
  url: string
}

/**
 * Файлы одного опубликованного формата, доступные для превью и вкладок.
 */
export type ImageFormatGroup = {
  /**
   * Ключ формата манифеста.
   */
  format: string
  /**
   * Название расширения.
   */
  label: string
  /**
   * Файлы по возрастанию ширины.
   */
  variants: ImageVariant[]
}

/**
 * Изображение в общей медиатеке административных и прикладных сценариев.
 */
export type ProjectImage = {
  /**
   * Идентификатор загрузки.
   */
  id: string
  /**
   * Короткий публичный идентификатор: восемь символов base62.
   */
  publicId: string
  /**
   * Исходное имя файла.
   */
  filename: string
  /**
   * Отображаемый заголовок.
   */
  title: string
  /**
   * Единственная папка-категория.
   */
  folder: string | null
  /**
   * Нормализованные теги.
   */
  tags: string[]
  /**
   * Текущее состояние.
   */
  status: ImageStatus
  /**
   * Время создания ISO 8601.
   */
  createdAt: string
  /**
   * Время последнего изменения ISO 8601.
   */
  updatedAt: string
  /**
   * Автор загрузки.
   */
  uploadedBy: {
    /**
     * Идентификатор автора.
     */
    id: string
    /**
     * Тип аккаунта.
     */
    realm: 'admin' | 'client'
    /**
     * Имя автора.
     */
    name: string
    /**
     * Логин автора.
     */
    login: string
  }
  /**
   * Сведения о приватном оригинале, без публичного URL.
   */
  original: {
    /**
     * MIME оригинала.
     */
    contentType: string
    /**
     * Вес оригинала.
     */
    byteSize: number
    /**
     * Проверенный сервером SHA-256 оригинальных байтов; null у старых или непроверенных оригиналов.
     */
    sha256: string | null
    /**
     * Распознанная ширина.
     */
    width: number | null
    /**
     * Распознанная высота.
     */
    height: number | null
  }
  /**
   * Полный манифест, доступный только в ready.
   */
  variants: ImageVariant[]
  /**
   * Причина неудачной обработки.
   */
  error: {
    /**
     * Стабильный код обработки.
     */
    code: string
    /**
     * Описание ошибки обработки.
     */
    message: string
  } | null
}

/**
 * Классификация изображения при создании и редактировании.
 */
export type ImageClassification = Pick<ProjectImage, 'title' | 'folder' | 'tags'>

/**
 * Параметры новой загрузки.
 */
export type ImageUploadInput = Omit<ImageClassification, 'title'>

/**
 * Фильтры общей медиатеки.
 */
export type ImageFilters = {
  /**
   * Серверный поиск по имени, тегам, короткому ID или URL изображения.
   */
  search: string
  /**
   * Выбранная папка; null означает все папки.
   */
  folder: string | null
  /**
   * Показывать только изображения без папки.
   */
  unfiled: boolean
  /**
   * Выбранный тег.
   */
  tag: string | null
  /**
   * Выбранное состояние.
   */
  status: ImageStatus | null
  /**
   * Номер страницы, начиная с единицы.
   */
  page: number
  /**
   * Размер страницы.
   */
  pageSize: number
}

/**
 * Страница изображений с общим количеством совпадений.
 */
export type ImagePage = {
  /**
   * Изображения страницы.
   */
  items: ProjectImage[]
  /**
   * Количество совпадений.
   */
  total: number
  /**
   * Номер страницы.
   */
  page: number
  /**
   * Размер страницы.
   */
  pageSize: number
}

/**
 * Категория с числом изображений.
 */
export type ImageFacet = {
  /**
   * Имя категории.
   */
  name: string
  /**
   * Количество изображений.
   */
  count: number
}

/**
 * Доступные категории общей медиатеки.
 */
export type ImageFacets = {
  /**
   * Папки.
   */
  folders: ImageFacet[]
  /**
   * Теги.
   */
  tags: ImageFacet[]
  /**
   * Общее количество.
   */
  total: number
  /**
   * Количество без папки.
   */
  unfiledCount: number
}
