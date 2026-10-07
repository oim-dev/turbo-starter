import { isNonEmptyString, isString } from '@biocad/value-predicates'
import {
  ActionIcon,
  Alert,
  Button,
  FileButton,
  Group,
  LoadingOverlay,
  Modal,
  Progress,
  Stack,
  Text,
  Textarea,
  Tooltip
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconGripVertical,
  IconPhotoEdit,
  IconRefresh,
  IconTrash
} from '@tabler/icons-react'
import { NodeViewWrapper } from '@tiptap/react'
import cl from 'clsx'
import { useContext, useEffect, useRef, useState } from 'react'

import { PublicationArtifactsContext } from '../../context/publication-artifacts.context'
import { isPublicationError } from '../../errors/publication.error'
import type { PublicationArtifactImageProps } from './types/publication-artifact-image-props.type'
import styles from './styles/publication-artifact-image.module.css'

/**
 * Нормализует ошибку замены изображения для node settings UI.
 */
const getReplacementErrorMessage = (error: unknown): string => {
  if (isPublicationError(error)) {
    return error.message
  }

  return 'Не удалось заменить изображение. Попробуйте другой файл.'
}

/**
 * Отображает artifactImage через browser-resolved delivery URL.
 *
 * Используется для:
 *  - runtime node view единой rich-text schema
 *  - доступного preview загруженного изображения
 */
