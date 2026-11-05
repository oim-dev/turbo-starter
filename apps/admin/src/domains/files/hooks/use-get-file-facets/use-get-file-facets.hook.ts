import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useGetCurrentUser } from 'domains/management/auth'
import { getFileFacets } from '../../adapters/files.adapter'
import type { FileError } from '../../errors/file.error'
import type { FileFacets } from '../../types/file.type'
import { getFileFacetsKey } from './get-file-facets-key'

/**
 * Предоставляет папки и теги из единого серверного источника.
 */
export const useGetFileFacets = (): SWRResponse<FileFacets, FileError> => {
  const profile = useGetCurrentUser()
  const canRead = profile.error === undefined && profile.data?.permissions.includes('files.read') === true
  return useSWR<FileFacets, FileError>(getFileFacetsKey(canRead ? profile.data?.id ?? null : null), getFileFacets, { shouldRetryOnError: false })
}
