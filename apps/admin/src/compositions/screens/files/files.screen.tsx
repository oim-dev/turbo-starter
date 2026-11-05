import { ActionIcon, Alert, Badge, Button, Group, Pagination, Select, Text, TextInput, Title, Tooltip } from '@mantine/core'
import { useDebouncedCallback, useFocusReturn } from '@mantine/hooks'
import { IconCloudUpload, IconRefresh, IconSearch, IconX } from '@tabler/icons-react'
import cl from 'clsx'
import { useState } from 'react'
import type { JSX } from 'react'
import { FILE_STATUS, getFileErrorMessage, getFileStatusLabel, useFileActions, useGetFile, useGetFileFacets, useGetFiles } from 'domains/files'
import type { FileFilters, ProjectFile } from 'domains/files'
import { usePermission } from 'domains/management/auth'
import { useNativeFileDrop } from 'infra/native-file-drop'
import type { NativeFileDrop } from 'infra/native-file-drop'
import { isEmptyArray, isOneOf } from 'shared/value-predicates'
import { FileList } from 'compositions/screens/files/ui/file-list'
import { FileDetails } from 'compositions/screens/files/ui/file-details'
import { FileUpload } from 'compositions/screens/files/ui/file-upload'
import { FileDropOverlay } from './ui/file-drop-overlay/file-drop-overlay'
import { getPaginationControlProps } from './helpers/get-pagination-control-props'
import type { FilesScreenProps } from './types/files-screen-props.type'
import styles from './styles/files.module.css'

/**
 * Собирает библиотеку документов, загрузку и версионирование.
 *
 * Используется для:
 *  - поиска документов и получения постоянных ссылок
 *  - загрузки документов и новых версий перетаскиванием
 */
