import { isDefined, isNonEmptyString, isNotDefined } from '@biocad/value-predicates'
import { Alert, Button, Text } from '@mantine/core'
import { IconAlertTriangle, IconPhoto, IconTrash } from '@tabler/icons-react'
import cl from 'clsx'
import { useRef, useState } from 'react'

import { isPublicationError } from '../../errors/publication.error'
import { usePublicationImageUpload } from '../../hooks/use-publication-image-upload.hook'
import type { PublicationCoverFieldProps } from './types/publication-cover-field-props.type'
import styles from './styles/publication-cover-field.module.css'

/**
 * Загружает и выбирает completed media artifact для обложки.
 *
 * Используется для:
 *  - preview текущей обложки
 *  - прямой загрузки файла через infra adapter
 */
export const PublicationCoverField = (props: PublicationCoverFieldProps) => {
  const { alt, value, onChange, className, ...rootAttrs } = props
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const imageUpload = usePublicationImageUpload()
  const previewUrl = value?.url
  const normalizedAlt = alt.trim()
  const artifactAlt = value?.alt
  const previewAlt = isNonEmptyString(normalizedAlt)
    ? normalizedAlt
    : isNonEmptyString(artifactAlt)
      ? artifactAlt
      : 'Предпросмотр обложки'
  const hasPreview = isNonEmptyString(previewUrl)
  const canUpload = isDefined(file) && !imageUpload.isPending
  const fileLabel = isDefined(file) ? file.name : 'JPEG, PNG или WebP до 10 МБ'
  const fileLabelColor = isDefined(file) ? undefined : 'dimmed'
  const errorMessage = isPublicationError(imageUpload.error)
    ? imageUpload.error.message
    : 'Не удалось загрузить обложку.'

  /**
   * Выбирает обложку только после успешного complete шага Admin API.
   */
  const handleUpload = async (): Promise<void> => {
    if (isNotDefined(file)) {
      return
    }

    try {
      const artifact = await imageUpload.mutateAsync(file)
      onChange(artifact)
      setFile(null)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch {
      // Mutation state отображает нормализованную доменную ошибку.
    }
  }

  /**
   * Синхронизирует выбранный native File с upload state поля.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    imageUpload.reset()
    setFile(event.currentTarget.files?.item(0) ?? null)
  }

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <Text fw={500} size="sm">
        Обложка
      </Text>
      {hasPreview && (
        <img
          alt={previewAlt}
          className={styles.preview}
          height={value?.height ?? undefined}
          src={previewUrl}
          width={value?.width ?? undefined}
        />
      )}
      <div className={styles.fileField}>
        <Text fw={500} size="sm">
          Файл обложки
        </Text>
        <div className={styles.filePicker} data-disabled={imageUpload.isPending || undefined}>
          <IconPhoto aria-hidden className={styles.filePickerIcon} size={16} />
          <Text className={styles.filePickerLabel} c={fileLabelColor} size="sm">
            {fileLabel}
          </Text>
          <input
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            aria-label="Файл обложки"
            className={styles.fileInput}
            disabled={imageUpload.isPending}
            type="file"
            onChange={handleFileChange}
          />
        </div>
      </div>
      {imageUpload.isError && (
        <Alert color="red" icon={<IconAlertTriangle />}>
          {errorMessage}
        </Alert>
      )}
      <div className={styles.actions}>
        <Button
          disabled={!canUpload}
          loading={imageUpload.isPending}
          size="xs"
          type="button"
          variant="light"
          onClick={() => void handleUpload()}
        >
          Загрузить обложку
        </Button>
        {value && (
          <Button
            color="red"
            leftSection={<IconTrash size={14} />}
            size="xs"
            type="button"
            variant="subtle"
            onClick={() => onChange(null)}
          >
            Удалить
          </Button>
        )}
      </div>
    </div>
  )
}
