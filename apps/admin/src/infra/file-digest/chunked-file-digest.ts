import { createSHA256 } from 'hash-wasm'
import { FILE_DIGEST_ERROR_CODE, FileDigestError } from './file-digest.error'
import { readFileBytes } from './helpers/read-file-bytes'

/**
 * Считает SHA-256 частями по 2 МиБ, не помещая большой файл целиком в память.
 */
export const computeFileSha256InChunks = async (file: Blob, signal: AbortSignal): Promise<string> => {
  signal.throwIfAborted()
  try {
    const hash = await createSHA256()
    hash.init()
    for (let offset = 0; offset < file.size; offset += 2 * 1024 * 1024) {
      signal.throwIfAborted()
      const bytes = await readFileBytes(file.slice(offset, offset + 2 * 1024 * 1024), signal)
      signal.throwIfAborted()
      hash.update(new Uint8Array(bytes))
    }
    signal.throwIfAborted()
    return hash.digest('hex')
  } catch (error) {
    if (signal.aborted || error instanceof FileDigestError) throw error
    throw new FileDigestError(FILE_DIGEST_ERROR_CODE.HASH_FAILED)
  }
}
