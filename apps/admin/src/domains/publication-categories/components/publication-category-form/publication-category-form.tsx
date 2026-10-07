import { isNonEmptyString } from '@biocad/value-predicates'
import { Alert, Button, Group, Stack, TextInput } from '@mantine/core'
import cl from 'clsx'
import type { FormEvent } from 'react'
import { useState } from 'react'

import type { PublicationCategoryFormProps } from './types/publication-category-form-props.type'
import styles from './styles/publication-category-form.module.css'

/**
 * Отображает интерфейс PublicationCategoryForm.
 */
export const PublicationCategoryForm = (props: PublicationCategoryFormProps) => {
  const { category, isPending, onCancel, onSubmit, className, ...rootAttrs } = props
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)

  /**
   * Проверяет поля и передаёт нормализованный input владельцу mutation.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (!isNonEmptyString(name)) {
      setValidationError('Укажите название категории.')
      return
    }

    if (!isNonEmptyString(slug)) {
      setValidationError('Укажите slug категории.')
      return
    }

    setValidationError(null)
    await onSubmit({ name, slug })
  }

  return (
    <form
      {...rootAttrs}
      className={cl(styles.root, className)}
      onSubmit={event => void handleSubmit(event)}
    >
      <Stack gap="md">
        {isNonEmptyString(validationError) && (
          <Alert color="yellow">{validationError}</Alert>
        )}
        <TextInput
          required
          label="Название"
          maxLength={200}
          placeholder="Например, Новости компании"
          value={name}
          onChange={event => setName(event.currentTarget.value)}
        />
        <TextInput
          required
          description="Латиница, цифры и дефисы"
          label="Slug"
          maxLength={100}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="company-news"
          value={slug}
          onChange={event => setSlug(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button disabled={isPending} type="button" variant="default" onClick={onCancel}>
            Отмена
          </Button>
          <Button loading={isPending} type="submit">
            Сохранить
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
