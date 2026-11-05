import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useGetCurrentUser } from 'domains/management/auth'
import { getFiles } from '../../adapters/files.adapter'
import type { FileError } from '../../errors/file.error'
import type { FileFilters, FilePage } from '../../types/file.type'
import { getFilesKey } from './get-files-key'

/**
 * Предоставляет список с проверенным приватным кешем.
 */
export const useGetFiles = (filters: FileFilters): SWRResponse<FilePage, FileError> => {
  const profile = useGetCurrentUser()
  const canRead = profile.error === undefined && profile.data?.permissions.includes('files.read') === true
  return useSWR<FilePage, FileError>(getFilesKey(canRead ? profile.data?.id ?? null : null, filters), () => getFiles(filters), { shouldRetryOnError: false, keepPreviousData: false })
}
