import { Alert, Badge, Button, CopyButton, Divider, Drawer, Group, Skeleton, Stack, Text } from '@mantine/core'
import { IconCheck, IconCopy, IconDownload, IconRefresh } from '@tabler/icons-react'
import { useReducedMotion } from '@mantine/hooks'
import { useState } from 'react'
import type { JSX } from 'react'
import { ImagePreview, formatImageBytes, getImageDimensions, getImageErrorMessage,
  getImagePreviewVariants, getImageStatusLabel, isImageError,
  canRetryImageProcessing, canDownloadImageOriginal, getImageFailureDescription } from 'domains/images'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import { ImageClassification } from './ui/image-classification/image-classification'
import { ImageVariants } from './ui/image-variants/image-variants'
import type { ImageDetailsProps } from './types/image-details-props.type'
import styles from './styles/image-details.module.css'

/**
 * Собирает подробный паспорт изображения в адаптивной панели.
 *
 * Используется для:
 *  - просмотра автора, оригинала и готовых производных
 *  - изменения классификации и повтора обработки
 */
export const ImageDetails = (props: ImageDetailsProps): JSX.Element => {
  const { image, isOpened, isLoading, errorMessage, facets, canUpdate, canRetry,
    onClose, onRefresh, onSave, onRetry, onOriginal } = props
  const [actionError, setActionError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const title = image?.title || image?.filename || 'Подробности изображения'
  const previewVariants = image === undefined ? [] : getImagePreviewVariants(image)
  const publicUrl = previewVariants.at(-1)?.url
  const isFailed = image?.status === 'failed'
  const canRetryFailed = image !== undefined && canRetry && canRetryImageProcessing(image)
  const canDownload = image !== undefined && canDownloadImageOriginal(image)
  const failureDescription = image === undefined ? '' : getImageFailureDescription(image)
  const variantsDescription = canDownload
    ? 'Оригинал хранится отдельно. Доступные размеры подготовлены без увеличения исходника.'
    : 'Производные файлы доступны только после завершённой загрузки и обработки.'
  const hasImage = image !== undefined
  const shouldShowInitialLoading = isLoading && !hasImage
  const shouldShowInitialError = errorMessage !== undefined && !hasImage
  const shouldShowRefreshWarning = errorMessage !== undefined && hasImage
  const authorLabel = image?.uploadedBy.name || image?.uploadedBy.login || 'Неизвестный автор'
  const realmLabel = image?.uploadedBy.realm === 'admin' ? 'Администратор' : 'Пользователь приложения'
  const createdAt = image === undefined ? '' : new Date(image.createdAt).toLocaleString('ru-RU')
  const updatedAt = image === undefined ? '' : new Date(image.updatedAt).toLocaleString('ru-RU')
  const dimensions = image === undefined ? '' : getImageDimensions(image)
  const originalBytes = formatImageBytes(image?.original.byteSize ?? 0)
  const statusLabel = image === undefined ? '' : getImageStatusLabel(image.status)
  const statusColor = isFailed ? 'red' : 'blue'
  /**
   * Показывает ожидаемый исход либо регистрирует неожиданный сбой действия.
   */
  const handleActionError = (error: unknown): void => {
    if (isImageError(error)) {
      setActionError(getImageErrorMessage(error))
      return
    }
    reportApplicationDefect(toApplicationDefect('images.details', error))
    setActionError('Действие не завершено. Повторите попытку.')
  }
  /**
   * Запрашивает приватный исходник только по явному действию пользователя.
   */
  const handleDownload = async (): Promise<void> => {
    if (image === undefined || isDownloading) return
    setIsDownloading(true)
    setActionError(null)
    try {
      const url = await onOriginal(image.id)
      const link = document.createElement('a')
      link.href = url
      link.download = image.filename
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
    } catch (error) {
      handleActionError(error)
    } finally {
      setIsDownloading(false)
    }
  }
  /**
   * Повторяет исходное задание после явного действия.
   */
  const handleRetry = async (): Promise<void> => {
    if (image === undefined || !canRetry || isRetrying) return
    setIsRetrying(true)
    setActionError(null)
    try {
      await onRetry(image.id)
    } catch (error) {
      handleActionError(error)
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Drawer
      opened={isOpened}
      onClose={onClose}
      position="right"
      size="min(720px, 100%)"
      title={<Text fw={700} truncate maw="65vw">{title}</Text>}
      padding="lg"
      closeButtonProps={{ 'aria-label': 'Закрыть подробности' }}
      classNames={{ body: styles.root }}
      transitionProps={{ duration: shouldReduceMotion ? 0 : 180 }}
    >
      {shouldShowInitialLoading && (
        <Stack><Skeleton height={300} /><Skeleton height={100} /><Skeleton height={200} /></Stack>
      )}
      {shouldShowInitialError && (
        <Alert color="red" title="Не удалось загрузить подробности">
          <Text size="sm">{errorMessage}</Text>
          <Button variant="light" mt="sm" onClick={onRefresh}>Повторить</Button>
        </Alert>
      )}
      {shouldShowRefreshWarning && (
        <Alert color="orange" title="Не удалось обновить данные" mb="md">
          <Text size="sm">{errorMessage} Введённые изменения сохранены в форме.</Text>
          <Button variant="light" size="xs" mt="xs" onClick={onRefresh}>Обновить</Button>
        </Alert>
      )}
      {hasImage && isDefined(image) && (
        <Stack gap="lg">
          <div className={styles.preview}>
            <ImagePreview image={image} isContained sizes="(min-width: 720px) 660px, 100vw" />
          </div>
          <Group justify="space-between">
            <Badge color={statusColor} variant="light" c="var(--app-color-text-strong)">{statusLabel}</Badge>
          </Group>
          <Group gap="xs">
            <Button variant="subtle" onClick={onRefresh} leftSection={<IconRefresh size={17} />}>
              Обновить подробности
            </Button>
            {canDownload && (
              <Button variant="light" leftSection={<IconDownload size={17} />} loading={isDownloading} onClick={handleDownload}>
                Скачать оригинал
              </Button>
            )}
            {isDefined(publicUrl) && (
              <CopyButton value={publicUrl}>
                {({ copied, copy }) => {
                  const label = copied ? 'Скопировано' : 'Копировать URL'
                  const CopyIcon = copied ? IconCheck : IconCopy
                  return <Button variant="default" leftSection={<CopyIcon size={17} />} onClick={copy}>{label}</Button>
                }}
              </CopyButton>
            )}
          </Group>
          {isFailed && (
            <Alert color="red" title="Изображение не обработано">
              <Text size="sm">{failureDescription}</Text>
              {canRetryFailed && (
                <Button mt="sm" size="xs" color="red" variant="light" loading={isRetrying} onClick={handleRetry} leftSection={<IconRefresh size={15} />}>
                  Повторить обработку
                </Button>
              )}
            </Alert>
          )}
          {isDefined(actionError) && (
            <Alert color="red" role="alert">{actionError}</Alert>
          )}
          <dl className={styles.metadata}>
            <div><dt className={styles.metadataLabel}>Загрузил</dt><dd className={styles.metadataValue}>{authorLabel}<Text size="xs" c="dimmed">{realmLabel} · {image.uploadedBy.login}</Text></dd></div>
            <div><dt className={styles.metadataLabel}>Дата загрузки</dt><dd className={styles.metadataValue}>{createdAt}</dd></div>
            <div><dt className={styles.metadataLabel}>Исходный файл</dt><dd className={styles.metadataValue}>{image.filename}</dd></div>
            <div><dt className={styles.metadataLabel}>Размеры и вес</dt><dd className={styles.metadataValue}>{dimensions} · {originalBytes}</dd></div>
            <div><dt className={styles.metadataLabel}>Тип оригинала</dt><dd className={styles.metadataValue}>{image.original.contentType}</dd></div>
            <div><dt className={styles.metadataLabel}>Обновлено</dt><dd className={styles.metadataValue}>{updatedAt}</dd></div>
            <div className={styles.identifier}><dt className={styles.metadataLabel}>Идентификатор</dt><dd className={styles.metadataValue}>{image.id}</dd></div>
          </dl>
          <Divider label="Классификация" labelPosition="left" />
          <ImageClassification key={image.id} image={image} facets={facets} canUpdate={canUpdate} onSave={onSave} />
          <Divider label="Форматы и размеры" labelPosition="left" />
          <Text size="xs" c="dimmed">{variantsDescription}</Text>
          <ImageVariants key={`variants-${image.id}`} variants={image.variants} />
        </Stack>
      )}
    </Drawer>
  )
}
