import { isEmptyArray, isNonEmptyString, isOneOf } from '@biocad/value-predicates'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Image,
  Loader,
  Menu,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip
} from '@mantine/core'
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArticle,
  IconClock,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconFilePlus,
  IconPhotoOff,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconX
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import cl from 'clsx'
import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAllPublicationCategories } from 'domains/publication-categories/client'
import { isPublicationError } from '../../errors/publication.error'
import { publicationQueryKeys } from '../../lib/publication-query-keys'
import {
  listPublications,
  publishPublication,
  unpublishPublication
} from '../../services/publications.service'
import { PUBLICATION_STATUSES } from '../../types/publication.type'
import type {
  PublicationFilters,
  PublicationPage,
  PublicationSummary
} from '../../types/publication.type'
import { PublicationStatusAction } from '../publication-status-action'
import type { PublicationsListProps } from './types/publications-list-props.type'
import styles from './styles/publications-list.module.css'

const INITIAL_FILTERS: PublicationFilters = {
  categoryId: null,
  page: 1,
  pageSize: 20,
  search: '',
  status: null
}

const PAGE_SIZE_VALUES = ['10', '20', '50'] as const

const PAGE_SIZE_OPTIONS = PAGE_SIZE_VALUES.map(value => ({ label: `${value} на странице`, value }))

const STATUS_OPTIONS = [
  { label: 'Черновик', value: 'draft' },
  { label: 'Опубликовано', value: 'published' }
]

const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
})

/**
 * Форматирует ISO-время публикации для редакционного списка.
 */
const formatPublicationDate = (value: string): string => {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? 'Дата неизвестна' : DATE_FORMATTER.format(date)
}

/**
 * Форматирует количество материалов с русским склонением.
 */
const formatPublicationCount = (value: number): string => {
  const remainder100 = value % 100
  const remainder10 = value % 10

  if (remainder100 >= 11 && remainder100 <= 14) {
    return `${value} материалов`
  }

  if (remainder10 === 1) {
    return `${value} материал`
  }

  if (remainder10 >= 2 && remainder10 <= 4) {
    return `${value} материала`
  }

  return `${value} материалов`
}

/**
 * Форматирует диапазон публикаций текущей страницы.
 */
const formatPublicationRange = (filters: PublicationFilters, total: number): string => {
  if (total === 0) {
    return 'Нет результатов'
  }

  const first = (filters.page - 1) * filters.pageSize + 1
  const last = Math.min(filters.page * filters.pageSize, total)

  return `${first}-${last} из ${total}`
}

/**
 * Скрывает недоступную cover URL, оставляя декоративный placeholder под изображением.
 */
const handleCoverImageError = (event: React.SyntheticEvent<HTMLImageElement>): void => {
  event.currentTarget.hidden = true
}

/**
 * Отображает редакционный реестр публикаций с серверным поиском и фильтрами.
 */
