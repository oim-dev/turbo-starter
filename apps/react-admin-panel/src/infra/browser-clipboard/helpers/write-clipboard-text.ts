/**
 * Копирует текст по пользовательскому действию, включая HTTP без Clipboard API.
 */
export const writeClipboardText = async (text: string): Promise<void> => {
  if (typeof navigator.clipboard?.writeText === 'function') {
    await navigator.clipboard.writeText(text)
    return
  }

  const activeElement = document.activeElement
  const selection = window.getSelection()
  const ranges = selection === null ? [] : Array.from(
    { length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()
  )
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.inset = '0'
  textarea.style.width = '1px'
  textarea.style.height = '1px'
  const container = activeElement?.closest('[role="dialog"]') ?? document.body
  container.append(textarea)

  try {
    textarea.focus({ preventScroll: true })
    textarea.select()
    if (!document.execCommand('copy')) throw new Error('Browser clipboard is unavailable')
  } finally {
    textarea.remove()
    if (activeElement instanceof HTMLElement) activeElement.focus({ preventScroll: true })
    selection?.removeAllRanges()
    for (const range of ranges) selection?.addRange(range)
  }
}
