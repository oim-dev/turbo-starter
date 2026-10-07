import { isEmptyArray, isNonEmptyString, isNotDefined } from '@biocad/value-predicates'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconEdit,
  IconFolder,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconX
} from '@tabler/icons-react'
import cl from 'clsx'
import { useDeferredValue, useState } from 'react'

import { isPublicationCategoryError } from '../../errors/publication-category.error'
import type {
  AdminPublicationCategory,
  PublicationCategoryFilters,
  PublicationCategoryInput
} from '../../types/publication-category.type'
import {
  useCreatePublicationCategory,
  useDeletePublicationCategory,
  usePublicationCategories,
  useUpdatePublicationCategory
} from '../../hooks/use-publication-categories.hook'
import { PublicationCategoryForm } from '../publication-category-form'

import type { PublicationCategoriesManagerProps } from './types/publication-categories-manager-props.type'
import styles from './styles/publication-categories-manager.module.css'

const INITIAL_FILTERS: PublicationCategoryFilters = {
  page: 1,
  pageSize: 20,
  search: ''
}

/**
 * Возвращает безопасный пользовательский текст ошибки изменения категории.
 */
const getMutationErrorMessage = (error: unknown): string => {
  if (isPublicationCategoryError(error)) {
    return error.message
  }

  return 'Не удалось выполнить действие. Повторите попытку.'
}

/**
 * Форматирует диапазон текущей страницы категорий.
 */
const formatResultRange = (filters: PublicationCategoryFilters, total: number): string => {
  if (total === 0) {
    return 'Нет результатов'
  }

  const first = (filters.page - 1) * filters.pageSize + 1
  const last = Math.min(filters.page * filters.pageSize, total)

  return `${first}-${last} из ${total}`
}

/**
 * Отображает интерфейс PublicationCategoriesManager.
 */
