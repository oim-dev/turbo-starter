/**
 * Состояния документа на сервере.
 */
export const FILE_STATUS = {
  /**
   * Передача ещё не подтверждена.
   */
  UPLOADING: 'uploading',
  /**
   * Проверенный документ доступен по ссылке.
   */
  READY: 'ready',
  /**
   * Срок незавершённой загрузки истёк.
   */
  EXPIRED: 'expired'
} as const

/**
 * Состояние серверного документа.
 */
export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS]

/**
 * Документ, пригодный для прикрепления постоянной ссылкой.
 */
export type ProjectFile = {
  /**
   * Номер версии, выбранной для постоянной ссылки, 0 до публикации.
   */
  currentVersion: number
  /**
   * Внутренний UUID.
   */
  id: string
  /**
   * Постоянный публичный идентификатор.
   */
  publicId: string
  /**
   * Имя документа; загрузка или выбор версии его не меняют.
   */
  filename: string
  /**
   * Редактируемое имя документа, совпадает с filename.
   */
  title: string
  /**
   * Категория-путь.
   */
  folder: string | null
  /**
   * Метки документа.
   */
  tags: string[]
  /**
   * Готовность документа.
   */
  status: FileStatus
  /**
   * Формат без точки.
   */
  extension: string
  /**
   * Тип ответа при открытии файла.
   */
  contentType: string
  /**
   * Размер в байтах.
   */
  byteSize: number
  /**
   * Вычисленный сервером отпечаток.
   */
  sha256: string | null
  /**
   * Адрес открытия с текущим именем документа. Смена версии не меняет URL.
   */
  url: string | null
  /**
   * Постоянный адрес принудительного скачивания.
   */
  downloadUrl: string | null
  /**
   * Снимок автора загрузки.
   */
  uploadedBy: {
    /**
     * UUID администратора.
     */
    id: string
    /**
     * Имя на момент загрузки.
     */
    name: string
    /**
     * Логин на момент загрузки.
     */
    login: string
  }
  /**
   * Крайний срок подтверждения передачи.
   */
  uploadExpiresAt: string
  /**
   * Дата создания.
   */
  createdAt: string
  /**
   * Дата изменения метаданных.
   */
  updatedAt: string
}

/**
 * Неизменяемая версия с адресом, закреплённым за её номером.
 */
export type FileVersion = Pick<ProjectFile, 'id' | 'filename' | 'contentType' | 'extension' | 'byteSize' | 'uploadedBy' | 'createdAt'> & {
  /**
   * Последовательный номер внутри документа.
   */
  number: number
  /**
   * Проверенный отпечаток байтов версии.
   */
  sha256: string
  /**
   * Постоянная ссылка с параметром version.
   */
  url: string
  /**
   * Скачивание именно этой версии.
   */
  downloadUrl: string
}

/**
 * Пользовательская классификация документа.
 */
export type FileClassification = Pick<ProjectFile, 'title' | 'folder' | 'tags'>

/**
 * Параметры страницы документов.
 */
export type FileFilters = {
  /**
   * Поиск по тексту, ID или URL.
   */
  search: string
  /**
   * Выбранная папка.
   */
  folder: string | null
  /**
   * Документы без папки.
   */
  unfiled: boolean
  /**
   * Выбранный тег.
   */
  tag: string | null
  /**
   * Выбранный статус.
   */
  status: FileStatus | null
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
 * Серверная страница списка.
 */
export type FilePage = {
  /**
   * Документы страницы.
   */
  items: ProjectFile[]
  /**
   * Число совпадений.
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
 * Категория и число документов.
 */
export type FileFacet = {
  /**
   * Название категории.
   */
  name: string
  /**
   * Число документов.
   */
  count: number
}

/**
 * Классификация всей библиотеки документов.
 */
export type FileFacets = {
  /**
   * Папки.
   */
  folders: FileFacet[]
  /**
   * Теги.
   */
  tags: FileFacet[]
  /**
   * Все документы.
   */
  total: number
  /**
   * Число документов без папки.
   */
  unfiledCount: number
}
