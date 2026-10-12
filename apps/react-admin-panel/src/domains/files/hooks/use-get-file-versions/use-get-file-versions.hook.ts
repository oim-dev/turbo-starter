import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useGetCurrentUser } from 'domains/management/auth'
import { getFileVersions } from '../../adapters/files.adapter'
import type { FileError } from '../../errors/file.error'
import type { FileVersion } from '../../types/file.type'
import { getFileVersionsKey } from './get-file-versions-key'

/**
 * Предоставляет проверенную историю версий выбранного документа.
 */
export const useGetFileVersions = (id: string | null): SWRResponse<FileVersion[], FileError> => {
  const profile = useGetCurrentUser()
  const canRead = profile.error === undefined && profile.data?.permissions.includes('files.read') === true
  return useSWR<FileVersion[], FileError>(getFileVersionsKey(canRead ? profile.data?.id ?? null : null, id), () => getFileVersions(id ?? ''), { shouldRetryOnError: false, keepPreviousData: false })
}
