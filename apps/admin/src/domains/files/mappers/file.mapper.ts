import { hasOwn, isArrayOf, isNumber, isOneOf, isRecord, isString } from 'shared/value-predicates'
import { FILE_STATUS } from '../types/file.type'
import type { FileFacet, FileFacets, FilePage, FileVersion, ProjectFile } from '../types/file.type'
import type { FileUploadCheckpoint, FileUploadPart, FileUploadResult } from '../types/file-upload.type'

/**
 * Проверяет неотрицательный целочисленный размер или счётчик.
 */
const isCount = (count: unknown): count is number => isNumber(count) && Number.isSafeInteger(count) && count >= 0

/**
 * Проверяет дату внешнего контракта.
 */
const isDate = (date: unknown): date is string => isString(date) && Number.isFinite(Date.parse(date))

/**
 * Разрешает только абсолютные HTTP(S)-адреса без встроенных credentials.
 */
const isUrl = (url: unknown): url is string => {
  if (!isString(url)) return false
  try {
    const parsed = new URL(url)
    return ['https:', 'http:'].includes(parsed.protocol) && parsed.username === '' && parsed.password === ''
  } catch { return false }
}

/**
 * Проверяет снимок автора загрузки.
 */
const isAuthor = (author: unknown): author is ProjectFile['uploadedBy'] => isRecord(author)
  && hasOwn(author, 'id') && isString(author.id)
  && hasOwn(author, 'name') && isString(author.name)
  && hasOwn(author, 'login') && isString(author.login)

/**
 * Проверяет все поля документа и инварианты опубликованных ссылок.
 */
const isProjectFile = (file: unknown): file is ProjectFile => {
  if (!isRecord(file)
    || !hasOwn(file, 'currentVersion') || !isCount(file.currentVersion)
    || !hasOwn(file, 'id') || !isString(file.id) || !/^[0-9a-f-]{36}$/i.test(file.id)
    || !hasOwn(file, 'publicId') || !isString(file.publicId) || !/^[0-9A-Za-z]{8}$/.test(file.publicId)
    || !hasOwn(file, 'filename') || !isString(file.filename)
    || !hasOwn(file, 'title') || !isString(file.title)
    || !hasOwn(file, 'folder') || !(file.folder === null || isString(file.folder))
    || !hasOwn(file, 'tags') || !isArrayOf(file.tags, isString)
    || !hasOwn(file, 'status') || !isOneOf(file.status, Object.values(FILE_STATUS))
    || !hasOwn(file, 'extension') || !isString(file.extension)
    || !hasOwn(file, 'contentType') || !isString(file.contentType)
    || !hasOwn(file, 'byteSize') || !isCount(file.byteSize)
    || !hasOwn(file, 'sha256') || !(file.sha256 === null || (isString(file.sha256) && /^[0-9a-f]{64}$/.test(file.sha256)))
    || !hasOwn(file, 'url') || !(file.url === null || isUrl(file.url))
    || !hasOwn(file, 'downloadUrl') || !(file.downloadUrl === null || isUrl(file.downloadUrl))
    || !hasOwn(file, 'uploadedBy') || !isAuthor(file.uploadedBy)
    || !hasOwn(file, 'createdAt') || !isDate(file.createdAt)
    || !hasOwn(file, 'updatedAt') || !isDate(file.updatedAt)
    || !hasOwn(file, 'uploadExpiresAt') || !isDate(file.uploadExpiresAt)) return false
  return file.status === 'ready'
    ? file.url !== null && file.downloadUrl !== null && file.sha256 !== null && file.currentVersion > 0
    : file.url === null && file.downloadUrl === null && file.sha256 === null && file.currentVersion === 0
}

/**
 * Создаёт предметную модель из проверенного ответа.
 */
