import { useEffect, useEffectEvent, useState } from 'react'
import { isNativeFileDrag, readFileDrop } from '../helpers/read-file-drop'
import type { NativeFileDropOptions } from '../types/native-file-drop.type'

/**
 * Перехватывает только файловый drag документа и очищает подсветку при завершении.
 * Счётчик вложенных enter/leave исключает мерцание; portal не создаёт вторую обработку.
 */
export const useNativeFileDrop = (options: NativeFileDropOptions): boolean => {
  const { isEnabled } = options
  const [isDragging, setIsDragging] = useState(false)
  const handleDrop = useEffectEvent((event: DragEvent): void => {
    if (!isNativeFileDrag(event.dataTransfer)) return
    options.onDrop(readFileDrop(event.dataTransfer))
  })
  const updateDropEffect = useEffectEvent((transfer: DataTransfer): void => {
    transfer.dropEffect = options.canDrop ? 'copy' : 'none'
  })

  useEffect(() => {
    if (!isEnabled) return
    let depth = 0
    let isCancelled = false
    let hasFileDrag = false
    let isInternalDrag = false
    /**
     * Сбрасывает текущий жест без запуска действия.
     */
    const reset = (): void => {
      depth = 0
      isCancelled = false
      hasFileDrag = false
      isInternalDrag = false
      setIsDragging(false)
    }
    /**
     * OS-перенос не создаёт dragstart: жест из страницы не становится загрузкой.
     */
    const handleStart = (): void => {
      isInternalDrag = true
    }
    /**
     * Учитывает входы в дочерние узлы документа.
     */
    const handleEnter = (event: DragEvent): void => {
      if (!isNativeFileDrag(event.dataTransfer)) return
      event.preventDefault()
      if (isInternalDrag) return
      if (depth === 0) isCancelled = false
      hasFileDrag = true
      depth += 1
      if (!isCancelled) setIsDragging(true)
    }
    /**
     * Не позволяет браузеру открыть файл вместо приложения.
     */
    const handleOver = (event: DragEvent): void => {
      if (!isNativeFileDrag(event.dataTransfer)) return
      event.preventDefault()
      if (isInternalDrag) {
        event.dataTransfer.dropEffect = 'none'
        return
      }
      hasFileDrag = true
      updateDropEffect(event.dataTransfer)
      if (!isCancelled) setIsDragging(true)
    }
    /**
     * Вложенный leave не убирает подсветку остальных областей.
     */
    const handleLeave = (event: DragEvent): void => {
      if (!isNativeFileDrag(event.dataTransfer)) return
      if (isInternalDrag) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) reset()
    }
    /**
     * Доставляет одну пачку активному потребителю, затем завершает жест.
     */
    const handleDocumentDrop = (event: DragEvent): void => {
      if (!isNativeFileDrag(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      if (!isCancelled && !isInternalDrag) handleDrop(event)
      reset()
    }
    /**
     * Отменяет подсветку без побочного выбора файлов.
     */
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !hasFileDrag) return
      reset()
      isCancelled = true
    }
    document.addEventListener('dragstart', handleStart)
    document.addEventListener('dragenter', handleEnter)
    document.addEventListener('dragover', handleOver)
    document.addEventListener('dragleave', handleLeave)
    document.addEventListener('drop', handleDocumentDrop)
    document.addEventListener('dragend', reset)
    document.addEventListener('keydown', handleKey, true)
    window.addEventListener('blur', reset)
    return () => {
      document.removeEventListener('dragstart', handleStart)
      document.removeEventListener('dragenter', handleEnter)
      document.removeEventListener('dragover', handleOver)
      document.removeEventListener('dragleave', handleLeave)
      document.removeEventListener('drop', handleDocumentDrop)
      document.removeEventListener('dragend', reset)
      document.removeEventListener('keydown', handleKey, true)
      window.removeEventListener('blur', reset)
    }
  }, [isEnabled])

  return isEnabled && isDragging
}
