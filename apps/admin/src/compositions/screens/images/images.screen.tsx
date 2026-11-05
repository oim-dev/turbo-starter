import { ActionIcon, Alert, Badge, Button, Drawer, Group, Loader, Pagination, Select, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core'
import { useDebouncedCallback, useDisclosure, useFocusReturn, useReducedMotion } from '@mantine/hooks'
import { IconCloudUpload, IconFolder, IconRefresh, IconSearch, IconTag, IconX } from '@tabler/icons-react'
import cl from 'clsx'
import { useState } from 'react'
import type { JSX } from 'react'
import { IMAGE_STATUS, formatImageCount, getImageStatusLabel, isImagePending, getImageErrorMessage,
  useGetImages, useGetImage, useGetImageFacets, useImageActions } from 'domains/images'
import type { ImageFilters } from 'domains/images'
import { usePermission } from 'domains/management/auth'
import { useNativeFileDrop } from 'infra/native-file-drop'
import type { NativeFileDrop } from 'infra/native-file-drop'
import { isEmptyArray, isNonEmptyArray, isOneOf } from 'shared/value-predicates'
import { ImageFolders } from 'compositions/screens/images/ui/image-folders'
import { ImageGrid } from 'compositions/screens/images/ui/image-grid'
import { ImageDetails } from 'compositions/screens/images/ui/image-details'
import { ImageUpload } from 'compositions/screens/images/ui/image-upload'
import type { ImagesScreenProps } from './types/images-screen-props.type'
import { getPaginationControlProps } from './helpers/get-pagination-control-props'
import { ImageDropOverlay } from './ui/image-drop-overlay/image-drop-overlay'
import styles from './styles/images.module.css'

/**
 * Собирает общую медиатеку с поиском, классификацией и загрузкой.
 *
 * Используется для:
 *  - поиска всех изображений проекта
 *  - загрузки оригиналов и просмотра подробных метаданных
 */
export const ImagesScreen = (props: ImagesScreenProps): JSX.Element => {
  const { className, ...rootAttrs } = props
  const [filters, setFilters] = useState<ImageFilters>({
    search: '', folder: null, tag: null, status: null, unfiled: false, page: 1, pageSize: 24
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailQuery = useGetImage(selectedId)
  const actions = useImageActions()
  const selectedImage = detailQuery.data
  const hasPendingDetails = detailQuery.error === undefined && selectedImage !== undefined && isImagePending(selectedImage)
  const listQuery = useGetImages(filters, selectedId, hasPendingDetails, actions.processing)
  const facetsQuery = useGetImageFacets()
  const page = listQuery.data
  const facets = facetsQuery.data
  const isLoading = listQuery.isLoading
  const isValidating = listQuery.isValidating
  const isFacetsLoading = facetsQuery.isLoading
  const isDetailsLoading = detailQuery.isLoading
  const errorMessage = listQuery.error === undefined ? undefined : getImageErrorMessage(listQuery.error)
  const facetsErrorMessage = facetsQuery.error === undefined ? undefined : getImageErrorMessage(facetsQuery.error)
  const detailsErrorMessage = detailQuery.error === undefined ? undefined : getImageErrorMessage(detailQuery.error)
  /**
   * Повторяет только чтение; ошибки сохраняются в соответствующих query states.
   */
  const handleRefresh = (): void => { void actions.refresh() }
  const canUpload = usePermission('images.upload')
  const canUpdate = usePermission('images.update')
  const [searchDraft, setSearchDraft] = useState(filters.search)
  const [uploadBatch, setUploadBatch] = useState<NativeFileDrop | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  const isUploadOpened = uploadBatch !== null && canUpload
  // Экран переживает размонтирование панелей и сохраняет фокус при переходе из очереди в подробности.
  useFocusReturn({ opened: isUploadOpened || selectedId !== null })
  const [isFoldersOpened, foldersDisclosure] = useDisclosure(false)
  const shouldReduceMotion = useReducedMotion()
  const images = page?.items ?? []
  const total = page?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))
  const hasPagination = totalPages > 1
  const hasFilters = filters.search !== '' || filters.folder !== null || filters.tag !== null || filters.status !== null || filters.unfiled
  const isProcessing = images.some(isImagePending) || isNonEmptyArray(actions.processing.pendingIds)
  const hasActiveFolder = filters.folder !== null || filters.unfiled
  const folderTitle = filters.unfiled ? 'Без папки' : filters.folder ?? 'Все изображения'
  const countLabel = isLoading ? 'Загружаем медиатеку' : formatImageCount(total)
  const tags = facets?.tags.map((tag) => ({ value: tag.name, label: `${tag.name} · ${tag.count}` })) ?? []
  const statuses = Object.values(IMAGE_STATUS).map((status) => ({ value: status, label: getImageStatusLabel(status) }))
  /**
   * Передаёт первую пачку вложенному владельцу очереди.
   */
  const handlePageDrop = (batch: NativeFileDrop): void => {
    if (!canUpload) {
      setDropError('Для загрузки изображений необходимо право images.upload. Обратитесь к администратору.')
      return
    }
    if (isEmptyArray(batch.files) && batch.directoryCount === 0) {
      setDropError('В переносе нет доступных файлов. Перетащите изображения с устройства или выберите их кнопкой загрузки.')
      return
    }
    setDropError(null)
    setUploadBatch(batch)
  }
  /**
   * Открывает пустую очередь по явному действию.
   */
  const handleOpenUpload = (): void => {
    if (!canUpload) return
    setDropError(null)
    setUploadBatch({ files: [], directoryCount: 0 })
  }
  const isDragging = useNativeFileDrop({ isEnabled: !isUploadOpened, canDrop: canUpload, onDrop: handlePageDrop })
  /**
   * Применяет фильтр и возвращает список на первую страницу.
   */
  const handleFilters = (patch: Partial<ImageFilters>): void => {
    handleSearch.cancel()
    setFilters((current) => ({ ...current, search: searchDraft.trim(), ...patch, page: 1 }))
  }
  const handleSearch = useDebouncedCallback((search: string) => {
    setFilters((current) => ({ ...current, search: search.trim(), page: 1 }))
  }, 300)
  /**
   * Применяет проверенное состояние без вычислений внутри JSX.
   */
  const handleStatus = (status: string | null): void => {
    const selectedStatus = isOneOf(status, Object.values(IMAGE_STATUS)) ? status : null
    handleFilters({ status: selectedStatus })
  }
  /**
   * Выбирает папку в любой адаптивной панели.
   */
  const handleFolder = (folder: string | null, isUnfiled: boolean): void => {
    handleSearch.cancel()
    handleFilters({ folder, unfiled: isUnfiled })
    foldersDisclosure.close()
  }
  /**
   * Снимает фильтры, сохраняя выбранный размер страницы.
   */
  const handleReset = (): void => {
    handleSearch.cancel()
    setSearchDraft('')
    setFilters({ search: '', folder: null, unfiled: false, tag: null, status: null, page: 1, pageSize: filters.pageSize })
  }
  /**
   * Показывает свежие загрузки и закрывает форму после завершения передачи.
   */
  const handleUploaded = (): void => {
    setUploadBatch(null)
    handleReset()
    handleRefresh()
  }
  /**
   * Закрывает локальную очередь, сохраняя подтверждённые файлы в медиатеке.
   */
  const handleCloseUpload = (): void => {
    setUploadBatch(null)
    handleRefresh()
  }
  /**
   * Открывает канонический результат новой загрузки или найденного дубликата.
   */
  const handleOpenUploadedImage = (id: string): void => {
    setUploadBatch(null)
    setSelectedId(id)
  }

  return (
    <section {...rootAttrs} className={cl(styles.root, className)} aria-labelledby="images-heading">
      <header className={styles.heading}>
        <div>
          <Group gap="sm" mb={6}>
            <Title id="images-heading" order={1} className={styles.title}>Изображения</Title>
            <Badge color="gray" variant="light" size="lg" c="var(--app-color-text-strong)">{facets?.total ?? '—'}</Badge>
          </Group>
          <Text c="dimmed" size="sm">Все визуальные материалы проекта — в одном месте</Text>
        </div>
        {canUpload && (
          <Button className={styles.uploadButton} size="md" leftSection={<IconCloudUpload size={19} />} onClick={handleOpenUpload}>
            Загрузить изображения
          </Button>
        )}
      </header>
      {canUpload && (
        <Text size="sm" c="dimmed">Перетащите изображения на страницу или выберите файлы через «Загрузить изображения».</Text>
      )}
      {dropError !== null && (
        <Alert color="orange" role="alert" withCloseButton closeButtonLabel="Закрыть уведомление" onClose={() => setDropError(null)}>{dropError}</Alert>
      )}
      {isDragging && (
        <ImageDropOverlay canUpload={canUpload} />
      )}
      <div className={styles.workspace}>
        <aside className={styles.folders}>
          <ImageFolders facets={facets} folder={filters.folder} isUnfiled={filters.unfiled} isLoading={isFacetsLoading} errorMessage={facetsErrorMessage} onRetry={handleRefresh} onSelect={handleFolder} />
        </aside>
        <Stack gap="lg" className={styles.content}>
          <div className={styles.toolbar}>
            <TextInput
              className={styles.search}
              value={searchDraft}
              onChange={(event) => {
                setSearchDraft(event.currentTarget.value)
                handleSearch(event.currentTarget.value)
              }}
              placeholder="Имя, ID или URL изображения"
              aria-label="Поиск изображений по имени, ID или URL"
              leftSection={<IconSearch size={18} aria-hidden="true" />}
              size="md"
            />
            <Select aria-label="Фильтр по тегу" placeholder="Все теги" clearable searchable data={tags} value={filters.tag} onChange={(tag) => handleFilters({ tag })} leftSection={<IconTag size={16} aria-hidden="true" />} className={styles.filter} size="md" />
            <Select
              aria-label="Фильтр по статусу"
              placeholder="Все статусы"
              clearable
              data={statuses}
              value={filters.status}
              onChange={handleStatus}
              className={styles.filter}
              size="md"
            />
          </div>
          <Group justify="space-between" gap="xs">
            <Group gap="sm">
              <Button variant="default" className={styles.folderToggle} leftSection={<IconFolder size={17} />} onClick={foldersDisclosure.open}>Папки</Button>
              <div className={styles.summary}>
                <Text size="sm" fw={600} truncate title={folderTitle}>{folderTitle}</Text>
                <Text size="xs" c="dimmed" aria-live="polite">{countLabel}</Text>
              </div>
              {isProcessing && (
                <Badge variant="light" size="sm" leftSection={<Loader size={10} />}>Обрабатываем</Badge>
              )}
            </Group>
            <Group gap={4}>
              {hasFilters && (
                <Button variant="subtle" color="gray" size="xs" leftSection={<IconX size={14} />} onClick={handleReset}>Сбросить</Button>
              )}
              <Tooltip label="Обновить медиатеку">
                <ActionIcon variant="default" size="lg" onClick={handleRefresh} loading={isValidating} aria-label="Обновить медиатеку"><IconRefresh size={17} /></ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          {hasActiveFolder && (
            <Text size="xs" c="dimmed">Поиск ограничен выбранной папкой. Выберите «Все изображения», чтобы искать по всему проекту.</Text>
          )}
          <ImageGrid images={images} isLoading={isLoading} hasFilters={hasFilters} canUpload={canUpload} errorMessage={errorMessage} onRetry={handleRefresh} onReset={handleReset} onUpload={handleOpenUpload} onOpen={setSelectedId} />
          {hasPagination && (
            <Group justify="center" pt="md">
              <Pagination
                total={totalPages}
                value={filters.page}
                onChange={(pageNumber) => setFilters((current) => ({ ...current, page: pageNumber }))}
                getControlProps={getPaginationControlProps}
                siblings={0}
              />
            </Group>
          )}
        </Stack>
      </div>
      <Drawer opened={isFoldersOpened} onClose={foldersDisclosure.close} title="Папки медиатеки" size="min(340px, 100%)" closeButtonProps={{ 'aria-label': 'Закрыть папки' }} transitionProps={{ duration: shouldReduceMotion ? 0 : 180 }}>
        <ImageFolders facets={facets} folder={filters.folder} isUnfiled={filters.unfiled} isLoading={isFacetsLoading} errorMessage={facetsErrorMessage} onRetry={handleRefresh} onSelect={handleFolder} />
      </Drawer>
      <ImageDetails key={selectedId} image={selectedImage} isOpened={selectedId !== null} isLoading={isDetailsLoading} errorMessage={detailsErrorMessage} facets={facets} canUpdate={canUpdate} canRetry={canUpload} onClose={() => setSelectedId(null)} onRefresh={handleRefresh} onSave={actions.save} onRetry={actions.retry} onOriginal={actions.original} />
      {isUploadOpened && uploadBatch !== null && (
        <ImageUpload isOpened initialBatch={uploadBatch} initialFolder={filters.folder} facets={facets} onClose={handleCloseUpload} onUpload={actions.upload} onUploaded={handleUploaded} onOpenImage={handleOpenUploadedImage} />
      )}
    </section>
  )
}
