import { ActionIcon, Alert, Badge, Button, CopyButton, Group, Skeleton, Stack, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconDownload, IconExternalLink } from '@tabler/icons-react'
import { useRef, useState } from 'react'
import type { JSX } from 'react'
import { formatFileSize, getFileErrorMessage, getReadableFileUrl, isFileError, useFileActions, useGetFileVersions } from 'domains/files'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import type { FileVersionsProps } from './types/file-versions-props.type'
import styles from './styles/file-versions.module.css'

/**
 * Показывает историю документа и выбор версии для постоянной ссылки.
 *
 * Используется для:
 *  - открытия, скачивания и копирования исторических версий
 *  - переключения текущей версии без изменения постоянной ссылки
 */
export const FileVersions = (props: FileVersionsProps): JSX.Element => {
  const { fileId, currentVersion, canUpdate } = props
  const query = useGetFileVersions(fileId)
  const actions = useFileActions()
  const [pendingVersion, setPendingVersion] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const isSwitchingRef = useRef(false)
  const isSwitching = pendingVersion !== null
  const successMessage = selectedVersion === currentVersion
    ? `Версия ${selectedVersion} выбрана текущей. Постоянная ссылка не изменилась.`
    : null
  const versionItems = (query.data ?? []).map((version) => ({
    ...version,
    copyUrl: getReadableFileUrl(version.url),
    isCurrent: version.number === currentVersion,
    isPending: version.number === pendingVersion,
    isDisabled: isSwitching || version.number === currentVersion,
    selectLabel: `Сделать версию ${version.number} текущей`,
    selectText: version.number === currentVersion ? 'Текущая версия' : 'Сделать текущей',
    description: `${formatFileSize(version.byteSize)} · ${new Date(version.createdAt).toLocaleString('ru-RU')}`,
    authorLabel: version.uploadedBy.name || version.uploadedBy.login,
    openLabel: `Открыть версию ${version.number}`,
    copyLabel: `Копировать ссылку на версию ${version.number}`,
    downloadLabel: `Скачать версию ${version.number}`
  }))
  /**
   * Выбирает версию и сохраняет историю доступной при исправимой ошибке.
   */
  const handleSelectVersion = async (number: number): Promise<void> => {
    if (isSwitchingRef.current || !canUpdate || number === currentVersion) return
    isSwitchingRef.current = true
    setPendingVersion(number)
    setErrorMessage(null)
    setSelectedVersion(null)
    try {
      await actions.setCurrentVersion(fileId, number)
      setSelectedVersion(number)
    } catch (error) {
      if (!isFileError(error)) reportApplicationDefect(toApplicationDefect('files.set-current-version', error))
      setErrorMessage(getFileErrorMessage(error))
    } finally {
      isSwitchingRef.current = false
      setPendingVersion(null)
    }
  }
  if (query.isLoading) return <Skeleton height={100} aria-label="Загружаем версии" />
  if (query.error !== undefined) return <Alert color="orange" role="alert">{getFileErrorMessage(query.error)}<Button variant="light" mt="sm" onClick={() => { void query.mutate() }}>Обновить версии</Button></Alert>

  return (
    <Stack className={styles.root} gap="sm">
      <Text fw={600}>История версий</Text>
      <Text size="xs" c="dimmed">Постоянная ссылка открывает текущую версию и не меняется при переключении. Ссылки в истории закреплены за конкретными версиями.</Text>
      {errorMessage !== null && (
        <Alert color="red" role="alert">{errorMessage}</Alert>
      )}
      {successMessage !== null && (
        <Text size="sm" role="status">{successMessage}</Text>
      )}
      {versionItems.map((version) => (
        <div key={version.id} className={styles.version}>
          <Group gap="xs"><Text size="sm" fw={600}>Версия {version.number}</Text>
            {version.isCurrent && (
              <Badge size="xs" variant="light" c="var(--app-color-text-strong)">Текущая</Badge>
            )}
          </Group>
          <Text size="sm" className={styles.filename}>{version.filename}</Text>
          <Text size="xs" c="dimmed">{version.description}</Text>
          <Text size="xs" c="dimmed">{version.authorLabel}</Text>
          <Group gap={4} mt="xs">
            <Tooltip label={version.openLabel}><ActionIcon component="a" href={version.url} target="_blank" rel="noopener noreferrer" variant="default" size="lg" aria-label={version.openLabel}><IconExternalLink size={17} /></ActionIcon></Tooltip>
            <CopyButton value={version.copyUrl}>
              {({ copied, copy }) => {
                const CopyIcon = copied ? IconCheck : IconCopy
                const label = copied ? 'Ссылка версии скопирована' : version.copyLabel
                return <Tooltip label={label}><ActionIcon onClick={copy} variant="default" size="lg" aria-label={label}><CopyIcon size={17} /></ActionIcon></Tooltip>
              }}
            </CopyButton>
            <Tooltip label={version.downloadLabel}><ActionIcon component="a" href={version.downloadUrl} target="_blank" rel="noopener noreferrer" variant="default" size="lg" aria-label={version.downloadLabel}><IconDownload size={17} /></ActionIcon></Tooltip>
          </Group>
          {canUpdate && (
            <Button
              mt="sm"
              size="xs"
              variant="light"
              disabled={version.isDisabled}
              loading={version.isPending}
              aria-label={version.selectLabel}
              onClick={() => { void handleSelectVersion(version.number) }}
            >
              {version.selectText}
            </Button>
          )}
        </div>
      ))}
    </Stack>
  )
}
