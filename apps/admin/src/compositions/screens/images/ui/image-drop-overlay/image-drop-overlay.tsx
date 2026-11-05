import { Portal, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconCloudUpload, IconLock } from '@tabler/icons-react'
import type { JSX } from 'react'
import type { ImageDropOverlayProps } from './types/image-drop-overlay-props.type'
import styles from './styles/image-drop-overlay.module.css'

/**
 * Подсвечивает приём файлов на странице галереи.
 *
 * Используется для:
 *  - открытия загрузчика перетаскиванием
 *  - объяснения отсутствующего права загрузки
 */
export const ImageDropOverlay = (props: ImageDropOverlayProps): JSX.Element => {
  const { canUpload } = props
  const DropIcon = canUpload ? IconCloudUpload : IconLock
  const title = canUpload ? 'Отпустите изображения здесь' : 'Загрузка недоступна'
  const description = canUpload
    ? 'Добавим файлы в очередь. Загрузка начнётся после подтверждения.'
    : 'Для добавления файлов необходимо право images.upload.'
  const color = canUpload ? 'blue' : 'orange'

  return (
    <Portal>
      <div className={styles.root} role="status" aria-live="polite">
        <Stack className={styles.card} align="center" gap="md">
          <ThemeIcon size={72} radius="xl" variant="light" color={color}><DropIcon size={36} aria-hidden="true" /></ThemeIcon>
          <Text fw={700} size="xl" ta="center">{title}</Text>
          <Text size="sm" c="dimmed" ta="center">{description}</Text>
          <Text size="xs" c="dimmed">Escape — отменить перенос</Text>
        </Stack>
      </div>
    </Portal>
  )
}
