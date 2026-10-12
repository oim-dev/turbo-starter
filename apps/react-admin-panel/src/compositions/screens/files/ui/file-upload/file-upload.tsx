import { Alert, Autocomplete, Button, FileButton, Group, Modal, Stack, TagsInput, Text, ThemeIcon } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useReducedMotion } from '@mantine/hooks'
import { IconCloudUpload, IconPlus, IconPlayerStop } from '@tabler/icons-react'
import cl from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { getFileErrorMessage, isFileError } from 'domains/files'
import { useNativeFileDrop } from 'infra/native-file-drop'
import type { NativeFileDrop } from 'infra/native-file-drop'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isEmptyArray } from 'shared/value-predicates'
import { UploadEntry } from './ui/upload-entry/upload-entry'
import type { UploadClassificationForm, UploadEntryState } from './types/upload-entry.type'
import type { FileUploadProps } from './types/file-upload-props.type'
import styles from './styles/file-upload.module.css'

/**
 * Владеет очередью документов и добавлением новой версии выбранного документа.
 *
 * Используется для:
 *  - приёма файлов кнопкой и перетаскиванием с проверкой SHA-256
 *  - отмены и явного продолжения уже созданной загрузки
 */
export const FileUpload = (props: FileUploadProps): JSX.Element => {
  const { initialBatch, initialFolder, target, facets, onUpload, onClose, onFinished } = props
  const isVersion = target !== undefined
  const [entries, setEntries] = useState<UploadEntryState[]>(() => {
    const files = isVersion ? initialBatch.files.slice(0, 1) : initialBatch.files
    return files.map((file) => ({ id: crypto.randomUUID(), file, status: 'waiting', percent: 0, error: null }))
  })
  const [selectionError, setSelectionError] = useState<string | null>(() => {
    if (initialBatch.directoryCount > 0) return 'Папки не добавлены. Перетащите отдельные файлы.'
    if (isVersion && initialBatch.files.length > 1) return 'Для одной версии выбран первый файл. Остальные не добавлены.'
    return null
  })
  const controller = useRef<AbortController | null>(null)
  const resetInput = useRef<() => void>(null)
  const shouldReduceMotion = useReducedMotion()
  const form = useForm<UploadClassificationForm>({
    mode: 'uncontrolled', validateInputOnBlur: true,
    initialValues: { folder: initialFolder ?? '', tags: [] },
    validate: {
      folder: (folder) => folder.length > 255 ? 'Не более 255 символов.' : null,
      tags: (tags) => tags.some((tag) => tag.length > 64) ? 'Тег — не более 64 символов.' : null
    }
  })
  const isBusy = form.submitting
  const hasWaiting = entries.some((entry) => entry.status === 'waiting')
  const completedCount = entries.filter((entry) => entry.status === 'done').length
  const reusedCount = entries.filter((entry) => entry.receipt?.isReused).length
  const canStart = hasWaiting && !isBusy
  const canAdd = !isBusy && (!isVersion || isEmptyArray(entries))
  const title = isVersion ? 'Новая версия документа' : 'Загрузка файлов'
  const targetTitle = target?.title || target?.filename || ''
  const folders = facets?.folders.map((folder) => folder.name) ?? []
  const tags = facets?.tags.map((tag) => tag.name) ?? []

  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (!isBusy) return
    /**
     * Предупреждает о потере локальной очереди при закрытии вкладки.
     */
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => { event.preventDefault() }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isBusy])

  /**
   * Добавляет файлы в единственную очередь текущей панели.
   */
  const handleAdd = (batch: NativeFileDrop): void => {
    if (isBusy) { setSelectionError('Дождитесь завершения или остановите загрузку.'); return }
    if (isVersion && !isEmptyArray(entries)) { setSelectionError('Для версии нужен один файл. Удалите выбранный, чтобы заменить его.'); return }
    const selected = isVersion ? batch.files.slice(0, 1) : batch.files
    const message = batch.directoryCount > 0 ? 'Папки не добавлены.' : isVersion && batch.files.length > 1 ? 'Добавлен первый файл: одна версия содержит один документ.' : null
    setSelectionError(message)
    setEntries((current) => [...current, ...selected.map((file): UploadEntryState => ({ id: crypto.randomUUID(), file, status: 'waiting', percent: 0, error: null }))])
    resetInput.current?.()
  }
  const isDragging = useNativeFileDrop({ isEnabled: true, canDrop: canAdd, onDrop: handleAdd })
  const dropTitle = isDragging ? 'Отпустите файл здесь' : isVersion ? 'Выберите файл новой версии' : 'Перетащите файлы сюда'
  /**
   * Обновляет состояние только соответствующей строки.
   */
  const updateEntry = (id: string, patch: Partial<UploadEntryState>): void => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry))
  }
  /**
   * Последовательно передаёт выбранные документы без автоматического повтора POST.
   */
  const handleUpload = async (values: UploadClassificationForm): Promise<void> => {
    if (controller.current !== null) return
    const active = new AbortController()
    controller.current = active
    setSelectionError(null)
    try {
      for (const entry of entries.filter((candidate) => candidate.status === 'waiting')) {
        if (active.signal.aborted) break
        try {
          const receipt = await onUpload(entry.file, { folder: values.folder || null, tags: values.tags, targetId: target?.id },
            (progress) => { if (!active.signal.aborted) updateEntry(entry.id, { status: progress.phase, percent: progress.percent, error: null }) },
            (checkpoint) => updateEntry(entry.id, { checkpoint }), active.signal, entry.checkpoint)
          updateEntry(entry.id, { status: 'done', percent: 100, receipt, error: null })
        } catch (error) {
          if (active.signal.aborted) { updateEntry(entry.id, { status: 'cancelled', error: null }); break }
          if (!isFileError(error)) reportApplicationDefect(toApplicationDefect('files.upload', error))
          updateEntry(entry.id, { status: 'failed', error: getFileErrorMessage(error) })
        }
      }
    } finally { controller.current = null }
  }
  /**
   * Фокусирует ошибочное поле классификации.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const field = Object.keys(errors)[0]
    if (field !== undefined) form.getInputNode(field)?.focus()
  }

  return (
    <Modal opened onClose={onClose} title={title} size="min(720px, 100%)" closeOnClickOutside={!isBusy} closeOnEscape={!isBusy} withCloseButton={!isBusy} closeButtonProps={{ 'aria-label': 'Закрыть загрузчик файлов' }} transitionProps={{ duration: shouldReduceMotion ? 0 : 180 }}>
      <form className={styles.root} onSubmit={(event) => form.onSubmit(handleUpload, handleValidationError)(event)} noValidate>
        <Stack gap="lg">
          {isVersion && (
            <Alert color="blue" title={targetTitle}>Новая версия станет текущей. Имя документа и ссылка останутся прежними. В истории можно выбрать другую текущую версию.</Alert>
          )}
          <div className={cl(styles.dropzone, { [styles._dragging]: isDragging })}>
            <ThemeIcon size={52} radius="xl" variant="light"><IconCloudUpload size={28} /></ThemeIcon>
            <Text fw={600}>{dropTitle}</Text><Text size="xs" c="dimmed">Любые файлы, включая видео. Без ограничения размера в приложении.</Text>
            <FileButton onChange={(files) => handleAdd({ files, directoryCount: 0 })} multiple resetRef={resetInput}>
              {(buttonProps) => <Button {...buttonProps} variant="default" disabled={!canAdd} leftSection={<IconPlus size={16} />}>Выбрать файлы</Button>}
            </FileButton>
          </div>
          {selectionError !== null && (
            <Alert color="orange" role="alert">{selectionError}</Alert>
          )}
          <div className={styles.queue} aria-label="Очередь загрузки">
            {entries.map((entry) => <UploadEntry key={entry.id} entry={entry} isBusy={isBusy} onRemove={() => setEntries((current) => current.filter((candidate) => candidate.id !== entry.id))} onRetry={() => updateEntry(entry.id, { status: 'waiting', error: null, percent: 0 })} />)}
          </div>
          {!isVersion && (
            <fieldset className={styles.fields} disabled={isBusy}>
              <Stack gap="md">
                <Autocomplete label="Папка для новых файлов" placeholder="Например, Документы/Инструкции" maxLength={255} data={folders} key={form.key('folder')} {...form.getInputProps('folder')} />
                <TagsInput label="Теги для новых файлов" maxTags={20} data={tags} key={form.key('tags')} {...form.getInputProps('tags')} />
              </Stack>
            </fieldset>
          )}
          <Text size="xs" c="dimmed">Сначала проверим SHA-256. Уже сохранённые байты используем повторно. Классификация существующего документа сохраняется.</Text>
          {completedCount > 0 && (
            <Text size="sm" role="status">Готово: {completedCount}. Содержимое уже было в хранилище: {reusedCount}.</Text>
          )}
          <Group justify="space-between">
            <Button variant="default" onClick={onClose} disabled={isBusy}>Закрыть</Button>
            <Group gap="sm">
              {isBusy && (
                <Button variant="light" color="orange" onClick={() => controller.current?.abort()} leftSection={<IconPlayerStop size={16} />}>Остановить загрузку</Button>
              )}
              <Button type="submit" loading={isBusy} disabled={!canStart}>Загрузить</Button>
              {completedCount > 0 && !isBusy && (
                <Button variant="light" onClick={onFinished}>Готово</Button>
              )}
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