export const PublicationsList = (props: PublicationsListProps) => {
  const { className, ...rootAttrs } = props
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<PublicationFilters>(INITIAL_FILTERS)
  const [showImages, setShowImages] = useState(true)
  const [showExcerpts, setShowExcerpts] = useState(true)
  const deferredSearch = useDeferredValue(filters.search)
  const categoriesQuery = useAllPublicationCategories()
  const queryFilters = { ...filters, search: deferredSearch }
  const publicationsQuery = useQuery<PublicationPage>({
    placeholderData: previousData => previousData,
    queryFn: ({ signal }) => listPublications(queryFilters, signal),
    queryKey: publicationQueryKeys.list(queryFilters)
  })
  const statusMutation = useMutation({
    mutationFn: (publication: PublicationSummary) => {
      if (publication.status === 'published') {
        return unpublishPublication(publication.id, publication.version)
      }

      return publishPublication(publication.id, publication.version)
    },
    onSuccess: async publication => {
      queryClient.setQueryData(publicationQueryKeys.detail(publication.id), publication)

      if (
        filters.status !== null
        && publication.status !== filters.status
        && publicationItems.length === 1
        && filters.page > 1
      ) {
        setFilters(current => ({ ...current, page: current.page - 1 }))
      }

      await queryClient.invalidateQueries({ queryKey: publicationQueryKeys.lists })
    }
  })
  const publicationsData = publicationsQuery.data
  const categoryOptions = (categoriesQuery.data ?? []).map(category => ({
    label: category.name,
    value: category.id
  }))
  const publicationItems = publicationsData?.items ?? []
  const total = publicationsData?.total ?? 0
  const shouldShowEmptyState = publicationsQuery.isSuccess && isEmptyArray(publicationItems)
  const actionError = statusMutation.error
  const actionErrorMessage = isPublicationError(actionError)
    ? actionError.message
    : 'Не удалось изменить статус публикации.'
  const hasActionVersionConflict = isPublicationError(actionError, 'VERSION_CONFLICT')
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))
  const shouldShowPagination = publicationsQuery.isSuccess && pageCount > 1
  const hasActiveFilters = isNonEmptyString(filters.search)
    || filters.categoryId !== null
    || filters.status !== null
  const isUpdatingResults = publicationsQuery.isFetching || filters.search !== deferredSearch
  const publicationCountLabel = formatPublicationCount(total)
  const resultRangeLabel = formatPublicationRange(filters, total)
  const imageVisibilityLabel = showImages ? 'Скрыть обложки' : 'Показать обложки'
  const ImageVisibilityIcon = showImages ? IconEyeOff : IconEye
  const excerptVisibilityLabel = showExcerpts ? 'Скрыть анонсы' : 'Показать анонсы'
  const ExcerptVisibilityIcon = showExcerpts ? IconEyeOff : IconEye

  /**
   * Обновляет stale list после optimistic conflict.
   */
  const handleReloadList = async (): Promise<void> => {
    const result = await publicationsQuery.refetch()

    if (result.isSuccess) {
      statusMutation.reset()
    }
  }

  return (
    <section
      {...rootAttrs}
      className={cl(styles.root, className)}
      aria-labelledby="publications-title"
    >
      <Stack gap="lg">
        <div className={styles.headingRow}>
          <Group align="center" gap="md" wrap="nowrap">
            <ThemeIcon radius="md" size={46} variant="light">
              <IconArticle size={25} stroke={1.7} />
            </ThemeIcon>
            <div>
              <Group gap="sm">
                <Title id="publications-title" order={1}>
                  Публикации
                </Title>
                <Badge color="teal" size="lg" variant="filled">
                  {total}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                Новости и статьи сайта
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            <Tooltip label="Обновить список">
              <ActionIcon
                aria-label="Обновить список публикаций"
                loading={publicationsQuery.isFetching}
                size="xl"
                variant="default"
                onClick={() => void publicationsQuery.refetch()}
              >
                <IconRefresh size={19} />
              </ActionIcon>
            </Tooltip>
            <Button
              component={Link}
              leftSection={<IconFilePlus size={18} />}
              size="md"
              to="/publications/new"
            >
              Создать публикацию
            </Button>
          </Group>
        </div>

        <div className={styles.registry}>
          <Paper className={styles.filtersPanel} component="aside" p="md" radius="md" withBorder>
            <div className={styles.filtersRow}>
              <TextInput
                className={styles.searchControl}
                label="Поиск"
                leftSection={<IconSearch size={17} />}
                maxLength={200}
                placeholder="Найти публикацию по заголовку"
                rightSection={isNonEmptyString(filters.search) && (
                  <ActionIcon
                    aria-label="Очистить поиск"
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
              <Select
                clearable
                className={styles.filterControl}
                data={STATUS_OPTIONS}
                label="Статус"
                placeholder="Все статусы"
                value={filters.status}
                onChange={value => {
                  setFilters(current => ({
                    ...current,
                    page: 1,
                    status: isOneOf(value, PUBLICATION_STATUSES) ? value : null
                  }))
                }}
              />
              <Select
                clearable
                className={styles.filterControl}
                data={categoryOptions}
                disabled={categoriesQuery.isError}
                label="Категория"
                loading={categoriesQuery.isPending}
                placeholder="Все категории"
                value={filters.categoryId}
                onChange={value => {
                  setFilters(current => ({
                    ...current,
                    categoryId: value,
                    page: 1
                  }))
                }}
              />
              <Group className={styles.filterActions} gap="xs" wrap="nowrap">
                <Menu position="bottom-end" shadow="md" width={230}>
                  <Menu.Target>
                    <Button
                      leftSection={<IconAdjustmentsHorizontal size={17} />}
                      type="button"
                      variant="default"
                    >
                      Отображение
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Настройки списка</Menu.Label>
                    <Menu.Item
                      leftSection={<ImageVisibilityIcon size={17} />}
                      onClick={() => setShowImages(current => !current)}
                    >
                      {imageVisibilityLabel}
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<ExcerptVisibilityIcon size={17} />}
                      onClick={() => setShowExcerpts(current => !current)}
                    >
                      {excerptVisibilityLabel}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
                <Tooltip label="Сбросить фильтры">
                  <ActionIcon
                    aria-label="Сбросить фильтры публикаций"
                    disabled={!hasActiveFilters}
                    size="lg"
                    type="button"
                    variant="default"
                    onClick={() => setFilters(INITIAL_FILTERS)}
                  >
                    <IconX size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </div>
          </Paper>

          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <div>
                <Text fw={700} size="lg">Материалы</Text>
                <Text c="dimmed" size="sm">{publicationCountLabel}, {resultRangeLabel}</Text>
              </div>
              <Group gap="sm">
                <Select
                  allowDeselect={false}
                  aria-label="Размер страницы публикаций"
                  data={PAGE_SIZE_OPTIONS}
                  value={String(filters.pageSize)}
                  w={180}
                  onChange={value => {
                    if (isOneOf(value, PAGE_SIZE_VALUES)) {
                      setFilters(current => ({ ...current, page: 1, pageSize: Number(value) }))
                    }
                  }}
                />
                {isUpdatingResults && (
                  <Loader aria-label="Обновление списка" size="sm" />
                )}
              </Group>
            </div>

            {categoriesQuery.isError && (
              <Alert color="yellow" icon={<IconAlertTriangle />} title="Фильтр категорий недоступен">
                Список публикаций загружен без фильтра по категории.
              </Alert>
            )}

            {statusMutation.isError && (
              <Alert color="red" icon={<IconAlertTriangle />} title="Статус не изменён">
                <Stack gap="sm">
                  <Text size="sm">{actionErrorMessage}</Text>
                  {hasActionVersionConflict && (
                    <Button
                      color="red"
                      size="xs"
                      variant="light"
                      onClick={() => void handleReloadList()}
                    >
                      Загрузить актуальную версию
                    </Button>
                  )}
                </Stack>
              </Alert>
            )}

            {publicationsQuery.isPending && (
              <Stack aria-label="Загрузка публикаций" gap="sm">
                <Skeleton height={160} radius="md" />
                <Skeleton height={160} radius="md" />
                <Skeleton height={160} radius="md" />
              </Stack>
            )}

            {publicationsQuery.isError && (
              <Alert color="red" icon={<IconAlertTriangle />} title="Не удалось загрузить публикации">
                <Group justify="space-between">
                  <Text size="sm">Проверьте подключение к Admin API и повторите запрос.</Text>
                  <Button color="red" size="xs" variant="light" onClick={() => void publicationsQuery.refetch()}>
                    Повторить
                  </Button>
                </Group>
              </Alert>
            )}

            {shouldShowEmptyState && (
              <Paper className={styles.state} p="xl" radius="md" withBorder>
                <Center h="100%">
                  <Stack align="center" gap="sm" maw={420} ta="center">
                    <IconSparkles aria-hidden size={36} stroke={1.5} />
                    <Title order={2}>Публикаций не найдено</Title>
                    <Text c="dimmed">
                      Измените параметры поиска или создайте первый материал.
                    </Text>
                  </Stack>
                </Center>
              </Paper>
            )}

            {!isEmptyArray(publicationItems) && (
              <Stack gap="md">
                {publicationItems.map(publication => {
                  const isPublished = publication.status === 'published'
                  const statusLabel = isPublished ? 'Опубликовано' : 'Черновик'
                  const statusColor = isPublished ? 'teal' : 'gray'
                  const isStatusPending = statusMutation.isPending
                    && statusMutation.variables?.id === publication.id
                  const excerpt = publication.excerpt.trim()
                  const hasExcerpt = isNonEmptyString(excerpt)
                  const excerptText = hasExcerpt ? excerpt : 'Анонс пока не заполнен.'
                  const coverUrl = publication.cover?.url
                  const hasCover = showImages && isNonEmptyString(coverUrl)
                  const coverAlt = isNonEmptyString(publication.cover?.alt)
                    ? publication.cover.alt
                    : `Обложка публикации «${publication.title}»`
                  return (
                    <Paper
                      className={cl(styles.record, {
                        [styles.recordWithoutImage]: !showImages
                      })}
                      component="article"
                      key={publication.id}
                      radius="md"
                      withBorder
                    >
                      {showImages && (
                        <div className={styles.cover}>
                          <Center className={styles.coverPlaceholder}>
                            <ThemeIcon color="gray" radius="xl" size={52} variant="light">
                              <IconPhotoOff size={26} stroke={1.5} />
                            </ThemeIcon>
                          </Center>
                          {hasCover && (
                            <Image
                              alt={coverAlt}
                              className={styles.coverImage}
                              src={coverUrl}
                              onError={handleCoverImageError}
                            />
                          )}
                          <Badge className={styles.coverStatus} color={statusColor} radius="sm" variant="filled">
                            {statusLabel}
                          </Badge>
                        </div>
                      )}

                      <div className={styles.recordContent}>
                        <div className={styles.recordHeader}>
                          <Text
                            className={styles.recordTitle}
                            component={Link}
                            fw={700}
                            to={`/publications/${publication.id}`}
                          >
                            {publication.title}
                          </Text>
                          {!showImages && (
                            <Badge color={statusColor} radius="sm" variant="filled">
                              {statusLabel}
                            </Badge>
                          )}
                          <div className={styles.recordActions}>
                            <Tooltip label="Редактировать" position="bottom">
                              <ActionIcon
                                aria-label={`Редактировать «${publication.title}»`}
                                className={styles.recordAction}
                                component={Link}
                                radius="md"
                                to={`/publications/${publication.id}`}
                                variant="subtle"
                              >
                                <IconEdit size={18} />
                              </ActionIcon>
                            </Tooltip>
                            <PublicationStatusAction
                              isMutationPending={statusMutation.isPending}
                              isPending={isStatusPending}
                              placement="primary"
                              publication={publication}
                              onChange={statusMutation.mutate}
                            />
                            <Menu position="bottom-end" shadow="md" width={230}>
                              <Menu.Target>
                                <ActionIcon
                                  aria-label={`Все действия с публикацией «${publication.title}»`}
                                  className={styles.recordAction}
                                  radius="md"
                                  variant="subtle"
                                >
                                  <IconDotsVertical size={19} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Label>Действия</Menu.Label>
                                <Menu.Item
                                  component={Link}
                                  leftSection={<IconEdit size={17} />}
                                  to={`/publications/${publication.id}`}
                                >
                                  Редактировать
                                </Menu.Item>
                                <Menu.Divider />
                                <PublicationStatusAction
                                  isMutationPending={statusMutation.isPending}
                                  isPending={isStatusPending}
                                  placement="menu"
                                  publication={publication}
                                  onChange={statusMutation.mutate}
                                />
                              </Menu.Dropdown>
                            </Menu>
                          </div>
                        </div>

                        <div className={styles.recordBody}>
                          {showExcerpts && (
                            <Text
                              className={cl(styles.excerpt, !hasExcerpt && styles.emptyExcerpt)}
                              lineClamp={2}
                              size="sm"
                            >
                              {excerptText}
                            </Text>
                          )}

                          <div className={styles.recordMeta}>
                            <div className={styles.metaItem}>
                              <Text className={styles.metaLabel} c="dimmed" size="xs">
                                Категория
                              </Text>
                              <Badge color="blue" radius="sm" variant="light">
                                {publication.category.name}
                              </Badge>
                            </div>
                            <div className={styles.metaItem}>
                              <Text className={styles.metaLabel} c="dimmed" size="xs">
                                Адрес
                              </Text>
                              <Text className={styles.slug} c="dimmed" size="xs" title={`/${publication.slug}`}>
                                /{publication.slug}
                              </Text>
                            </div>
                            <div className={styles.metaItem}>
                              <Text className={styles.metaLabel} c="dimmed" size="xs">
                                Обновлено
                              </Text>
                              <Group className={styles.updatedAt} gap={5} wrap="nowrap">
                                <IconClock aria-hidden size={14} stroke={1.7} />
                                <Text c="dimmed" size="xs">
                                  {formatPublicationDate(publication.updatedAt)}
                                </Text>
                              </Group>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Paper>
                  )
                })}

                {shouldShowPagination && (
                  <Group justify="center" mt="md">
                    <Pagination
                      aria-label="Страницы публикаций"
                      total={pageCount}
                      value={filters.page}
                      onChange={page => setFilters(current => ({ ...current, page }))}
                    />
                  </Group>
                )}
              </Stack>
            )}
          </div>
        </div>
      </Stack>
    </section>
  )
}
