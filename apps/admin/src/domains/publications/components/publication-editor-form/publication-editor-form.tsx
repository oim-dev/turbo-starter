import {
  isDefined,
  isEmptyArray,
  isNonEmptyString,
  isNotDefined
} from '@biocad/value-predicates'
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  List,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  VisuallyHidden
} from '@mantine/core'
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArrowLeft,
  IconCloudDownload,
  IconDeviceFloppy,
  IconEye,
  IconEyeOff
} from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import cl from 'clsx'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBeforeUnload, useBlocker, useNavigate } from 'react-router-dom'

import { isPublicationError } from '../../errors/publication.error'
import {
  createEmptyPublicationDraft,
  createPublicationDraft,
  getPublicationDraftValidationError,
  getPublicationPublishValidationIssues,
  isPublicationDraftDirty
} from '../../lib/publication-form'
import { publicationQueryKeys } from '../../lib/publication-query-keys'
import {
  createPublication,
  publishPublication,
  unpublishPublication,
  updatePublication
} from '../../services/publications.service'
import type { PublicationDraft } from '../../types/publication.type'
import { PublicationCoverField } from '../publication-cover-field'
import { PublicationRichTextEditor } from '../publication-rich-text-editor'
import type { PublicationEditorFormProps } from './types/publication-editor-form-props.type'
import styles from './styles/publication-editor-form.module.css'

/**
 * Редактирует publication draft, защищая несохранённые изменения и optimistic version.
 *
 * Используется для:
 *  - ручного создания или сохранения публикации
 *  - отдельной публикации и снятия с публикации
 *  - явного восстановления после version conflict
 */