export const PublicationCategoriesManager = (props: PublicationCategoriesManagerProps) => {
  const { className, ...rootAttrs } = props
  const [filters, setFilters] = useState<PublicationCategoryFilters>(INITIAL_FILTERS)
  const [isFormOpened, setIsFormOpened] = useState(false)
  const [formVersion, setFormVersion] = useState(0)
  const [editingCategory, setEditingCategory] = useState<AdminPublicationCategory | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<AdminPublicationCategory | null>(null)
  const deferredSearch = useDeferredValue(filters.search)
  const queryFilters = { ...filters, search: deferredSearch }
  const categoriesQuery = usePublicationCategories(queryFilters)
  const createMutation = useCreatePublicationCategory()
  const updateMutation = useUpdatePublicationCategory()
  const deleteMutation = useDeletePublicationCategory()
  const categoriesData = categoriesQuery.data
  const categoryItems = categoriesData?.items ?? []
  const total = categoriesData?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))
  const shouldShowEmptyState = categoriesQuery.isSuccess && isEmptyArray(categoryItems)
  const shouldShowPagination = categoriesQuery.isSuccess && pageCount > 1
  const isUpdatingResults = categoriesQuery.isFetching || filters.search !== deferredSearch
  const isFormPending = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error ?? updateMutation.error ?? deleteMutation.error
  const mutationErrorMessage = getMutationErrorMessage(mutationError)
  const hasMutationError = createMutation.isError || updateMutation.isError || deleteMutation.isError
  const formTitle = isNotDefined(editingCategory) ? 'Новая категория' : 'Редактирование категории'
  const resultRange = formatResultRange(filters, total)

  /**
   * Открывает чистую форму создания категории.
   */
  const handleCreate = (): void => {
    createMutation.reset()
    updateMutation.reset()
    setEditingCategory(null)
    setFormVersion(current => current + 1)
    setIsFormOpened(true)
  }

  /**
   * Открывает форму актуальной версии категории.
   */
  const handleEdit = (category: AdminPublicationCategory): void => {
    createMutation.reset()
    updateMutation.reset()
    setEditingCategory(category)
    setFormVersion(current => current + 1)
    setIsFormOpened(true)
  }

  /**
   * Открывает подтверждение удаления с чистым mutation state.
   */
  const handleRequestDelete = (category: AdminPublicationCategory): void => {
    deleteMutation.reset()
    setDeletingCategory(category)
  }

  /**
   * Сохраняет новую или редактируемую категорию.
   */
  const handleSubmit = async (input: PublicationCategoryInput): Promise<void> => {
    try {
      if (isNotDefined(editingCategory)) {
        await createMutation.mutateAsync(input)
      } else {
        await updateMutation.mutateAsync({ category: editingCategory, input })
      }

      setIsFormOpened(false)
    } catch {
      // Mutation state отображает безопасную доменную ошибку.
    }
  }

  /**
   * Удаляет подтверждённую пустую категорию.
   */
  const handleDelete = async (): Promise<void> => {
    if (isNotDefined(deletingCategory) || deletingCategory.publicationCount > 0) {
      return
    }

    try {
      await deleteMutation.mutateAsync(deletingCategory)
      setDeletingCategory(null)

      if (categoryItems.length === 1 && filters.page > 1) {
        setFilters(current => ({ ...current, page: current.page - 1 }))
      }
    } catch {
      // Mutation state отображает безопасную доменную ошибку.
    }
  }

  return (
    <section
      {...rootAttrs}
      className={cl(styles.root, className)}
      aria-labelledby="publication-categories-title"
    >
      <Stack gap="lg">
        <div className={styles.headingRow}>
          <Group gap="md" wrap="nowrap">
            <ThemeIcon radius="md" size={46} variant="light">
              <IconFolder size={25} stroke={1.7} />
            </ThemeIcon>
            <div>
              <Group gap="sm">
                <Title id="publication-categories-title" order={1}>Категории</Title>
                <Badge color="teal" size="lg" variant="filled">{total}</Badge>
              </Group>
              <Text c="dimmed" size="sm">Рубрики для публикаций сайта</Text>
            </div>
          </Group>
          <Group gap="sm">
            <Tooltip label="Обновить список">
              <ActionIcon
                aria-label="Обновить категории"
                loading={categoriesQuery.isFetching}
                size="xl"
                variant="default"
                onClick={() => void categoriesQuery.refetch()}
              >
                <IconRefresh size={19} />
              </ActionIcon>
            </Tooltip>
            <Button leftSection={<IconPlus size={18} />} size="md" onClick={handleCreate}>
              Создать категорию
            </Button>
          </Group>
        </div>

        <Paper className={styles.toolbar} p="md" radius="md" withBorder>
          <TextInput
            className={styles.search}
            label="Поиск"
            leftSection={<IconSearch size={17} />}
            maxLength={200}
            placeholder="Название или slug"
            rightSection={isNonEmptyString(filters.search) && (
              <ActionIcon
                aria-label="Очистить поиск категорий"
                size="sm"
                variant="subtle"
                onClick={() => setFilters(current => ({ ...current, page: 1, search: '' }))}
              >
                <IconX size={15} />
              </ActionIcon>
            )}
            rightSectionPointerEvents="all"
            value={filters.search}
            onChange={event => {
              const search = event.currentTarget.value
              setFilters(current => ({ ...current, page: 1, search }))
            }}
          />
          <Group className={styles.resultSummary} gap="sm" justify="space-between">
            <Text c="dimmed" size="sm">{resultRange}</Text>
            {isUpdatingResults && (
              <Loader aria-label="Обновление категорий" size="sm" />
            )}
          </Group>
        </Paper>

        {hasMutationError && (
          <Alert color="red" icon={<IconAlertTriangle />} title="Действие не выполнено">
            {mutationErrorMessage}
          </Alert>
        )}

        {categoriesQuery.isPending && (
          <Stack aria-label="Загрузка категорий" gap="sm">
            <Skeleton height={104} radius="md" />
            <Skeleton height={104} radius="md" />
            <Skeleton height={104} radius="md" />
          </Stack>
        )}

        {categoriesQuery.isError && (
          <Alert color="red" icon={<IconAlertTriangle />} title="Не удалось загрузить категории">
            <Group justify="space-between">
              <Text size="sm">Проверьте подключение и повторите запрос.</Text>
              <Button color="red" size="xs" variant="light" onClick={() => void categoriesQuery.refetch()}>
                Повторить
              </Button>
            </Group>
          </Alert>
        )}

        {shouldShowEmptyState && (
          <Paper className={styles.state} p="xl" radius="md" withBorder>
            <Center h="100%">
              <Stack align="center" gap="sm" maw={420} ta="center">
                <IconFolder aria-hidden size={38} stroke={1.4} />
                <Title order={2}>Категории не найдены</Title>
                <Text c="dimmed">Измените поиск или создайте первую категорию.</Text>
              </Stack>
            </Center>
          </Paper>
        )}

        {!isEmptyArray(categoryItems) && (
          <Stack gap="sm">
            {categoryItems.map(category => {
              const canDelete = category.publicationCount === 0
              const deleteTooltip = canDelete
                ? 'Удалить категорию'
                : 'Сначала перенесите публикации в другую категорию'

              return (
                <Paper className={styles.category} key={category.id} p="md" radius="md" withBorder>
                  <div className={styles.categoryIdentity}>
                    <Text fw={700}>{category.name}</Text>
                    <Text c="dimmed" className={styles.slug} size="sm">/{category.slug}</Text>
                  </div>
                  <div className={styles.categoryCount}>
                    <Text c="dimmed" size="xs">Публикаций</Text>
                    <Badge color="blue" variant="light">{category.publicationCount}</Badge>
                  </div>
                  <Group className={styles.categoryActions} gap="xs" justify="flex-end" wrap="nowrap">
                    <Tooltip label="Редактировать">
                      <ActionIcon
                        aria-label={`Редактировать «${category.name}»`}
                        size="lg"
                        variant="light"
                        onClick={() => handleEdit(category)}
                      >
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={deleteTooltip}>
                      <span>
                        <ActionIcon
                          aria-label={`Удалить «${category.name}»`}
                          color="red"
                          disabled={!canDelete}
                          size="lg"
                          variant="light"
                          onClick={() => handleRequestDelete(category)}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </span>
                    </Tooltip>
                  </Group>
                </Paper>
              )
            })}

            {shouldShowPagination && (
              <Group justify="center" mt="md">
                <Pagination
                  aria-label="Страницы категорий"
                  total={pageCount}
                  value={filters.page}
                  onChange={page => setFilters(current => ({ ...current, page }))}
                />
              </Group>
            )}
          </Stack>
        )}
      </Stack>

      <Modal
        opened={isFormOpened}
        title={formTitle}
        onClose={() => setIsFormOpened(false)}
      >
        <PublicationCategoryForm
          category={editingCategory}
          isPending={isFormPending}
          key={`${editingCategory?.id ?? 'create'}:${formVersion}`}
          onCancel={() => setIsFormOpened(false)}
          onSubmit={handleSubmit}
        />
        {(createMutation.isError || updateMutation.isError) && (
          <Alert color="red" icon={<IconAlertTriangle />} mt="md">
            {getMutationErrorMessage(createMutation.error ?? updateMutation.error)}
          </Alert>
        )}
      </Modal>

      <Modal
        centered
        opened={!isNotDefined(deletingCategory)}
        title="Удалить категорию?"
        onClose={() => setDeletingCategory(null)}
      >
        <Stack>
          <Text>
            Категория будет удалена без возможности восстановления.
          </Text>
          {deleteMutation.isError && (
            <Alert color="red" icon={<IconAlertTriangle />}>
              {getMutationErrorMessage(deleteMutation.error)}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button disabled={deleteMutation.isPending} variant="default" onClick={() => setDeletingCategory(null)}>
              Отмена
            </Button>
            <Button color="red" loading={deleteMutation.isPending} onClick={() => void handleDelete()}>
              Удалить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </section>
  )
}
