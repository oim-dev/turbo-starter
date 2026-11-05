import { useEffect, useRef, useState } from 'react'
import { writeClipboardText } from '../helpers/write-clipboard-text'
import type { BrowserClipboard } from '../types/browser-clipboard.type'

/**
 * Хранит результат копирования в пределах потребителя и очищает таймер при размонтировании.
 */
export const useBrowserClipboard = ({ timeout = 2000 } = {}): BrowserClipboard => {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const revision = useRef(0)

  useEffect(() => () => {
    revision.current += 1
    clearTimeout(timer.current)
  }, [])

  /**
   * Отменяет ожидаемое подтверждение предыдущего копирования.
   */
  const reset = (): void => {
    revision.current += 1
    clearTimeout(timer.current)
    setCopied(false)
    setError(null)
  }

  /**
   * Подтверждает только последнее успешное копирование активного потребителя.
   */
  const copy = (text: string): void => {
    reset()
    const operationRevision = revision.current
    void writeClipboardText(text).then(() => {
      if (operationRevision !== revision.current) return
      setCopied(true)
      timer.current = setTimeout(() => setCopied(false), timeout)
    }, (failure: unknown) => {
      if (operationRevision !== revision.current) return
      setError(failure instanceof Error ? failure : new Error('Browser clipboard failed'))
    })
  }

  return { copy, copied, error, reset }
}
