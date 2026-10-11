import { Badge, Group, Text, UnstyledButton } from '@mantine/core'
import { IconArrowUpRight, IconFolder } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { ImagePreview, formatImageBytes, getImageDimensions, getImageStatusLabel } from 'domains/images'
import type { ImageCardProps } from './types/image-card-props.type'
import styles from './styles/image-card.module.css'

/**
 * Представляет изображение доступной с клавиатуры плиткой.
 *
 * Используется для:
 *  - быстрого просмотра содержимого и состояния файла
 *  - перехода к метаданным изображения
 */
export const ImageCard = (props: ImageCardProps): JSX.Element => {
  const { image, onOpen, className, ...rootAttrs } = props
  const title = image.title || image.filename
  const statusLabel = getImageStatusLabel(image.status)
  const shouldShowStatus = image.status !== 'ready'
  const isReady = image.status === 'ready'
  const statusColor = image.status === 'failed' ? 'red' : 'blue'
  const dimensions = getImageDimensions(image)
  const byteSize = formatImageBytes(image.original.byteSize)
  const folderLabel = image.folder ?? 'Без папки'

  return (
    <article
      {...rootAttrs}
      className={cl(styles.root, className)}
    >
      <div className={styles.preview}>
        <ImagePreview image={image} sizes="(min-width: 1408px) 25vw, (min-width: 992px) 33vw, 50vw" />
        {shouldShowStatus && (
          <Badge className={styles.status} size="sm" color={statusColor} variant="filled">{statusLabel}</Badge>
        )}
        {isReady && (
          <span className={styles.openIcon}><IconArrowUpRight size={18} aria-hidden="true" /></span>
        )}
      </div>
      <div className={styles.content}>
        <Text fw={600} size="sm" truncate title={title}>{title}</Text>
        <Group justify="space-between" gap={4} mt={5}>
          <Text size="xs" c="dimmed">{dimensions}</Text>
          <Text size="xs" c="dimmed">{byteSize}</Text>
        </Group>
        <Group gap={5} mt="sm" wrap="nowrap">
          <IconFolder size={13} aria-hidden="true" />
          <Text size="xs" c="dimmed" truncate>{folderLabel}</Text>
        </Group>
      </div>
      <UnstyledButton
        className={styles.openButton}
        onClick={() => onOpen(image.id)}
        aria-label={`Открыть ${title}`}
      />
    </article>
  )
}
