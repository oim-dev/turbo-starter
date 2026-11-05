import { Button } from '@mantine/core'
import type { JSX } from 'react'
import { SystemStateScreen } from 'compositions/screens/system-state/client'
import type { FailureProps } from './types/failure-props.type'

/**
 * Подключает восстановление Next.js к отображению ошибки.
 *
 * Используется для:
 *  - повторного открытия маршрута после неожиданного сбоя
 */
export const FailureBoundary = (props: FailureProps): JSX.Element => {
  const { retry } = props

  return (
    <SystemStateScreen kind="error">
      <Button onClick={retry} type="button">Попробовать ещё раз</Button>
    </SystemStateScreen>
  )
}
