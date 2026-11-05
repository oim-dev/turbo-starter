import { ActionIcon, Button, Group, Loader, Progress, Text } from '@mantine/core'
import { IconPhotoOff, IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { formatImageBytes } from 'domains/images'
import { isDefined } from 'shared/value-predicates'
import { getUploadStatusLabel } from '../../helpers/get-upload-status-label'
import type { UploadFileProps } from './types/upload-file-props.type'
import styles from './styles/upload-file.module.css'

/**
 * Показывает локальное превью, прогресс и исход отдельной загрузки.
 *
 * Используется для:
 *  - контроля очереди нескольких файлов
 *  - исправления ошибок без потери остальных файлов
 */
export const UploadFile = (props: UploadFileProps): JSX.Element => {
  const { entry, canRemove, onRemove, onRequeue, onOpenImage } = props
  const [hasPreviewError, setHasPreviewError] = useState(false)
  const previewRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const preview = previewRef.current
    if (preview === null) return
    const url = URL.createObjectURL(entry.file)
    preview.src = url
    return () => URL.revokeObjectURL(url)
  }, [entry.file])
  const canRequeue = canRemove && (entry.status === 'failed' || entry.status === 'cancelled')
  const isUploading = entry.status === 'uploading'
  const isChecking = entry.status === 'checking' || entry.status === 'confirming'
  const isComplete = entry.status === 'done' || entry.status === 'reused'
  const statusLabel = getUploadStatusLabel(entry)
  const statusColor = isComplete ? 'var(--app-color-text-strong)' : 'dimmed'
  const hasResult = entry.imageId !== null
  const openLabel = `Открыть изображение ${entry.file.name}`
  /**
   * Открывает только подтверждённый сервером канонический ID.
   */
  const handleOpen = (): void => {
    if (entry.imageId !== null && canRemove) onOpenImage(entry.imageId)
  }

  return (
    <div className={styles.root}>
      <div className={styles.preview} aria-hidden="true">
        <img ref={previewRef} className={styles.previewImage} hidden={hasPreviewError} alt="" onError={() => setHasPreviewError(true)} />
        {hasPreviewError && (
          <IconPhotoOff size={24} />
        )}
      </div>
      <div className={styles.info}>
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text size="sm" fw={500} truncate title={entry.file.name}>{entry.file.name}</Text>
          {canRemove && (
            <ActionIcon variant="subtle" color="gray" onClick={() => onRemove(entry.id)} aria-label={`Убрать ${entry.file.name}`}>
              <IconX size={16} aria-hidden="true" />
            </ActionIcon>
          )}
        </Group>
        <Text size="xs" c="dimmed">{formatImageBytes(entry.file.size)}</Text>
        {hasPreviewError && (
          <Text size="xs" c="var(--app-color-text-strong)" mt={4} role="alert">Не удалось прочитать превью. Проверьте, что файл не повреждён.</Text>
        )}
        <Group gap={6} mt={4} wrap="nowrap">
          {isChecking && (
            <Loader size={12} aria-hidden="true" />
          )}
          <Text size="xs" c={statusColor} fw={500}>{statusLabel}</Text>
        </Group>
        {isUploading && (
          <Progress value={entry.progress} mt="xs" aria-label={`Загрузка ${entry.file.name}`} />
        )}
        {isDefined(entry.errorMessage) && (
          <Text size="xs" c="light-dark(var(--mantine-color-red-8), var(--mantine-color-red-3))" mt={4} role="alert">{entry.errorMessage}</Text>
        )}
        {canRequeue && (
          <Button size="xs" variant="subtle" mt={4} onClick={() => onRequeue(entry.id)}>
            Вернуть в очередь
          </Button>
        )}
        {hasResult && (
          <Button size="xs" variant="subtle" mt={4} onClick={handleOpen} disabled={!canRemove} aria-label={openLabel}>
            Открыть изображение
          </Button>
        )}
      </div>
    </div>
  )
}
