import { Alert, Badge, Button, Code, CopyButton, Divider, Drawer, Group, Skeleton, Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconCheck, IconCopy, IconDownload, IconExternalLink } from '@tabler/icons-react'
import type { JSX } from 'react'
import { formatFileSize, getFileStatusLabel, getReadableFileUrl } from 'domains/files'
import { FileClassification } from './ui/file-classification/file-classification'
import { FileVersions } from './ui/file-versions/file-versions'
import type { FileDetailsProps } from './types/file-details-props.type'
import styles from './styles/file-details.module.css'

/**
 * Показывает паспорт документа и редактирование его классификации.
 *
 * Используется для:
 *  - открытия PDF, скачивания и копирования постоянной ссылки
 *  - просмотра автора, размера и отпечатка содержимого
 */
export const FileDetails = (props: FileDetailsProps): JSX.Element => {
  const { file, isOpened, isLoading, errorMessage, facets, canUpdate, canUpload, onVersion, onClose, onRefresh, onSave } = props
  const shouldReduceMotion = useReducedMotion()
  const title = file?.title || file?.filename || 'Подробности файла'
  const formatLabel = file?.extension || 'файл'
  const isInitialLoading = isLoading && file === undefined
  const sizeLabel = formatFileSize(file?.byteSize ?? 0)
  const authorLabel = file?.uploadedBy.name || file?.uploadedBy.login || ''
  const dateLabel = file === undefined ? '' : new Date(file.createdAt).toLocaleString('ru-RU')
  const statusLabel = file === undefined ? '' : getFileStatusLabel(file.status)
  const isIncomplete = file !== undefined && file.status !== 'ready'
  const pendingText = file?.status === 'expired' ? 'Срок загрузки истёк. Добавьте документ через «Загрузить файлы».' : 'Файл ещё не подтверждён. Вернитесь в открытую очередь и повторите попытку; если очередь закрыта, добавьте файл заново.'
  const url = file?.url ?? null
  const copyUrl = url === null ? '' : getReadableFileUrl(url)
  const downloadUrl = file?.downloadUrl ?? null
  const canAddVersion = canUpload && file?.status === 'ready'
  const hasVersions = file !== undefined && file.currentVersion > 0
  const versionLabel = hasVersions ? `Текущая версия ${file.currentVersion}` : statusLabel

  return (
    <Drawer opened={isOpened} onClose={onClose} position="right" size="min(580px, 100%)" title="Подробности файла" closeButtonProps={{ 'aria-label': 'Закрыть подробности файла' }} transitionProps={{ duration: shouldReduceMotion ? 0 : 180 }}>
      <Stack className={styles.root} gap="lg">
        {isInitialLoading && (
          <><Skeleton height={90} /><Skeleton height={200} /></>
        )}
        {errorMessage !== undefined && (
          <Alert color="orange" title="Не удалось обновить документ" role="alert"><Text size="sm">{errorMessage}</Text><Button mt="sm" variant="light" color="orange" onClick={onRefresh}>Повторить</Button></Alert>
        )}
        {file !== undefined && (
          <>
            <div><Badge variant="light" mb="sm" c="var(--app-color-text-strong)">{formatLabel}</Badge><Text size="xl" fw={700} className={styles.title}>{title}</Text><Text size="sm" c="dimmed">{versionLabel}</Text></div>
            {isIncomplete && (
              <Alert color="orange" title={statusLabel}>{pendingText}</Alert>
            )}
            <Group gap="sm">
              {url !== null && (
                <>
                  <Button component="a" href={url} target="_blank" rel="noopener noreferrer" leftSection={<IconExternalLink size={16} />}>Открыть файл</Button>
                  <CopyButton value={copyUrl}>
                    {({ copied, copy }) => {
                      const CopyIcon = copied ? IconCheck : IconCopy
                      const label = copied ? 'Скопировано' : 'Копировать ссылку'
                      return <Button variant="default" onClick={copy} leftSection={<CopyIcon size={16} />}>{label}</Button>
                    }}
                  </CopyButton>
                </>
              )}
              {downloadUrl !== null && (
                <Button component="a" href={downloadUrl} target="_blank" rel="noopener noreferrer" variant="light" leftSection={<IconDownload size={16} />}>Скачать</Button>
              )}
            </Group>
            <dl className={styles.metadata}>
              <dt>Публичный ID</dt><dd><Code>{file.publicId}</Code></dd>
              <dt>Размер</dt><dd>{sizeLabel}</dd>
              <dt>Тип</dt><dd>{file.contentType}</dd>
              <dt>Загрузил</dt><dd>{authorLabel}</dd>
              <dt>Дата загрузки</dt><dd>{dateLabel}</dd>
              <dt>SHA-256</dt><dd className={styles.hash}>{file.sha256 ?? 'После подтверждения загрузки'}</dd>
            </dl>
            <Divider />
            <FileClassification file={file} facets={facets} canUpdate={canUpdate} onSave={onSave} />
            <Divider />
            {canAddVersion && (
              <div><Button fullWidth variant="light" onClick={onVersion}>Добавить новую версию</Button><Text size="xs" c="dimmed" mt="xs">Или перетащите новый файл на открытую панель документа.</Text></div>
            )}
            {hasVersions && (
              <FileVersions fileId={file.id} currentVersion={file.currentVersion} canUpdate={canUpdate} />
            )}
          </>
        )}
      </Stack>
    </Drawer>
  )
}
