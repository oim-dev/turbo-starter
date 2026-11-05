import type { ReactNode } from 'react'
import { useBrowserClipboard } from '../../hooks/use-browser-clipboard.hook'
import type { CopyButtonProps } from './types/copy-button-props.type'

/**
 * Передаёт действие копирования и подтверждённый результат существующему интерфейсу.
 *
 * Используется для:
 *  - копирования ссылок и идентификаторов по HTTP и HTTPS
 */
export const CopyButton = (props: CopyButtonProps): ReactNode => {
  const { children, value, timeout } = props
  const clipboard = useBrowserClipboard({ timeout })

  return children({ copied: clipboard.copied, copy: () => clipboard.copy(value) })
}
