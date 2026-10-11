import { Alert, Autocomplete, Button, FileButton, Fieldset, Group, Modal, Stack, TagsInput, Text, ThemeIcon } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useReducedMotion } from '@mantine/hooks'
import { IconCheck, IconCloudUpload, IconPlus } from '@tabler/icons-react'
import cl from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { getImageErrorMessage, isImageError } from 'domains/images'
import { useNativeFileDrop } from 'infra/native-file-drop'
import type { NativeFileDrop } from 'infra/native-file-drop'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined, isEmptyArray } from 'shared/value-predicates'
import { UploadFile } from './ui/upload-file/upload-file'
import { formatUploadAction } from './helpers/format-upload-action'
import { prepareUploadSelection } from './helpers/prepare-upload-selection'
import type { UploadEntry } from './types/upload-entry.type'
import type { ImageUploadProps } from './types/image-upload-props.type'
import type { ImageUploadForm } from './types/image-upload-form.type'
import styles from './styles/image-upload.module.css'

/**
 * Управляет очередью локальных файлов и их загрузкой с общей классификацией.
 *
 * Используется для:
 *  - добавления файлов с устройства и перетаскиванием
 *  - показа индивидуального прогресса и результата передачи
 */
export const ImageUpload = (props: ImageUploadProps): JSX.Element => {
  const { isOpened, initialBatch, initialFolder, facets, onClose, onUpload, onUploaded } = props
  const [initialSelection] = useState(() => prepareUploadSelection(initialBatch))
  const [entries, setEntries] = useState<UploadEntry[]>(initialSelection.entries)
  const [selectionError, setSelectionError] = useState<string | null>(() => {
    const isButtonOpen = isEmptyArray(initialBatch.files) && initialBatch.directoryCount === 0
    return isButtonOpen ? null : initialSelection.errorMessage
  })
  const activeController = useRef<AbortController | null>(null)
  const fileButtonReset = useRef<() => void>(null)
  const shouldReduceMotion = useReducedMotion()
  const form = useForm<ImageUploadForm>({
    mode: 'uncontrolled',
    initialValues: { folder: initialFolder ?? '', tags: [] },
    validateInputOnBlur: true,
    validate: {
      folder: (folder) => folder.length > 255 ? 'Не более 255 символов' : null,
      tags: (tags) => tags.length > 20 || tags.some((tag) => tag.length > 64)
        ? 'Не более 20 тегов по 64 символа' : null
    }
  })
  const folders = facets?.folders.map((folder) => folder.name) ?? []
  const tags = facets?.tags.map((tag) => tag.name) ?? []
  const hasFiles = !isEmptyArray(entries)
  const hasPendingFiles = entries.some((entry) => entry.status === 'waiting')
  const completedCount = entries.filter((entry) => entry.status === 'done').length
  const hasCompleted = completedCount > 0
  const canSubmit = hasPendingFiles && !form.submitting
  const buttonLabel = formatUploadAction(entries.filter((entry) => entry.status === 'waiting').length)

  useEffect(() => {
    return () => activeController.current?.abort()
  }, [])

  /**
   * Добавляет валидную часть пачки без сброса очереди и классификации.
   */
  const handleFileDrop = (batch: NativeFileDrop): void => {
    if (form.submitting || activeController.current !== null) {
      setSelectionError('Сейчас идёт передача. Дождитесь её завершения или нажмите «Остановить загрузку», затем добавьте файлы снова.')
      return
    }
    const selection = prepareUploadSelection(batch)
    setSelectionError(selection.errorMessage)
    setEntries((current) => [...current, ...selection.entries])
    fileButtonReset.current?.()
  }
  /**
   * Объединяет файловый диалог и drop в один способ дополнения очереди.
   */
  const handleAddFiles = (files: File[]): void => handleFileDrop({ files, directoryCount: 0 })
  const isDragging = useNativeFileDrop({ isEnabled: isOpened, canDrop: !form.submitting, onDrop: handleFileDrop })
  const dropLabel = form.submitting
    ? 'Добавление файлов — после завершения передачи'
    : isDragging ? 'Отпустите файлы, чтобы добавить в очередь' : 'Перетащите изображения или выберите'
  /**
   * Освобождает память исключённого файла.
   */
  const handleRemove = (id: string): void => {
    if (form.submitting) return
    setEntries((current) => current.filter((candidate) => candidate.id !== id))
  }
  /**
   * Возвращает выбранный файл в очередь новой ручной попытки, сохраняя классификацию.
   */
  const handleRequeue = (id: string): void => {
    if (form.submitting) return
    setEntries((current) => current.map((entry) => {
      if (entry.id !== id || (entry.status !== 'failed' && entry.status !== 'cancelled')) return entry
      return { ...entry, status: 'waiting', progress: 0, errorMessage: null }
    }))
  }
  /**
   * Обновляет состояние конкретной передачи, не затрагивая остальные файлы.
   */
  const updateEntry = (id: string, patch: Partial<UploadEntry>): void => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry))
  }
  /**
   * Отправляет очередь последовательно; создание загрузки автоматически не повторяется.
   */
  const handleUpload = async (input: ImageUploadForm): Promise<void> => {
    if (!canSubmit || activeController.current !== null) return
    const controller = new AbortController()
    activeController.current = controller
    try {
      for (const entry of entries) {
        if (entry.status !== 'waiting' || controller.signal.aborted) continue
        updateEntry(entry.id, { status: 'uploading', errorMessage: null })
        try {
          await onUpload(entry.file, input, (progress) => updateEntry(entry.id, { progress }), controller.signal)
          updateEntry(entry.id, { status: 'done', progress: 100 })
        } catch (error) {
          if (controller.signal.aborted) {
            updateEntry(entry.id, {
              status: 'cancelled',
              errorMessage: 'Передача остановлена. Проверьте медиатеку перед новой загрузкой файла.'
            })
            return
          }
          let errorMessage = 'Загрузка не завершена. Удалите файл из очереди и добавьте его снова для новой попытки.'
          if (isImageError(error)) errorMessage = getImageErrorMessage(error)
          if (!isImageError(error)) reportApplicationDefect(toApplicationDefect('images.upload', error))
          updateEntry(entry.id, { status: 'failed', errorMessage })
        }
      }
    } finally {
      activeController.current = null
    }
  }
  /**
   * Останавливает текущую передачу и сохраняет ещё не отправленную очередь.
   */
  const handleStop = (): void => activeController.current?.abort()
  /**
   * Направляет фокус к неверному полю.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const firstPath = Object.keys(errors)[0]
    if (firstPath !== undefined) form.getInputNode(firstPath)?.focus()
  }

  return (
    <Modal
      opened={isOpened}
      onClose={onClose}
      title="Загрузить изображения"
      size="lg"
      padding="lg"
      closeOnClickOutside={!form.submitting}
      closeOnEscape={!form.submitting}
      withCloseButton={!form.submitting}
      closeButtonProps={{ 'aria-label': 'Закрыть загрузку' }}
      transitionProps={{ duration: shouldReduceMotion ? 0 : 180 }}
      classNames={{ content: cl(styles.modal, isDragging && styles._dragging) }}
    >
      <form
        className={styles.root}
        onSubmit={(event) => form.onSubmit(handleUpload, handleValidationError)(event)}
        noValidate
      >
        <Stack gap="lg">
          <FileButton onChange={handleAddFiles} accept="image/jpeg,image/png,image/webp" multiple resetRef={fileButtonReset}>
            {(fileProps) => (
              <button {...fileProps} type="button" className={cl(styles.dropzone, isDragging && styles._dragging)} disabled={form.submitting}>
                <ThemeIcon size={56} radius="xl" variant="light"><IconCloudUpload size={28} aria-hidden="true" /></ThemeIcon>
                <Text fw={600} mt="md" aria-live="polite">{dropLabel}</Text>
                <Text size="sm" c="dimmed" mt={4}>JPEG, PNG и WebP · можно выбрать несколько файлов</Text>
                <Group gap={5} mt="md"><IconPlus size={16} aria-hidden="true" /><Text size="sm" fw={600}>Добавить файлы</Text></Group>
              </button>
            )}
          </FileButton>
          {isDefined(selectionError) && (
            <Alert color="orange" role="alert">{selectionError}</Alert>
          )}
          {hasFiles && (
            <Stack gap="xs" className={styles.queue} role="region" aria-label="Очередь загрузки" aria-live="polite">
              {entries.map((entry) => (
                <UploadFile
                  key={entry.id}
                  entry={entry}
                  canRemove={!form.submitting}
                  onRemove={handleRemove}
                  onRequeue={handleRequeue}
                />
              ))}
            </Stack>
          )}
          <Fieldset variant="unstyled" disabled={form.submitting}>
            <Stack gap="md">
              <Autocomplete label="Папка для всех файлов" placeholder="Например, Каталог/Обложки" data={folders} key={form.key('folder')} {...form.getInputProps('folder')} />
              <TagsInput label="Теги" placeholder="Введите тег и нажмите Enter" data={tags} key={form.key('tags')} {...form.getInputProps('tags')} />
            </Stack>
          </Fieldset>
          <Text size="xs" c="dimmed" lh={1.6}>Сохраним исходные пропорции и подготовим размеры с шагом 200 px, до 2000 px, без увеличения. Исходник хранится отдельно.</Text>
          {hasCompleted && (
            <Alert color="teal" icon={<IconCheck size={18} />} role="status">Передано файлов: {completedCount}. Обработка продолжится в медиатеке.</Alert>
          )}
          <Group justify="flex-end" gap="sm">
            {form.submitting && (
              <Button variant="light" color="red" onClick={handleStop}>Остановить загрузку</Button>
            )}
            <Button variant="default" onClick={onClose} disabled={form.submitting}>Закрыть</Button>
            {hasPendingFiles && (
              <Button type="submit" loading={form.submitting} disabled={!canSubmit} leftSection={<IconCloudUpload size={18} />}>{buttonLabel}</Button>
            )}
            {hasCompleted && (
              <Button onClick={onUploaded} disabled={form.submitting}>Открыть медиатеку</Button>
            )}
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
