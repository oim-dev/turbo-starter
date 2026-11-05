import type { FileClassification, FileVersion, ProjectFile } from './file.type'

/**
 * Контрольная точка ручного повтора; живёт только в текущей очереди и сессии.
 */
export type FileUploadCheckpoint = {
  /**
   * UUID созданной попытки.
   */
  id: string
  /**
   * Подписанный адрес загрузки.
   */
  url: string | null
  /**
   * Размер части, null для одиночного PUT.
   */
  partSize: number | null
  /**
   * Первая ещё не подтверждённая часть multipart, начиная с 1.
   */
  nextPart: number
  /**
   * Заголовки S3, не включающие JWT приложения.
   */
  headers: Record<string, string>
  /**
   * Срок действия загрузки.
   */
  expiresAt: string
  /**
   * Подтверждён ли успешный PUT.
   */
  isTransferred: boolean
  /**
   * SHA-256 выбранных байтов для проверки результата подтверждения.
   */
  sha256: string
}

/**
 * Краткоживущая цель одной части и продлённый срок всей попытки.
 */
export type FileUploadPart = {
  /**
   * Подписанный адрес части.
   */
  url: string
  /**
   * Заголовки только S3.
   */
  headers: Record<string, string>
  /**
   * Крайний срок продолжения активной попытки.
   */
  uploadExpiresAt: string
}

/**
 * Наблюдаемый этап передачи.
 */
export type FileUploadProgress = {
  /**
   * Текущая операция.
   */
  phase: 'checking' | 'preparing' | 'uploading' | 'confirming'
  /**
   * Процент только фактически переданных байтов.
   */
  percent: number
}

/**
 * Полный сценарий загрузки с явным продолжением прерванной попытки.
 */
export type FileUploadResult = {
  /**
   * Документ с актуальной последней версией.
   */
  file: ProjectFile
  /**
   * Созданная или найденная версия выбранного содержимого.
   */
  version: FileVersion
  /**
   * Были ли переиспользованы уже сохранённые байты.
   */
  isReused: boolean
}

/**
 * Назначение загрузки и классификация нового документа.
 */
export type FileUploadInput = Omit<FileClassification, 'title'> & {
  /**
   * UUID документа при добавлении версии; отсутствует для нового документа.
   */
  targetId?: string
}

/**
 * Проверяет хеш, передаёт новые байты и публикует версию.
 */
export type UploadFile = (
  file: File,
  input: FileUploadInput,
  onProgress: (progress: FileUploadProgress) => void,
  onCheckpoint: (checkpoint: FileUploadCheckpoint) => void,
  signal: AbortSignal,
  checkpoint?: FileUploadCheckpoint
) => Promise<FileUploadResult>