export const mapFile = (payload: unknown): ProjectFile => {
  if (!isProjectFile(payload)) throw new Error('Invalid file response')
  return {
    currentVersion: payload.currentVersion,
    id: payload.id, publicId: payload.publicId, filename: payload.filename, title: payload.title,
    folder: payload.folder, tags: [...payload.tags], status: payload.status, extension: payload.extension,
    contentType: payload.contentType, byteSize: payload.byteSize, sha256: payload.sha256,
    url: payload.url, downloadUrl: payload.downloadUrl, uploadedBy: { ...payload.uploadedBy },
    createdAt: payload.createdAt, updatedAt: payload.updatedAt, uploadExpiresAt: payload.uploadExpiresAt
  }
}

/**
 * Проверяет страницу документов.
 */
export const mapFilePage = (payload: unknown): FilePage => {
  if (!isRecord(payload)
    || !hasOwn(payload, 'items') || !isArrayOf(payload.items, isProjectFile)
    || !hasOwn(payload, 'total') || !isCount(payload.total)
    || !hasOwn(payload, 'page') || !isCount(payload.page) || payload.page === 0
    || !hasOwn(payload, 'pageSize') || !isCount(payload.pageSize) || payload.pageSize === 0) throw new Error('Invalid file page')
  return { items: payload.items.map(mapFile), total: payload.total, page: payload.page, pageSize: payload.pageSize }
}

/**
 * Проверяет название категории и число документов.
 */
const isFacet = (facet: unknown): facet is FileFacet => isRecord(facet)
  && hasOwn(facet, 'name') && isString(facet.name) && hasOwn(facet, 'count') && isCount(facet.count)

/**
 * Проверяет классификацию документов.
 */
export const mapFileFacets = (payload: unknown): FileFacets => {
  if (!isRecord(payload)
    || !hasOwn(payload, 'folders') || !isArrayOf(payload.folders, isFacet)
    || !hasOwn(payload, 'tags') || !isArrayOf(payload.tags, isFacet)
    || !hasOwn(payload, 'total') || !isCount(payload.total)
    || !hasOwn(payload, 'unfiledCount') || !isCount(payload.unfiledCount)) throw new Error('Invalid file facets')
  return { folders: payload.folders.map((folder) => ({ ...folder })), tags: payload.tags.map((tag) => ({ ...tag })), total: payload.total, unfiledCount: payload.unfiledCount }
}

/**
 * Проверяет созданную загрузку до отправки байтов в S3.
 */
export const mapFileUpload = (payload: unknown, sha256: string): FileUploadCheckpoint | FileUploadResult => {
  if (!isRecord(payload) || !hasOwn(payload, 'file') || !hasOwn(payload, 'upload')) throw new Error('Invalid file upload')
  const file = mapFile(payload.file)
  if (!hasOwn(payload, 'reused') || typeof payload.reused !== 'boolean') throw new Error('Invalid file reuse')
  if (payload.reused) {
    if (payload.upload !== null || !hasOwn(payload, 'uploadId') || payload.uploadId !== null) throw new Error('Invalid reused upload')
    return mapFileComplete(payload)
  }
  if (!hasOwn(payload, 'uploadId') || !isString(payload.uploadId) || !hasOwn(payload, 'version') || payload.version !== null) throw new Error('Invalid upload attempt')
  const upload = payload.upload
  if (file.status === 'expired' || !isRecord(upload)
    || !hasOwn(upload, 'url') || !(upload.url === null || isUrl(upload.url))
    || !hasOwn(upload, 'partSize') || !(upload.partSize === null || (isCount(upload.partSize) && upload.partSize > 0))
    || !hasOwn(upload, 'method') || !isOneOf(upload.method, ['PUT', 'MULTIPART'] as const)
    || !hasOwn(upload, 'expiresAt') || !isDate(upload.expiresAt)
    || !hasOwn(upload, 'headers') || !isRecord(upload.headers)
    || !Object.values(upload.headers).every(isString)) throw new Error('Invalid file upload target')
  if (upload.method === 'PUT' && (upload.url === null || upload.partSize !== null)) throw new Error('Invalid single upload')
  if (upload.method === 'MULTIPART' && (upload.url !== null || upload.partSize === null)) throw new Error('Invalid multipart upload')
  const headers: Record<string, string> = {}
  for (const [name, header] of Object.entries(upload.headers)) {
    if (!isString(header) || !/^(content-type|x-amz-[a-z0-9-]+)$/i.test(name)) throw new Error('Invalid upload header')
    headers[name] = header
  }
  return { id: payload.uploadId, url: upload.url, partSize: upload.partSize, nextPart: 1, headers, expiresAt: upload.expiresAt, isTransferred: false, sha256 }
}

