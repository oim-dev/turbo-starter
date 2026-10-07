import { isDefined, isEmptyArray, isNotDefined } from '@biocad/value-predicates'
import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import cl from 'clsx'
import { useState } from 'react'

import { useAllPublicationCategories } from 'domains/publication-categories/client'
import { isPublicationError } from '../../errors/publication.error'
import { publicationQueryKeys } from '../../lib/publication-query-keys'
import { getPublication } from '../../services/publications.service'
import { PublicationEditorForm } from '../publication-editor-form'
import type { PublicationEditorProps } from './types/publication-editor-props.type'
import styles from './styles/publication-editor.module.css'

/**
 * Разрешает create/edit данные и монтирует форму публикации.
 *
 * Используется для:
 *  - загрузки server version перед редактированием
 *  - повторного получения актуальной версии после 409 conflict
 */
export const PublicationEditor = (props: PublicationEditorProps) => {
  const { mode, publicationId: editPublicationId, className, ...rootAttrs } = props
  const [reloadVersion, setReloadVersion] = useState(0)
  const categoriesQuery = useAllPublicationCategories()
  const publicationId = mode === 'edit' ? editPublicationId : null
  const publicationQuery = useQuery({
    enabled: isDefined(publicationId),
    queryFn: ({ signal }) => {
      if (isNotDefined(publicationId)) {
        throw new Error('Publication id is required in edit mode')
      }

      return getPublication(publicationId, signal)
    },
    queryKey: publicationQueryKeys.detail(publicationId ?? 'new')
  })

  /**
   * Обновляет query и принудительно пересоздаёт локальный form state.
   */
  const handleReloadLatest = async (): Promise<void> => {
    const result = await publicationQuery.refetch()

    if (result.isError) {
      throw result.error
    }

    setReloadVersion(current => current + 1)
  }

  if (categoriesQuery.isPending) {
    return (
      <section {...rootAttrs} className={cl(styles.root, className)}>
        <Center className={styles.state}>
          <Loader aria-label="Загрузка категорий" />
        </Center>
      </section>
    )
  }

  if (categoriesQuery.isError) {
    return (
      <section {...rootAttrs} className={cl(styles.root, className)}>
        <Center className={styles.state}>
          <Alert color="red" icon={<IconAlertTriangle />} title="Категории недоступны">
            <Stack gap="sm">
              <Text size="sm">Без списка категорий публикацию нельзя сохранить.</Text>
              <Button color="red" variant="light" onClick={() => void categoriesQuery.refetch()}>
                Повторить
              </Button>
            </Stack>
          </Alert>
        </Center>
      </section>
    )
  }

  const categories = categoriesQuery.data

  if (isEmptyArray(categories)) {
    return (
      <section {...rootAttrs} className={cl(styles.root, className)}>
        <Center className={styles.state}>
          <Alert color="yellow" icon={<IconAlertTriangle />} title="Нет категорий">
            Создайте категорию перед созданием публикации.
          </Alert>
        </Center>
      </section>
    )
  }

  if (mode === 'create') {
    return (
      <PublicationEditorForm
        {...rootAttrs}
        categories={categories}
        className={cl(styles.root, className)}
        publication={null}
      />
    )
  }

  if (publicationQuery.isPending) {
    return (
      <section {...rootAttrs} className={cl(styles.root, className)}>
        <Center className={styles.state}>
          <Loader aria-label="Загрузка публикации" />
        </Center>
      </section>
    )
  }

  if (publicationQuery.isError && isNotDefined(publicationQuery.data)) {
    const errorMessage = isPublicationError(publicationQuery.error)
      ? publicationQuery.error.message
      : 'Не удалось загрузить публикацию.'

    return (
      <section {...rootAttrs} className={cl(styles.root, className)}>
        <Center className={styles.state}>
          <Alert color="red" icon={<IconAlertTriangle />} title="Редактор недоступен">
            <Stack gap="sm">
              <Text size="sm">{errorMessage}</Text>
              <Button color="red" variant="light" onClick={() => void publicationQuery.refetch()}>
                Повторить
              </Button>
            </Stack>
          </Alert>
        </Center>
      </section>
    )
  }

  if (isNotDefined(publicationQuery.data)) {
    return null
  }

  return (
    <PublicationEditorForm
      {...rootAttrs}
      categories={categories}
      className={cl(styles.root, className)}
      key={`${publicationQuery.data.id}:${publicationQuery.data.version}:${reloadVersion}`}
      publication={publicationQuery.data}
      onReloadLatest={handleReloadLatest}
    />
  )
}