export const FilesScreen = (props: FilesScreenProps): JSX.Element => {
  const { className, ...rootAttrs } = props
  const [filters, setFilters] = useState<FileFilters>({ search: '', folder: null, tag: null, status: null, unfiled: false, page: 1, pageSize: 20 })
  const [searchDraft, setSearchDraft] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploadBatch, setUploadBatch] = useState<NativeFileDrop | null>(null)
  const [uploadTarget, setUploadTarget] = useState<Pick<ProjectFile, 'id' | 'title' | 'filename'> | undefined>()
  const [dropError, setDropError] = useState<string | null>(null)
  const canUpload = usePermission('files.upload')
  const canUpdate = usePermission('files.update')
  const actions = useFileActions()
  const listQuery = useGetFiles(filters)
  const facetsQuery = useGetFileFacets()
  const detailQuery = useGetFile(selectedId)
  const file = detailQuery.data
  const facets = facetsQuery.data
  const files = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))
  const hasPagination = totalPages > 1
  const hasFilters = filters.search !== '' || filters.folder !== null || filters.tag !== null || filters.status !== null || filters.unfiled
  const isUploadOpened = uploadBatch !== null && canUpload
  useFocusReturn({ opened: isUploadOpened || selectedId !== null })
  const listError = listQuery.error === undefined ? undefined : getFileErrorMessage(listQuery.error)
  const detailError = detailQuery.error === undefined ? undefined : getFileErrorMessage(detailQuery.error)
  const facetsError = facetsQuery.error === undefined ? null : getFileErrorMessage(facetsQuery.error)
  const folderItems = [{ value: '__all', label: 'Все папки' }, { value: '__unfiled', label: `Без папки · ${facets?.unfiledCount ?? 0}` }, ...(facets?.folders.map((folder) => ({ value: `folder:${folder.name}`, label: `${folder.name} · ${folder.count}` })) ?? [])]
  const folderValue = filters.unfiled ? '__unfiled' : filters.folder === null ? '__all' : `folder:${filters.folder}`
  const tagItems = facets?.tags.map((tag) => ({ value: tag.name, label: `${tag.name} · ${tag.count}` })) ?? []
  const statusItems = Object.values(FILE_STATUS).map((status) => ({ value: status, label: getFileStatusLabel(status) }))
  const countLabel = listQuery.isLoading ? 'Загружаем документы…' : `Найдено файлов: ${total}`
  const targetTitle = file?.status === 'ready' ? file.title || file.filename : undefined
  /**
   * Повторяет чтение документов и классификации.
   */
  const handleRefresh = (): void => { void actions.refresh() }
  const handleSearch = useDebouncedCallback((search: string) => setFilters((current) => ({ ...current, search: search.trim(), page: 1 })), 300)
  /**
   * Применяет фильтры с возвратом на первую страницу.
   */
  const handleFilters = (patch: Partial<FileFilters>): void => {
    handleSearch.cancel()
    setFilters((current) => ({ ...current, search: searchDraft.trim(), ...patch, page: 1 }))
  }
  /**
   * Проверяет значение фильтра готовности.
   */
  const handleStatus = (status: string | null): void => {
    handleFilters({ status: isOneOf(status, Object.values(FILE_STATUS)) ? status : null })
  }
  /**
   * Отделяет служебные варианты выбора папки от настоящих имён.
   */
  const handleFolder = (folder: string | null): void => {
    handleFilters({ folder: folder?.startsWith('folder:') ? folder.slice(7) : null, unfiled: folder === '__unfiled' })
  }
  /**
   * Снимает все фильтры.
   */
  const handleReset = (): void => {
    handleSearch.cancel()
    setSearchDraft('')
    setFilters({ search: '', folder: null, tag: null, status: null, unfiled: false, page: 1, pageSize: 20 })
  }
  /**
   * Выбирает режим загрузчика до передачи ему первой пачки.
   */
  const handleOpenUpload = (batch: NativeFileDrop, isVersion = false): void => {
    if (!canUpload) { setDropError('Для загрузки файлов необходимо право files.upload.'); return }
    if (isVersion && file?.status !== 'ready') { setDropError('Для новой версии откройте готовый документ.'); return }
    setUploadTarget(isVersion && file !== undefined ? { id: file.id, filename: file.filename, title: file.title } : undefined)
    setUploadBatch(batch)
    setDropError(null)
  }
  /**
   * Перетаскивание в открытом паспорте относится к версии этого документа.
   */
  const handlePageDrop = (batch: NativeFileDrop): void => {
    if (isEmptyArray(batch.files) && batch.directoryCount === 0) { setDropError('Перетащите файлы с устройства.'); return }
    handleOpenUpload(batch, selectedId !== null)
  }
  const isDragging = useNativeFileDrop({ isEnabled: !isUploadOpened, canDrop: canUpload, onDrop: handlePageDrop })
  /**
   * Закрывает локальную очередь и перечитывает результат.
   */
  const handleCloseUpload = (): void => { setUploadBatch(null); handleRefresh() }
  /**
   * Показывает новые документы либо сохраняет открытым паспорт обновлённого.
   */
  const handleFinished = (): void => { if (uploadTarget === undefined) handleReset(); handleCloseUpload() }

  return (
    <section {...rootAttrs} className={cl(styles.root, className)} aria-labelledby="files-heading">
      <header className={styles.heading}>
        <div><Group gap="sm" mb={6}><Title id="files-heading" order={1} className={styles.title}>Файлы</Title><Badge color="gray" variant="light" size="lg" c="var(--app-color-text-strong)">{facets?.total ?? '—'}</Badge></Group><Text size="sm" c="dimmed">Документы проекта, постоянные ссылки и история версий</Text></div>
        {canUpload && (
          <Button size="md" leftSection={<IconCloudUpload size={19} />} onClick={() => handleOpenUpload({ files: [], directoryCount: 0 })}>Загрузить файлы</Button>
        )}
      </header>
      {canUpload && (
        <Text size="sm" c="dimmed">Перетащите документы на страницу — загрузчик откроется автоматически.</Text>
      )}
      {dropError !== null && (
        <Alert color="orange" role="alert" withCloseButton closeButtonLabel="Закрыть уведомление" onClose={() => setDropError(null)}>{dropError}</Alert>
      )}
      {isDragging && (
        <FileDropOverlay canUpload={canUpload} targetTitle={targetTitle} />
      )}
      <div className={styles.toolbar}>
        <TextInput className={styles.search} value={searchDraft} onChange={(event) => { setSearchDraft(event.currentTarget.value); handleSearch(event.currentTarget.value) }} placeholder="Имя, ID или URL файла" aria-label="Поиск файлов" size="md" leftSection={<IconSearch size={18} />} />
        <Select aria-label="Статус файла" placeholder="Все статусы" clearable data={statusItems} value={filters.status} onChange={handleStatus} size="md" />
      </div>
      <div className={styles.filters}>
        <Select aria-label="Папка файлов" data={folderItems} value={folderValue} onChange={handleFolder} searchable />
        <Select aria-label="Тег файлов" placeholder="Все теги" clearable searchable data={tagItems} value={filters.tag} onChange={(tag) => handleFilters({ tag })} />
      </div>
      {facetsError !== null && (
        <Alert color="orange" role="alert">Не удалось обновить папки и теги. {facetsError}</Alert>
      )}
      <Group justify="space-between" gap="xs"><Text size="sm" c="dimmed" aria-live="polite">{countLabel}</Text><Group gap="xs">
        {hasFilters && (
          <Button variant="subtle" size="xs" color="gray" leftSection={<IconX size={14} />} onClick={handleReset}>Сбросить</Button>
        )}
        <Tooltip label="Обновить файлы"><ActionIcon variant="default" size="lg" aria-label="Обновить файлы" loading={listQuery.isValidating} onClick={handleRefresh}><IconRefresh size={18} /></ActionIcon></Tooltip>
      </Group></Group>
      <FileList files={files} isLoading={listQuery.isLoading} errorMessage={listError} hasFilters={hasFilters} onOpen={setSelectedId} onRetry={handleRefresh} onReset={handleReset} />
      {hasPagination && (
        <Group justify="center"><Pagination total={totalPages} value={filters.page} onChange={(page) => setFilters((current) => ({ ...current, page }))} siblings={0} getControlProps={getPaginationControlProps} /></Group>
      )}
      <FileDetails key={selectedId} file={file} isOpened={selectedId !== null} isLoading={detailQuery.isLoading} errorMessage={detailError} facets={facets} canUpdate={canUpdate} canUpload={canUpload} onVersion={() => handleOpenUpload({ files: [], directoryCount: 0 }, true)} onClose={() => setSelectedId(null)} onRefresh={handleRefresh} onSave={actions.save} />
      {isUploadOpened && uploadBatch !== null && (
        <FileUpload initialBatch={uploadBatch} initialFolder={filters.folder} target={uploadTarget} facets={facets} onUpload={actions.upload} onClose={handleCloseUpload} onFinished={handleFinished} />
      )}
    </section>
  )
}
