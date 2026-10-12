import { ActionIcon, Badge, CopyButton, Group, Text, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core'
import { IconCheck, IconCopy, IconDownload, IconExternalLink, IconFileDescription, IconFileTypePdf, IconInfoCircle } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { formatFileSize, getFileStatusLabel, getReadableFileUrl } from 'domains/files'
import type { FileRowProps } from './types/file-row-props.type'
import styles from './styles/file-row.module.css'

/**
 * Представляет документ строкой на широком экране и карточкой на узком.
 *
 * Используется для:
 *  - открытия документа и копирования постоянной ссылки
 *  - просмотра формата, автора и классификации
 */
export const FileRow = (props: FileRowProps): JSX.Element => {
  const { file, onOpen, className, ...rootAttrs } = props
  const FileIcon = file.extension === 'pdf' ? IconFileTypePdf : IconFileDescription
  const color = file.extension === 'pdf' ? 'red' : 'blue'
  const title = file.title || file.filename
  const formatLabel = file.extension || 'файл'
  const sizeLabel = formatFileSize(file.byteSize)
  const statusLabel = getFileStatusLabel(file.status)
  const isPending = file.status !== 'ready'
  const versionLabel = isPending ? statusLabel : `Текущая версия ${file.currentVersion}`
  const statusColor = file.status === 'expired' ? 'orange' : 'gray'
  const dateLabel = new Date(file.createdAt).toLocaleDateString('ru-RU')
  const authorLabel = file.uploadedBy.name || file.uploadedBy.login
  const openLabel = `Открыть ${file.filename}`
  const downloadLabel = `Скачать ${file.filename}`
  const detailsLabel = `Подробности ${file.filename}`
  const copyLabel = `Копировать ссылку на ${file.filename}`
  const url = file.url
  const copyUrl = url === null ? '' : getReadableFileUrl(url)
  const downloadUrl = file.downloadUrl

  return (
    <li {...rootAttrs} className={cl(styles.root, className)}>
      <div className={styles.identity}>
        <ThemeIcon size={44} radius="md" variant="light" color={color}><FileIcon size={25} /></ThemeIcon>
        <div className={styles.name}>
          <UnstyledButton className={styles.title} onClick={() => onOpen(file.id)} title={title}>{title}</UnstyledButton>
          <Text size="xs" c="dimmed">{versionLabel}</Text>
          <Group gap={5} mt={6}>
            <Badge size="xs" variant="light" color={color} c="var(--app-color-text-strong)">{formatLabel}</Badge>
            {isPending && (
              <Badge size="xs" color={statusColor} variant="light" c="var(--app-color-text-strong)">{statusLabel}</Badge>
            )}
            {file.tags.slice(0, 2).map((tag) => <Badge key={tag} size="xs" variant="outline" color="gray">{tag}</Badge>)}
          </Group>
        </div>
      </div>
      <Text className={styles.size} size="sm" c="dimmed">{sizeLabel}</Text>
      <Text className={styles.folder} size="sm" truncate title={file.folder ?? 'Без папки'}>{file.folder ?? 'Без папки'}</Text>
      <div className={styles.author}><Text size="xs" truncate title={authorLabel}>{authorLabel}</Text><Text size="xs" c="dimmed">{dateLabel}</Text></div>
      <Group className={styles.actions} gap={4} wrap="nowrap">
        {url !== null && (
          <>
            <Tooltip label="Открыть"><ActionIcon component="a" href={url} target="_blank" rel="noopener noreferrer" variant="subtle" color="gray" size="lg" aria-label={openLabel}><IconExternalLink size={18} /></ActionIcon></Tooltip>
            <CopyButton value={copyUrl}>
              {({ copied, copy }) => {
                const CopyIcon = copied ? IconCheck : IconCopy
                const label = copied ? 'Ссылка скопирована' : copyLabel
                const copyColor = copied ? 'teal' : 'gray'
                return <Tooltip label={label}><ActionIcon onClick={copy} variant="subtle" color={copyColor} size="lg" aria-label={label}><CopyIcon size={18} /></ActionIcon></Tooltip>
              }}
            </CopyButton>
          </>
        )}
        {downloadUrl !== null && (
          <Tooltip label="Скачать"><ActionIcon component="a" href={downloadUrl} target="_blank" rel="noopener noreferrer" variant="subtle" color="gray" size="lg" aria-label={downloadLabel}><IconDownload size={18} /></ActionIcon></Tooltip>
        )}
        <Tooltip label="Подробности"><ActionIcon onClick={() => onOpen(file.id)} variant="subtle" color="gray" size="lg" aria-label={detailsLabel}><IconInfoCircle size={18} /></ActionIcon></Tooltip>
      </Group>
    </li>
  )
}
