import { Alert, Autocomplete, Button, Fieldset, Stack, TagsInput, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconCheck } from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { getImageErrorMessage, isImageError } from 'domains/images'
import type { ImageClassification as Classification } from 'domains/images'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import type { ImageClassificationProps } from './types/image-classification-props.type'
import styles from './styles/image-classification.module.css'

/**
 * Позволяет изменить название, создать папку и свободные теги изображения.
 *
 * Используется для:
 *  - сохранения классификации в панели подробностей
 *  - просмотра классификации с правом только чтения
 */
export const ImageClassification = (props: ImageClassificationProps): JSX.Element => {
  const { image, facets, canUpdate, onSave } = props
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const form = useForm<Classification>({
    mode: 'uncontrolled',
    initialValues: { title: image.title, folder: image.folder ?? '', tags: image.tags },
    validateInputOnBlur: true,
    validate: {
      title: (title) => title.length > 255 ? 'Не более 255 символов' : null,
      folder: (folder) => (folder?.length ?? 0) > 255 ? 'Не более 255 символов' : null,
      tags: (tags) => tags.length > 20 || tags.some((tag) => tag.length > 64)
        ? 'Не более 20 тегов по 64 символа' : null
    },
    onValuesChange: () => setIsSaved(false)
  })
  const folders = facets?.folders.map((folder) => folder.name) ?? []
  const tags = facets?.tags.map((tag) => tag.name) ?? []
  const isDisabled = !canUpdate || form.submitting
  /**
   * Сохраняет ввод и подтверждает новые исходные значения только после успеха.
   */
  const handleSave = async (input: Classification): Promise<void> => {
    if (!canUpdate || form.submitting) return
    setErrorMessage(null)
    setIsSaved(false)
    try {
      const saved = await onSave(image.id, input)
      const savedValues = { title: saved.title, folder: saved.folder ?? '', tags: saved.tags }
      form.setValues(savedValues)
      form.resetDirty(savedValues)
      setIsSaved(true)
    } catch (error) {
      if (isImageError(error)) {
        setErrorMessage(getImageErrorMessage(error))
        return
      }
      reportApplicationDefect(toApplicationDefect('images.classification', error))
      setErrorMessage('Не удалось сохранить изменения. Введённые данные сохранены в форме.')
    }
  }
  /**
   * Фокусирует первое некорректное поле.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const firstPath = Object.keys(errors)[0]
    if (firstPath !== undefined) form.getInputNode(firstPath)?.focus()
  }

  return (
    <form className={styles.root} onSubmit={form.onSubmit(handleSave, handleValidationError)} noValidate>
      <Fieldset disabled={isDisabled} variant="unstyled">
        <Stack gap="md">
          <TextInput label="Название" key={form.key('title')} {...form.getInputProps('title')} />
          <Autocomplete
            label="Папка"
            description="Выберите существующую или введите новую. Вложенность: Каталог/Обложки"
            data={folders}
            key={form.key('folder')}
            {...form.getInputProps('folder')}
          />
          <TagsInput
            label="Теги"
            description="Введите тег и нажмите Enter"
            data={tags}
            key={form.key('tags')}
            {...form.getInputProps('tags')}
          />
          {canUpdate && (
            <Button type="submit" variant="light" loading={form.submitting}>Сохранить изменения</Button>
          )}
        </Stack>
      </Fieldset>
      {isDefined(errorMessage) && (
        <Alert color="red" mt="md" role="alert">{errorMessage}</Alert>
      )}
      {isSaved && (
        <Alert color="teal" mt="md" icon={<IconCheck size={18} />} role="status">Изменения сохранены</Alert>
      )}
    </form>
  )
}
