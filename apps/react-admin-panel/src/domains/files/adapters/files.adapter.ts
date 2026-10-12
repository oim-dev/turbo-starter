import { backendAdminApi } from 'infra/backend-admin-api'
import type { AdminFileListParams } from 'infra/backend-admin-api'
import { uploadPresignedFile } from 'infra/presigned-upload'
import { computeFileSha256InChunks } from 'infra/file-digest'
import { FileError } from '../errors/file.error'
import { mapFile, mapFileComplete, mapFileFacets, mapFilePage, mapFileUpload, mapFileUploadPart, mapFileVersions } from '../mappers/file.mapper'
import { classifyFileError } from '../source-errors/classify-file-error'
import { verifyUploadResult } from '../helpers/verify-upload-result'
import type { FileClassification, FileFacets, FileFilters, FilePage, FileVersion, ProjectFile } from '../types/file.type'
import type { UploadFile } from '../types/file-upload.type'

/**
 * Получает страницу документов с серверными фильтрами.
 */
export const getFiles = async (filters: FileFilters): Promise<FilePage> => {
  const query: AdminFileListParams = {
    page: filters.page, pageSize: filters.pageSize, search: filters.search || undefined,
    folder: filters.folder ?? undefined, unfiled: filters.unfiled || undefined,
    tag: filters.tag ?? undefined, status: filters.status ?? undefined
  }
  try { return mapFilePage(await backendAdminApi.files.adminFileList(query)) }
  catch (error) { throw classifyFileError(error, true) }
}

/**
 * Получает актуальный документ.
 */
export const getFile = async (id: string): Promise<ProjectFile> => {
  try { return mapFile(await backendAdminApi.files.adminFileGet({ id })) }
  catch (error) { throw classifyFileError(error, true) }
}

/**
 * Получает историю всех опубликованных версий документа.
 */
export const getFileVersions = async (id: string): Promise<FileVersion[]> => {
  try { return mapFileVersions(await backendAdminApi.files.adminFileVersions({ id })) }
  catch (error) { throw classifyFileError(error, true) }
}

/**
 * Получает папки и теги всей библиотеки.
 */
export const getFileFacets = async (): Promise<FileFacets> => {
  try { return mapFileFacets(await backendAdminApi.files.adminFileFacets()) }
  catch (error) { throw classifyFileError(error, true) }
}

/**
 * Сохраняет только редактируемую классификацию.
 */
export const updateFile = async (id: string, input: FileClassification): Promise<ProjectFile> => {
  try { return mapFile(await backendAdminApi.files.adminFileUpdate({ id }, { title: input.title.trim(), folder: input.folder, tags: input.tags })) }
  catch (error) { throw classifyFileError(error) }
}

/**
 * Выбирает опубликованную версию для постоянной ссылки документа.
 */
export const setFileCurrentVersion = async (id: string, version: number): Promise<ProjectFile> => {
  try {
    return mapFile(await backendAdminApi.files.adminFileSetCurrentVersion({ id }, { version }))
  } catch (error) {
    throw classifyFileError(error)
  }
}

/**
 * Передаёт документ и подтверждает его; ручной повтор продолжает сохранённую попытку.
 */
export const uploadFile: UploadFile = async (file, input, onProgress, onCheckpoint, signal, checkpoint) => {
  let attempt = checkpoint
  try {
    signal.throwIfAborted()
    onProgress({ phase: 'preparing', percent: 0 })
    if (attempt?.isTransferred) {
      try {
        onProgress({ phase: 'confirming', percent: 100 })
        const receipt = mapFileComplete(await backendAdminApi.files.adminFileComplete({ id: attempt.id }, { signal, timeout: 0 }))
        return verifyUploadResult(receipt, attempt.sha256, input.targetId)
      } catch (error) {
        const classified = classifyFileError(error)
        if (!(classified instanceof FileError) || classified.code !== 'EXPIRED') throw classified
        attempt = undefined
      }
    }
    if (attempt !== undefined && Date.parse(attempt.expiresAt) <= Date.now()) attempt = undefined
    if (attempt === undefined) {
      onProgress({ phase: 'checking', percent: 0 })
      const sha256 = await computeFileSha256InChunks(file, signal)
      signal.throwIfAborted()
      onProgress({ phase: 'preparing', percent: 0 })
      const body = { filename: file.name, byteSize: file.size, sha256 }
      const created = mapFileUpload(input.targetId === undefined
        ? await backendAdminApi.files.adminFileCreateUpload({ ...body, folder: input.folder, tags: input.tags }, { signal })
        : await backendAdminApi.files.adminFileCreateVersionUpload({ id: input.targetId }, body, { signal }), sha256)
      if ('isReused' in created) return verifyUploadResult(created, sha256, input.targetId)
      attempt = created
      signal.throwIfAborted()
      onCheckpoint(attempt)
    }
    signal.throwIfAborted()
    if (!attempt.isTransferred) {
      onProgress({ phase: 'uploading', percent: 0 })
      if (attempt.partSize !== null) {
        const partSize = attempt.partSize
        const count = Math.ceil(file.size / partSize)
        for (let part = attempt.nextPart; part <= count; part++) {
          signal.throwIfAborted()
          const target = mapFileUploadPart(await backendAdminApi.files.adminFileUploadPart({ id: attempt.id, part }, { signal }))
          attempt = { ...attempt, expiresAt: target.uploadExpiresAt }
          onCheckpoint(attempt)
          const offset = (part - 1) * partSize
          const slice = file.slice(offset, offset + partSize)
          await uploadPresignedFile({
            url: target.url, headers: target.headers, file: slice, signal, timeoutMs: 0,
            onProgress: (percent) => {
              if (!signal.aborted) onProgress({ phase: 'uploading', percent: Math.round((offset + slice.size * percent / 100) / file.size * 100) })
            }
          })
          signal.throwIfAborted()
          attempt = { ...attempt, nextPart: part + 1 }
          onCheckpoint(attempt)
        }
      } else {
        if (attempt.url === null) throw new Error('Single upload URL is missing')
        await uploadPresignedFile({
          url: attempt.url, headers: attempt.headers, file, signal, timeoutMs: 0,
          onProgress: (percent) => { if (!signal.aborted) onProgress({ phase: 'uploading', percent }) }
        })
      }
      attempt = { ...attempt, isTransferred: true }
      signal.throwIfAborted()
      onCheckpoint(attempt)
    }
    onProgress({ phase: 'confirming', percent: 100 })
    const completed = mapFileComplete(await backendAdminApi.files.adminFileComplete({ id: attempt.id }, { signal, timeout: 0 }))
    return verifyUploadResult(completed, attempt.sha256, input.targetId)
  } catch (error) {
    if (signal.aborted) throw error
    const classified = classifyFileError(error)
    if (attempt !== undefined && classified instanceof FileError) {
      if (classified.code === 'EXPIRED' || classified.code === 'SIZE_MISMATCH') {
        // Собранный multipart нельзя перезаписать прежними ссылками на части.
        onCheckpoint({ ...attempt, expiresAt: new Date(0).toISOString(), isTransferred: false, nextPart: 1 })
      } else if (classified.code === 'CONFLICT') {
        onCheckpoint({ ...attempt, isTransferred: false, nextPart: 1 })
      }
    }
    throw classified
  }
}
