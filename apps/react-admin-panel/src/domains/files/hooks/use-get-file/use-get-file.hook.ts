import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useGetCurrentUser } from 'domains/management/auth'
import { getFile } from '../../adapters/files.adapter'
import type { FileError } from '../../errors/file.error'
import type { ProjectFile } from '../../types/file.type'
import { getFileKey } from './get-file-key'

/**
 * Получает подробности открытого документа.
 */
export const useGetFile = (id: string | null): SWRResponse<ProjectFile, FileError> => {
  const profile = useGetCurrentUser()
  const canRead = profile.error === undefined && profile.data?.permissions.includes('files.read') === true
  return useSWR<ProjectFile, FileError>(getFileKey(canRead ? profile.data?.id ?? null : null, id), () => getFile(id ?? ''), { shouldRetryOnError: false, keepPreviousData: false })
}