/**
 * Проверяет цель одной части до передачи байтов.
 */
export const mapFileUploadPart = (payload: unknown): FileUploadPart => {
  if (!isRecord(payload) || !hasOwn(payload, 'url') || !isUrl(payload.url)
    || !hasOwn(payload, 'expiresAt') || !isDate(payload.expiresAt)
    || !hasOwn(payload, 'uploadExpiresAt') || !isDate(payload.uploadExpiresAt)
    || !hasOwn(payload, 'headers') || !isRecord(payload.headers)) throw new Error('Invalid file part')
  const headers: Record<string, string> = {}
  for (const [name, header] of Object.entries(payload.headers)) {
    if (!isString(header) || !/^(content-type|x-amz-[a-z0-9-]+)$/i.test(name)) throw new Error('Invalid part header')
    headers[name] = header
  }
  return { url: payload.url, headers, uploadExpiresAt: payload.uploadExpiresAt }
}

/**
 * Проверяет неизменяемую версию до записи в кеш.
 */
const isFileVersion = (version: unknown): version is FileVersion => isRecord(version)
  && hasOwn(version, 'id') && isString(version.id)
  && hasOwn(version, 'number') && isCount(version.number) && version.number > 0
  && hasOwn(version, 'filename') && isString(version.filename)
  && hasOwn(version, 'contentType') && isString(version.contentType)
  && hasOwn(version, 'extension') && isString(version.extension)
  && hasOwn(version, 'byteSize') && isCount(version.byteSize)
  && hasOwn(version, 'sha256') && isString(version.sha256) && /^[0-9a-f]{64}$/.test(version.sha256)
  && hasOwn(version, 'url') && isUrl(version.url)
  && hasOwn(version, 'downloadUrl') && isUrl(version.downloadUrl)
  && hasOwn(version, 'createdAt') && isDate(version.createdAt)
  && hasOwn(version, 'uploadedBy') && isAuthor(version.uploadedBy)

/**
 * Выбирает из внешнего ответа только предметные поля версии.
 */
const mapFileVersion = (version: FileVersion): FileVersion => ({
  id: version.id, number: version.number, filename: version.filename, contentType: version.contentType,
  extension: version.extension, byteSize: version.byteSize, sha256: version.sha256,
  url: version.url, downloadUrl: version.downloadUrl, createdAt: version.createdAt,
  uploadedBy: { id: version.uploadedBy.id, name: version.uploadedBy.name, login: version.uploadedBy.login }
})

/**
 * Преобразует подтверждение загрузки или результат дедупликации.
 */
export const mapFileComplete = (payload: unknown): FileUploadResult => {
  if (!isRecord(payload) || !hasOwn(payload, 'file')
    || !hasOwn(payload, 'version') || !isFileVersion(payload.version)
    || !hasOwn(payload, 'reused') || typeof payload.reused !== 'boolean') throw new Error('Invalid file completion')
  const file = mapFile(payload.file)
  // Подтверждённая версия может быть новее текущей после ручного переключения.
  if (file.status !== 'ready') throw new Error('Invalid completed file state')
  return { file, version: mapFileVersion(payload.version), isReused: payload.reused }
}

/**
 * Проверяет историю версий.
 */
export const mapFileVersions = (payload: unknown): FileVersion[] => {
  if (!isArrayOf(payload, isFileVersion)) throw new Error('Invalid file versions')
  return payload.map(mapFileVersion)
}
