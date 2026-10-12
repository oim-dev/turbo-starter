import { Alert, Autocomplete, Button, Stack, TagsInput, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconFileDescription, IconFolder, IconTags } from '@tabler/icons-react'
import cl from 'clsx'
import { useState } from 'react'
import type { JSX } from 'react'
import { getFileErrorMessage, isFileError } from 'domains/files'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import type { FileClassificationForm, FileClassificationProps } from './types/file-classification-props.type'
import styles from './styles/file-classification.module.css'

/**
 * Редактирует имя документа, папку и теги, сохраняя черновик при ошибке.
 *
 * Используется для:
 *  - переименования документа и URL без изменения байтов и имён версий
 */
export const FileClassification = (props: FileClassificationProps): JSX.Element => {
  const { file, facets, canUpdate, onSave, className, ...rootAttrs } = props
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const form = useForm<FileClassificationForm>({
    mode: 'uncontrolled', validateInputOnBlur: true,
    initialValues: { title: file.title, folder: file.folder ?? '', tags: file.tags },
    validate: {
      title: (title) => {
        const name = title.trim()
        if (name === '') return 'Укажите имя файла.'
        if (name === '.' || name === '..' || /[/\\]/.test(name)) return 'Имя не должно содержать разделители пути.'
        return title.length > 255 ? 'Не более 255 символов.' : null
      },
      folder: (folder) => folder.length > 255 ? 'Не более 255 символов.' : null,
      tags: (tags) => tags.some((tag) => tag.length > 64) ? 'Тег — не более 64 символов.' : null
    },
    onValuesChange: () => { setIsSaved(false); setErrorMessage(null) }
  })
  const folders = facets?.folders.map((folder) => folder.name) ?? []
  const tags = facets?.tags.map((tag) => tag.name) ?? []
  const isDisabled = !canUpdate || form.submitting
  /**
   * Фиксирует подтверждённый результат как новую исходную версию формы.
   */
  const handleSave = async (values: FileClassificationForm): Promise<void> => {
    setErrorMessage(null)
    setIsSaved(false)
    try {
      const saved = await onSave(file.id, { title: values.title, folder: values.folder || null, tags: values.tags })
      const confirmed = { title: saved.title, folder: saved.folder ?? '', tags: saved.tags }
      form.setValues(confirmed)
      form.setInitialValues(confirmed)
      form.resetDirty(confirmed)
      setIsSaved(true)
    } catch (error) {
      if (!isFileError(error)) reportApplicationDefect(toApplicationDefect('files.classification', error))
      setErrorMessage(getFileErrorMessage(error))
    }
  }
  /**
   * Переводит фокус к первому некорректному полю.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const field = Object.keys(errors)[0]
    if (field !== undefined) form.getInputNode(field)?.focus()
  }

  return (
    <form {...rootAttrs} className={cl(styles.root, className)} noValidate onSubmit={form.onSubmit(handleSave, handleValidationError)}>
      <fieldset className={styles.fields} disabled={isDisabled}>
        <Stack gap="md">
          <TextInput
            label="Имя файла"
            leftSection={<IconFileDescription size={16} aria-hidden="true" />}
            description="Используется в списке, ссылке и при скачивании. Имена в истории версий сохраняются."
            required
            maxLength={255}
            key={form.key('title')}
            {...form.getInputProps('title')}
          />
          <Autocomplete
            label="Папка"
            leftSection={<IconFolder size={16} aria-hidden="true" />}
            placeholder="Например, Документы/Инструкции"
            maxLength={255}
            data={folders}
            key={form.key('folder')}
            {...form.getInputProps('folder')}
          />
          <TagsInput
            label="Теги"
            leftSection={<IconTags size={16} aria-hidden="true" />}
            placeholder="Добавьте метки"
            maxTags={20}
            data={tags}
            key={form.key('tags')}
            {...form.getInputProps('tags')}
          />
          {canUpdate && (
            <Button type="submit" loading={form.submitting}>Сохранить изменения</Button>
          )}
        </Stack>
      </fieldset>
      {errorMessage !== null && (
        <Alert color="red" mt="md" role="alert">{errorMessage}</Alert>
      )}
      {isSaved && (
        <Text c="var(--app-color-text-strong)" size="sm" mt="sm" role="status">Изменения сохранены</Text>
      )}
    </form>
  )
}
