import { isEmptyArray } from 'shared/value-predicates'
import type { NativeFileDrop } from '../types/native-file-drop.type'

/**
 * Отделяет локальные файлы от ссылок, текста и HTML-переносов.
 */
export const isNativeFileDrag = (transfer: DataTransfer | null): transfer is DataTransfer => {
  return transfer !== null && Array.from(transfer.types).includes('Files')
}

/**
 * Читает файлы синхронно, пока браузер разрешает доступ к DataTransfer.
 */
export const readFileDrop = (transfer: DataTransfer): NativeFileDrop => {
  const items = Array.from(transfer.items).filter((item) => item.kind === 'file')
  const files: File[] = []
  let directoryCount = 0
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.()
    if (entry?.isDirectory) {
      directoryCount += 1
      continue
    }
    const file = item.getAsFile()
    if (file !== null) files.push(file)
  }
  // Некоторые браузеры предоставляют только FileList.
  if (isEmptyArray(items)) files.push(...Array.from(transfer.files))
  return { files, directoryCount }
}
