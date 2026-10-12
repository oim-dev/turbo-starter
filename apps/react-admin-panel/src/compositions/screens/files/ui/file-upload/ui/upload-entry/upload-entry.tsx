import { ActionIcon, Anchor, Badge, Button, Group, Progress, Text } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import type { JSX } from 'react'
import { formatFileSize } from 'domains/files'
import type { UploadEntryProps } from './types/upload-entry-props.type'
import styles from './styles/upload-entry.module.css'

/**
 * Показывает состояние передачи одного файла и действия восстановления.
 *
 * Используется для:
 *  - отображения реального прогресса и найденного дубликата
 *  - повтора отменённой или неудавшейся передачи
 */
export const UploadEntry = (props: UploadEntryProps): JSX.Element => {
  const { entry, isBusy, onRemove, onRetry } = props
  const labels = { waiting: 'В очереди', checking: 'Проверяем SHA-256', preparing: 'Подготавливаем', uploading: 'Передаём', confirming: 'Подтверждаем', done: 'Готово', failed: 'Ошибка', cancelled: 'Остановлено' }
  const statusLabel = labels[entry.status]
  const sizeLabel = formatFileSize(entry.file.size)
  const isTransferring = entry.status === 'uploading'
  const canRetry = !isBusy && (entry.status === 'failed' || entry.status === 'cancelled')
  const receipt = entry.receipt
  const color = entry.status === 'failed' ? 'red' : entry.status === 'done' ? 'teal' : 'gray'
  const removeLabel = `Убрать ${entry.file.name} из очереди`
  const receiptLabel = receipt?.isReused ? 'Содержимое уже есть' : 'Версия сохранена'

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <Text size="sm" fw={600} truncate title={entry.file.name}>{entry.file.name}</Text>
        <Group gap="xs" mt={4}><Text size="xs" c="dimmed">{sizeLabel}</Text><Badge variant="light" size="xs" color={color} c="var(--app-color-text-strong)">{statusLabel}</Badge></Group>
        {isTransferring && (
          <Progress value={entry.percent} size="sm" mt="sm" aria-label={`Загрузка ${entry.file.name}`} />
        )}
        {entry.error !== null && (
          <Text size="xs" c="var(--app-color-text-strong)" mt="xs" role="alert">{entry.error}</Text>
        )}
        {receipt !== undefined && (
          <Text size="xs" mt="xs">{receiptLabel} · <Anchor href={receipt.version.url} target="_blank" rel="noopener noreferrer" size="xs">Версия {receipt.version.number}</Anchor></Text>
        )}
        {canRetry && (
          <Button size="compact-xs" variant="subtle" mt="xs" onClick={onRetry}>Вернуть в очередь</Button>
        )}
      </div>
      <ActionIcon variant="subtle" color="gray" disabled={isBusy} aria-label={removeLabel} onClick={onRemove}><IconX size={16} /></ActionIcon>
    </div>
  )
}
