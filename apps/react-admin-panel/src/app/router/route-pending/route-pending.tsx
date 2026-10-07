import { Center, Loader } from '@mantine/core'
import cl from 'clsx'
import styles from './styles/route-pending.module.css'
import type { RoutePendingProps } from './types/route-pending-props.type'

/**
 * Показывает общее состояние ожидания маршрута.
 *
 * Используется для:
 *  - отображения загрузки отложенной ветки маршрутов
 */
export const RoutePending = (props: RoutePendingProps) => {
  const { className, ...rootAttrs } = props

  return (
    <Center {...rootAttrs} className={cl(styles.root, className)} mih="100svh" role="status">
      <Loader aria-label="Страница загружается" size="lg" />
    </Center>
  )
}
