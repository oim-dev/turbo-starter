import { Button, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconCloudExclamation, IconLibraryPhoto, IconSearch } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { isDefined, isEmptyArray } from 'shared/value-predicates'
import { ImageCard } from './ui/image-card/image-card'
import type { ImageGridProps } from './types/image-grid-props.type'
import styles from './styles/image-grid.module.css'

/**
 * Показывает адаптивную коллекцию изображений со всеми состояниями списка.
 *
 * Используется для:
 *  - просмотра страницы медиатеки
 *  - восстановления загрузки и пустого поиска
 */
export const ImageGrid = (props: ImageGridProps): JSX.Element => {
  const { images, isLoading, hasFilters, canUpload, errorMessage, onRetry, onReset, onUpload, onOpen,
    className, ...rootAttrs } = props
  const EmptyIcon = hasFilters ? IconSearch : IconLibraryPhoto
  const emptyTitle = hasFilters ? 'Ничего не нашлось' : 'Место для ваших изображений'
  const emptyDescription = hasFilters
    ? 'Попробуйте другое название, папку или тег — нужный файл может быть совсем рядом.'
    : 'Загрузите первые фотографии и иллюстрации. Мы подготовим размеры, а вы сможете собрать удобную медиатеку.'
  const emptyAction = hasFilters ? onReset : onUpload
  const emptyActionLabel = hasFilters ? 'Сбросить фильтры' : 'Загрузить изображения'
  const canShowAction = hasFilters || canUpload

  if (isLoading) {
    return (
      <div className={styles.root} aria-label="Загрузка изображений" aria-busy="true">
        {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className={styles.skeleton} />)}
      </div>
    )
  }
  if (isDefined(errorMessage)) {
    return (
      <Stack className={styles.empty} align="center" gap="md" role="alert">
        <ThemeIcon size={64} radius="xl" color="red" variant="light"><IconCloudExclamation size={30} /></ThemeIcon>
        <Title order={3}>Не удалось открыть медиатеку</Title>
        <Text c="dimmed" ta="center" maw={400}>{errorMessage}</Text>
        <Button variant="light" onClick={onRetry}>Повторить загрузку</Button>
      </Stack>
    )
  }
  if (isEmptyArray(images)) {
    return (
      <Stack className={styles.empty} align="center" gap="md">
        <ThemeIcon size={72} radius={24} variant="light"><EmptyIcon size={34} aria-hidden="true" /></ThemeIcon>
        <Title order={3} ta="center">{emptyTitle}</Title>
        <Text c="dimmed" ta="center" maw={410} lh={1.7}>{emptyDescription}</Text>
        {canShowAction && (
          <Button variant="light" onClick={emptyAction} mt="xs">{emptyActionLabel}</Button>
        )}
      </Stack>
    )
  }

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      {images.map((image) => <ImageCard key={image.id} image={image} onOpen={onOpen} />)}
    </div>
  )
}