export const PublicationArtifactImage = (props: PublicationArtifactImageProps) => {
  const { deleteNode, node, selected, updateAttributes } = props
  const { artifactsById, uploadImage } = useContext(PublicationArtifactsContext)
  const replaceControllerRef = useRef<AbortController | null>(null)
  const [isSettingsOpened, setIsSettingsOpened] = useState(false)
  const [isReplacing, setIsReplacing] = useState(false)
  const [replacementProgress, setReplacementProgress] = useState(0)
  const [replacementError, setReplacementError] = useState<string | null>(null)
  const artifactId = isString(node.attrs.artifactId) ? node.attrs.artifactId : ''
  const alt = isString(node.attrs.alt) ? node.attrs.alt : ''
  const caption = isString(node.attrs.caption) ? node.attrs.caption : null
  const [altDraft, setAltDraft] = useState(alt)
  const [captionDraft, setCaptionDraft] = useState(caption ?? '')
  const artifact = artifactsById.get(artifactId)
  const imageUrl = artifact?.url
  const hasImage = isNonEmptyString(imageUrl)
  const hasCaption = isNonEmptyString(caption)
  const placeholderLabel = isNonEmptyString(alt) ? alt : 'Изображение недоступно'
  const canSaveSettings = isNonEmptyString(altDraft) && !isReplacing

  useEffect(() => {
    return () => {
      replaceControllerRef.current?.abort()
      replaceControllerRef.current = null
    }
  }, [])

  /**
   * Открывает настройки с актуальными атрибутами выбранного node.
   */
  const handleOpenSettings = (): void => {
    setAltDraft(alt)
    setCaptionDraft(caption ?? '')
    setReplacementError(null)
    setIsSettingsOpened(true)
  }

  /**
   * Закрывает настройки, если замена файла не выполняется.
   */
  const handleCloseSettings = (): void => {
    if (!isReplacing) {
      setIsSettingsOpened(false)
    }
  }

  /**
   * Сохраняет доступный alt и необязательную редакционную подпись.
   */
  const handleSaveSettings = (): void => {
    if (!canSaveSettings) {
      return
    }

    const nextCaption = captionDraft.trim()
    updateAttributes({
      alt: altDraft.trim(),
      caption: isNonEmptyString(nextCaption) ? nextCaption : null
    })
    setIsSettingsOpened(false)
  }

  /**
   * Загружает новый artifact и сохраняет текстовые атрибуты текущего node.
   */
  const handleReplaceImage = async (file: File | null): Promise<void> => {
    if (!file) {
      return
    }

    replaceControllerRef.current?.abort()
    const controller = new AbortController()
    replaceControllerRef.current = controller
    setReplacementError(null)
    setReplacementProgress(0)
    setIsReplacing(true)

    try {
      const replacementArtifact = await uploadImage(file, {
        onProgress: setReplacementProgress,
        signal: controller.signal
      })

      if (!controller.signal.aborted) {
        updateAttributes({ artifactId: replacementArtifact.id })
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setReplacementError(getReplacementErrorMessage(error))
      }
    } finally {
      if (replaceControllerRef.current === controller) {
        replaceControllerRef.current = null
        setIsReplacing(false)
      }
    }
  }

  /**
   * Удаляет выбранный image node; изменение остаётся доступным через editor undo.
   */
  const handleDelete = (): void => {
    deleteNode()
  }

  /**
   * Не даёт ProseMirror снять node selection до выполнения toolbar action.
   */
  const handleToolbarActionMouseDown = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
  }

  return (
    <NodeViewWrapper className={styles.root} data-selected={selected || undefined}>
      <figure className={styles.figure} contentEditable={false} onDoubleClick={handleOpenSettings}>
        {hasImage && (
          <img
            alt={alt}
            className={styles.image}
            height={artifact?.height ?? undefined}
            src={imageUrl}
            width={artifact?.width ?? undefined}
          />
        )}
        {!hasImage && (
          <div className={styles.placeholder} role="img" aria-label={placeholderLabel}>
            Изображение недоступно
          </div>
        )}
        {hasCaption && <figcaption className={styles.caption}>{caption}</figcaption>}

        {selected && (
          <Group className={styles.nodeToolbar} gap={4} wrap="nowrap">
            <Tooltip label="Перетащить изображение">
              <ActionIcon
                aria-label="Перетащить изображение"
                className={styles.dragHandle}
                data-drag-handle
                type="button"
                variant="subtle"
              >
                <IconGripVertical size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Настроить изображение">
              <ActionIcon
                aria-label="Настроить изображение"
                type="button"
                variant="subtle"
                onMouseDown={handleToolbarActionMouseDown}
                onClick={handleOpenSettings}
              >
                <IconPhotoEdit size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Удалить изображение">
              <ActionIcon
                aria-label="Удалить изображение"
                color="red"
                type="button"
                variant="subtle"
                onMouseDown={handleToolbarActionMouseDown}
                onClick={handleDelete}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </figure>

      <Modal
        centered
        closeOnClickOutside={!isReplacing}
        closeOnEscape={!isReplacing}
        opened={isSettingsOpened}
        size="lg"
        title="Настройки изображения"
        withCloseButton={!isReplacing}
        onClose={handleCloseSettings}
      >
        <Stack>
          <div className={styles.settingsPreview}>
            <LoadingOverlay visible={isReplacing} />
            {hasImage && <img alt={alt} className={cl(styles.image, styles.settingsImage)} src={imageUrl} />}
            {!hasImage && (
              <div className={styles.placeholder} role="img" aria-label={placeholderLabel}>
                Изображение недоступно
              </div>
            )}
          </div>

          {isReplacing && (
            <Stack gap={4}>
              <Progress animated radius="xl" striped value={replacementProgress} />
              <Text c="dimmed" size="xs">
                Загружаем и проверяем новый файл: {replacementProgress}%
              </Text>
            </Stack>
          )}

          {isNonEmptyString(replacementError) && (
            <Alert color="red" icon={<IconAlertTriangle size={18} />}>
              {replacementError}
            </Alert>
          )}

          <Textarea
            required
            autosize
            description="Кратко опишите смысл изображения для читателей экранных дикторов."
            label="Альтернативный текст"
            maxLength={500}
            minRows={2}
            value={altDraft}
            onChange={event => setAltDraft(event.currentTarget.value)}
          />
          <Textarea
            autosize
            description="Будет показана под изображением в публикации."
            label="Подпись"
            maxLength={500}
            minRows={2}
            value={captionDraft}
            onChange={event => setCaptionDraft(event.currentTarget.value)}
          />

          <Group className={styles.settingsActions}>
            <FileButton
              accept="image/jpeg,image/png,image/webp"
              disabled={isReplacing}
              onChange={file => void handleReplaceImage(file)}
            >
              {fileButtonProps => (
                <Button {...fileButtonProps} leftSection={<IconRefresh size={16} />} variant="default">
                  Заменить файл
                </Button>
              )}
            </FileButton>
            <Button type="button" variant="default" onClick={handleCloseSettings}>
              Отмена
            </Button>
            <Button disabled={!canSaveSettings} type="button" onClick={handleSaveSettings}>
              Сохранить настройки
            </Button>
          </Group>
        </Stack>
      </Modal>
    </NodeViewWrapper>
  )
}
