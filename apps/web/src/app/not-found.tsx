import type { JSX } from 'react'
import { SystemStateScreen } from 'compositions/screens/system-state/client'

/**
 * Подключает экран отсутствующей страницы.
 *
 * Используется для:
 *  - возврата к главной странице по неизвестному адресу
 */
const NotFoundPage = (): JSX.Element => {
  return <SystemStateScreen kind="not-found" />
}

export default NotFoundPage