export const PublicationEditorForm = (props: PublicationEditorFormProps) => {
  const { categories, publication, onReloadLatest, className, ...rootAttrs } = props
  const initialDraft = publication
    ? createPublicationDraft(publication)
    : createEmptyPublicationDraft()
  const [draft, setDraft] = useState<PublicationDraft>(initialDraft)
  const [savedDraft, setSavedDraft] = useState<PublicationDraft>(initialDraft)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [reloadError, setReloadError] = useState<string | null>(null)
  const [isSettingsOpened, setIsSettingsOpened] = useState(false)
  const saveControllerRef = useRef<AbortController | null>(null)
  const statusControllerRef = useRef<AbortController | null>(null)
  const allowNavigationRef = useRef(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isCreateMode = isNotDefined(publication)
  const isDirty = isPublicationDraftDirty(draft, savedDraft)
  const saveMutation = useMutation({
    mutationFn: () => {
      saveControllerRef.current?.abort()
      const controller = new AbortController()
      saveControllerRef.current = controller

      if (isNotDefined(publication)) {
        return createPublication(draft, controller.signal).finally(() => {
          if (saveControllerRef.current === controller) {
            saveControllerRef.current = null
          }
        })
      }

      return updatePublication(
        publication.id,
        publication.version,
        draft,
        controller.signal
      ).finally(() => {
        if (saveControllerRef.current === controller) {
          saveControllerRef.current = null
        }
      })
    }
  })
  const statusMutation = useMutation({
    mutationFn: () => {
      if (isNotDefined(publication)) {
        throw new Error('Publication must be saved before status change')
      }

      statusControllerRef.current?.abort()
      const controller = new AbortController()
      statusControllerRef.current = controller
      const request = publication.status === 'published'
        ? unpublishPublication(publication.id, publication.version, controller.signal)
        : publishPublication(publication.id, publication.version, controller.signal)

      return request.finally(() => {
        if (statusControllerRef.current === controller) {
          statusControllerRef.current = null
        }
      })
    }
  })

  useEffect(() => {
    return () => {
      saveControllerRef.current?.abort()
      statusControllerRef.current?.abort()
      saveControllerRef.current = null
      statusControllerRef.current = null
    }
  }, [])
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return !allowNavigationRef.current
      && isDirty
      && currentLocation.pathname !== nextLocation.pathname
  })
  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent): void => {
    if (isDirty) {
      event.preventDefault()
    }
  }, [isDirty])
  useBeforeUnload(handleBeforeUnload)
  const isPublished = publication?.status === 'published'
  const statusActionLabel = isPublished ? 'Снять с публикации' : 'Опубликовать'
  const StatusActionIcon = isPublished ? IconEyeOff : IconEye
  const editorTitle = isCreateMode ? 'Новая публикация' : 'Редактирование публикации'
  const statusBadgeColor = isPublished ? 'teal' : 'gray'
  const statusBadgeLabel = isPublished ? 'Опубликовано' : 'Черновик'
  const statusActionColor = isPublished ? 'orange' : 'teal'
  const publishValidationIssues = getPublicationPublishValidationIssues(draft)
  const hasPublishValidationIssues = !isEmptyArray(publishValidationIssues)
  const hasIncompleteSettings = !isNonEmptyString(draft.categoryId)
    || !isNonEmptyString(draft.slug)
    || !isNonEmptyString(draft.excerpt)
    || isNotDefined(draft.cover)
    || !isNonEmptyString(draft.coverAlt)
  const hasVersionConflict = isPublicationError(saveMutation.error, 'VERSION_CONFLICT')
    || isPublicationError(statusMutation.error, 'VERSION_CONFLICT')
  const saveError = isPublicationError(saveMutation.error) ? saveMutation.error.message : null
  const statusError = isPublicationError(statusMutation.error) ? statusMutation.error.message : null

  /**
   * Сохраняет draft вручную и синхронизирует React Query cache.
   */
  const handleSave = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const nextValidationError = getPublicationDraftValidationError(draft)
    setValidationError(nextValidationError)

    if (isDefined(nextValidationError) && isNonEmptyString(draft.title)) {
      setIsSettingsOpened(true)
    }

    if (
      isDefined(nextValidationError)
      || saveMutation.isPending
      || (!isCreateMode && !isDirty)
    ) {
      return
    }

    try {
      const savedPublication = await saveMutation.mutateAsync()
      const nextSavedDraft = createPublicationDraft(savedPublication)
      setDraft(nextSavedDraft)
      setSavedDraft(nextSavedDraft)
      queryClient.setQueryData(
        publicationQueryKeys.detail(savedPublication.id),
        savedPublication
      )
      await queryClient.invalidateQueries({ queryKey: publicationQueryKeys.lists })

      if (isCreateMode) {
        allowNavigationRef.current = true
        navigate(`/publications/${savedPublication.id}`, { replace: true })
      }
    } catch {
      // Mutation state отображает нормализованную доменную ошибку.
    }
  }

  /**
   * Меняет publication status отдельно от ручного сохранения формы.
   */
  const handleStatusChange = async (): Promise<void> => {
    if (isNotDefined(publication) || isDirty || statusMutation.isPending) {
      return
    }

    if (!isPublished && hasPublishValidationIssues) {
      setValidationError('Заполните обязательные данные перед публикацией.')
      setIsSettingsOpened(true)
      return
    }

    try {
      const savedPublication = await statusMutation.mutateAsync()
      queryClient.setQueryData(
        publicationQueryKeys.detail(savedPublication.id),
        savedPublication
      )
      await queryClient.invalidateQueries({ queryKey: publicationQueryKeys.lists })
    } catch {
      // Mutation state отображает нормализованную доменную ошибку.
    }
  }

  /**
   * Отбрасывает локальный draft и получает актуальную server version.
   */
  const handleReloadLatest = async (): Promise<void> => {
    if (!onReloadLatest) {
      return
    }

    setReloadError(null)

    try {
      await onReloadLatest()
      saveMutation.reset()
      statusMutation.reset()
    } catch {
      setReloadError('Не удалось загрузить актуальную версию публикации.')
    }
  }

  /**
   * Продолжает заблокированную client-side навигацию с потерей draft.
   */
  const handleDiscardAndNavigate = (): void => {
    if (blocker.state === 'blocked') {
      blocker.proceed()
    }
  }

  /**
   * Отменяет заблокированную client-side навигацию.
   */
  const handleStayOnPage = (): void => {
    if (blocker.state === 'blocked') {
      blocker.reset()
    }
  }

  /**
   * Обновляет поля draft и скрывает устаревшую validation ошибку.
   */
  const handleDraftChange = (fields: Partial<PublicationDraft>): void => {
    setDraft(current => ({ ...current, ...fields }))
    setValidationError(null)
  }

  return (
    <section
      {...rootAttrs}
      className={cl(styles.root, className)}
      aria-labelledby="publication-editor-title"
    >
      <form
        className={styles.form}
        id="publication-editor-form"
        onSubmit={event => void handleSave(event)}
      >
        <div className={styles.workspaceHeader}>
          <Button
            aria-label="К списку публикаций"
            className={styles.backLink}
            component={Link}
            leftSection={<IconArrowLeft size={16} />}
            size="compact-sm"
            to="/publications"
            variant="subtle"
          >
            Публикации
          </Button>
          <div className={styles.headerMain}>
            <Group gap="xs" wrap="wrap">
              <Title id="publication-editor-title" order={1} size="h4">
                {editorTitle}
              </Title>
              {!isCreateMode && (
                <Badge color={statusBadgeColor} variant="light">
                  {statusBadgeLabel}
                </Badge>
              )}
              {isDirty && <Badge color="orange">Не сохранено</Badge>}
            </Group>
            <div className={styles.headerActions}>
              <Button
                color={hasIncompleteSettings ? 'orange' : 'gray'}
                leftSection={<IconAdjustmentsHorizontal size={17} />}
                type="button"
                variant="light"
                onClick={() => setIsSettingsOpened(true)}
              >
                Параметры
              </Button>
              {!isCreateMode && (
                <Button
                  color={statusActionColor}
                  disabled={isDirty || saveMutation.isPending}
                  leftSection={<StatusActionIcon size={17} />}
                  loading={statusMutation.isPending}
                  type="button"
                  variant="light"
                  onClick={() => void handleStatusChange()}
                >
                  {statusActionLabel}
                </Button>
              )}
              <Button
                leftSection={<IconDeviceFloppy size={17} />}
                disabled={statusMutation.isPending || (!isCreateMode && !isDirty)}
                loading={saveMutation.isPending}
                type="submit"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </div>

        <Stack className={styles.feedback} gap="sm">

          {validationError && (
            <Alert color="yellow" icon={<IconAlertTriangle />} title="Проверьте поля">
              {validationError}
            </Alert>
          )}

          {hasVersionConflict && (
            <Alert color="orange" icon={<IconCloudDownload />} title="Есть более новая версия">
              <Stack gap="sm">
                <Text size="sm">
                  Публикация была изменена в другой сессии. Локальные изменения не отправлены.
                </Text>
                <Button
                  color="orange"
                  type="button"
                  variant="light"
                  onClick={() => void handleReloadLatest()}
                >
                  Reload latest
                </Button>
              </Stack>
            </Alert>
          )}

          {reloadError && (
            <Alert color="red" icon={<IconAlertTriangle />}>
              {reloadError}
            </Alert>
          )}

          {saveMutation.isError && !hasVersionConflict && (
            <Alert color="red" icon={<IconAlertTriangle />} title="Публикация не сохранена">
              {saveError ?? 'Не удалось сохранить публикацию.'}
            </Alert>
          )}

          {statusMutation.isError && !hasVersionConflict && (
            <Alert color="red" icon={<IconAlertTriangle />} title="Статус не изменён">
              {statusError ?? 'Не удалось изменить статус публикации.'}
            </Alert>
          )}
        </Stack>

        <div className={styles.workspace}>
          <TextInput
            required
            aria-label="Заголовок публикации"
            className={styles.titleField}
            maxLength={300}
            placeholder="Заголовок публикации"
            value={draft.title}
            onChange={event => {
              const title = event.currentTarget.value

              handleDraftChange({ title })
            }}
          />
          <div className={styles.editorShell}>
            <VisuallyHidden id="publication-body-label">Текст публикации</VisuallyHidden>
            <PublicationRichTextEditor
              artifacts={publication?.mediaArtifacts ?? []}
              title={draft.title}
              value={draft.body}
              onChange={body => handleDraftChange({ body })}
            />
          </div>
        </div>
      </form>

      <Drawer
        closeButtonProps={{ 'aria-label': 'Закрыть параметры публикации' }}
        opened={isSettingsOpened}
        overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
        padding="xl"
        position="right"
        size="md"
        title="Параметры публикации"
        onClose={() => setIsSettingsOpened(false)}
      >
        <Stack gap="lg">
          <Text c="dimmed" size="sm">
            Эти данные используются в списке публикаций, адресе страницы и поисковой выдаче.
          </Text>
          {!isPublished && hasPublishValidationIssues && (
            <Alert color="orange" icon={<IconAlertTriangle />} title="Для публикации осталось">
              <List size="sm" spacing="xs">
                {publishValidationIssues.map(issue => (
                  <List.Item key={issue}>{issue}</List.Item>
                ))}
              </List>
            </Alert>
          )}
          <Select
            required
            allowDeselect={false}
            data={categories.map(category => ({ label: category.name, value: category.id }))}
            label="Категория"
            placeholder="Выберите категорию"
            value={draft.categoryId}
            onChange={value => {
              if (isNonEmptyString(value)) {
                handleDraftChange({ categoryId: value })
              }
            }}
          />
          <TextInput
            required
            description="Латиница, цифры и дефисы"
            label="Slug"
            maxLength={200}
            value={draft.slug}
            onChange={event => {
              const slug = event.currentTarget.value

              handleDraftChange({ slug })
            }}
          />
          <Textarea
            autosize
            label="Анонс"
            maxLength={1_000}
            minRows={4}
            value={draft.excerpt}
            onChange={event => {
              const excerpt = event.currentTarget.value

              handleDraftChange({ excerpt })
            }}
          />
          <PublicationCoverField
            alt={draft.coverAlt}
            value={draft.cover}
            onChange={cover => handleDraftChange({ cover })}
          />
          <TextInput
            label="Alt обложки"
            maxLength={500}
            required={isDefined(draft.cover)}
            value={draft.coverAlt}
            onChange={event => {
              const coverAlt = event.currentTarget.value

              handleDraftChange({ coverAlt })
            }}
          />
          <Button
            fullWidth
            type="button"
            variant="default"
            onClick={() => setIsSettingsOpened(false)}
          >
            Готово
          </Button>
        </Stack>
      </Drawer>

      <Modal
        closeOnClickOutside={false}
        closeOnEscape={false}
        opened={blocker.state === 'blocked'}
        title="Покинуть страницу без сохранения?"
        onClose={handleStayOnPage}
      >
        <Stack>
          <Text>
            Несохранённые изменения будут потеряны.
          </Text>
          <div className={styles.navigationModalActions}>
            <Button type="button" variant="default" onClick={handleStayOnPage}>
              Остаться
            </Button>
            <Button color="red" type="button" onClick={handleDiscardAndNavigate}>
              Покинуть страницу
            </Button>
          </div>
        </Stack>
      </Modal>
    </section>
  )
}
