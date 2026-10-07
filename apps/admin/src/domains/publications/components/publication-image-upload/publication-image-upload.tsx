import {
  isDefined,
  isEmptyArray,
  isNonEmptyString,
  isNotDefined,
  isNumber
} from '@biocad/value-predicates'
import { ActionIcon, Alert, Image, Progress, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core'
import { IconAlertTriangle, IconPhotoUp, IconX } from '@tabler/icons-react'
import { NodeViewWrapper } from '@tiptap/react'
import { useContext, useEffect, useRef, useState } from 'react'

import { PublicationArtifactsContext } from '../../context/publication-artifacts.context'
import { isPublicationError } from '../../errors/publication.error'
import type { PublicationImageUploadProps } from './types/publication-image-upload-props.type'
import styles from './styles/publication-image-upload.module.css'

/**
 * Состояние одной временной области загрузки.
 */
type UploadStatus = 'idle' | 'uploading' | 'error'

/**
 * Форматирует размер выбранного файла для upload preview.
 */
const formatFileSize = (size: number): string => {
  return `${(size / 1024 / 1024).toFixed(1)} МБ`
}

/**
 * Получает доступный alt из имени файла до редакторской настройки изображения.
 */
const getImageAlt = (file: File): string => {
  const filename = file.name.replace(/\.[^/.]+$/, '').trim()

  return isNonEmptyString(filename) ? filename : 'Изображение публикации'
}

/**
 * Нормализует ошибку upload flow для локального node UI.
 */
const getUploadErrorMessage = (error: unknown): string => {
  if (isPublicationError(error)) {
    return error.message
  }

  return 'Не удалось загрузить изображение. Попробуйте другой файл.'
}

/**
 * Загружает изображение прямо в документ с drag-and-drop, preview и реальным progress.
 *
 * Используется для:
 *  - временного upload node в позиции курсора
 *  - атомарной замены completed upload на канонический artifactImage
 */
export const PublicationImageUpload = (props: PublicationImageUploadProps) => {
  const { deleteNode, editor, getPos, node } = props
  const { uploadImage } = useContext(PublicationArtifactsContext)
  const inputRef = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [isDragActive, setIsDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const accept = typeof node.attrs.accept === 'string' ? node.attrs.accept : 'image/*'
  const maxSize = isNumber(node.attrs.maxSize) ? node.attrs.maxSize : 0
  const isUploading = status === 'uploading'
  const hasFile = isDefined(file) && isDefined(previewUrl)
  const maxSizeLabel = formatFileSize(maxSize)

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()

      if (isDefined(previewUrlRef.current)) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  /**
   * Открывает системный file picker для текущего upload node.
   */
  const handleOpenFilePicker = (): void => {
    if (!isUploading) {
      inputRef.current?.click()
    }
  }

  /**
   * Загружает выбранный файл и заменяет временный node на artifactImage.
   */
  const handleUpload = async (selectedFile: File): Promise<void> => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    if (isDefined(previewUrlRef.current)) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile)
    previewUrlRef.current = nextPreviewUrl
    setFile(selectedFile)
    setPreviewUrl(nextPreviewUrl)
    setProgress(0)
    setErrorMessage(null)
    setStatus('uploading')

    try {
      const artifact = await uploadImage(selectedFile, {
        onProgress: setProgress,
        signal: controller.signal
      })
      const position = getPos()

      if (controller.signal.aborted || !isNumber(position)) {
        return
      }

      editor
        .chain()
        .focus()
        .deleteRange({ from: position, to: position + node.nodeSize })
        .insertContentAt(position, {
          attrs: {
            alt: getImageAlt(selectedFile),
            artifactId: artifact.id,
            caption: null
          },
          type: 'artifactImage'
        })
        .setNodeSelection(position)
        .run()
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMessage(getUploadErrorMessage(error))
        setStatus('error')
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
      }
    }
  }

  /**
   * Передаёт первый файл из browser picker в upload flow.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = event.currentTarget.files?.item(0)
    event.currentTarget.value = ''

    if (isNotDefined(selectedFile)) {
      return
    }

    void handleUpload(selectedFile)
  }

  /**
   * Активирует визуальное состояние drag-and-drop.
   */
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()

    if (!isUploading) {
      setIsDragActive(true)
    }
  }

  /**
   * Сбрасывает визуальное состояние drag-and-drop.
   */
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragActive(false)
  }

  /**
   * Передаёт первый dropped file в upload flow.
   */
  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragActive(false)
    const droppedFiles = Array.from(event.dataTransfer.files)

    if (!isUploading && !isEmptyArray(droppedFiles)) {
      void handleUpload(droppedFiles[0])
    }
  }

  /**
   * Поддерживает активацию dropzone с клавиатуры.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenFilePicker()
    }
  }

  /**
   * Отменяет активную загрузку и удаляет временный node.
   */
  const handleCancel = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    controllerRef.current?.abort()
    deleteNode()
  }

  return (
    <NodeViewWrapper className={styles.root} contentEditable={false}>
      <div
        aria-disabled={isUploading}
        className={styles.dropArea}
        data-drag-active={isDragActive || undefined}
        role="button"
        tabIndex={0}
        onClick={handleOpenFilePicker}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
      >
        {!hasFile && (
          <Stack align="center" gap="xs">
            <ThemeIcon radius="xl" size="xl" variant="light">
              <IconPhotoUp size={24} />
            </ThemeIcon>
            <Text fw={600} size="sm">
              Нажмите для загрузки или перетащите изображение
            </Text>
            <Text c="dimmed" size="xs">
              JPEG, PNG или WebP, не более {maxSizeLabel}
            </Text>
          </Stack>
        )}

        {hasFile && (
          <div className={styles.preview}>
            <Image alt="Предпросмотр загружаемого изображения" className={styles.previewImage} src={previewUrl} />
            <div className={styles.previewDetails}>
              <Text className={styles.fileName} fw={600} size="sm">
                {file.name}
              </Text>
              <Text c="dimmed" size="xs">
                {formatFileSize(file.size)}
              </Text>
              {isUploading && (
                <Stack gap={4} mt="xs">
                  <Progress animated radius="xl" size="sm" striped value={progress} />
                  <Text c="dimmed" size="xs">
                    Загружаем и проверяем изображение: {progress}%
                  </Text>
                </Stack>
              )}
            </div>
          </div>
        )}

        <Tooltip label="Отменить загрузку">
          <ActionIcon
            aria-label="Отменить загрузку изображения"
            className={styles.cancelButton}
            type="button"
            variant="subtle"
            onClick={handleCancel}
          >
            <IconX size={18} />
          </ActionIcon>
        </Tooltip>
      </div>

      {isNonEmptyString(errorMessage) && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} mt="xs" title="Загрузка не выполнена">
          {errorMessage} Нажмите на область выше, чтобы выбрать файл повторно.
        </Alert>
      )}

      <input
        ref={inputRef}
        accept={accept}
        aria-label="Выбрать изображение"
        className={styles.fileInput}
        type="file"
        onChange={handleFileChange}
      />
    </NodeViewWrapper>
  )
}
