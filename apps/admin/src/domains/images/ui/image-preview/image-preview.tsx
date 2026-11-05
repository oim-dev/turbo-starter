import { Button, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconPhoto, IconPhotoOff } from '@tabler/icons-react'
import { Image } from '@unpic/react/base'
import cl from 'clsx'
import { useState } from 'react'
import type { JSX } from 'react'
import { getImageFormatGroups, getImagePreviewVariants, getImageStatusLabel } from '../../helpers/image-presentation'
import type { ImagePreviewProps } from './types/image-preview-props.type'
import styles from './styles/image-preview.module.css'

/**
 * Показывает опубликованные варианты общей медиатеки либо собственную заглушку.
 *
 * Используется для:
 *  - адаптивных превью карточек и подробностей
 *  - безопасного отображения незавершённой обработки
 */
export const ImagePreview = (props: ImagePreviewProps): JSX.Element => {
  const { image, sizes = '100vw', isContained = false, className, ...rootAttrs } = props
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const previewKey = `${image.id}:${image.updatedAt}:${image.status}`
  const hasLoadError = failedKey === previewKey
  const fallbackVariants = getImagePreviewVariants(image)
  const fallback = fallbackVariants[0]
  const groups = getImageFormatGroups(image.status === 'ready' ? image.variants : [])
  const widths = fallbackVariants.map((variant) => variant.width)
  const sources = groups.map((group) => ({
    format: group.format,
    mimeType: group.variants[0]?.mimeType,
    srcSet: group.variants.map((variant) => `${variant.url} ${variant.width}w`).join(', ')
  }))
  const objectFit = isContained ? 'contain' : 'cover'
  const isFailed = image.status === 'failed' || hasLoadError
  const PlaceholderIcon = isFailed ? IconPhotoOff : IconPhoto
  const placeholderLabel = hasLoadError ? 'Превью недоступно' : getImageStatusLabel(image.status)
  /**
   * Выбирает URL исключительно из полного манифеста, не конструируя преобразования.
   */
  const transformVariant = (_url: string | URL, operations: { width?: number }): string => {
    const exactVariant = fallbackVariants.find((variant) => variant.width === operations.width)
    return exactVariant?.url ?? fallback?.url ?? ''
  }

  if (fallback === undefined || hasLoadError) {
    return (
      <div {...rootAttrs} className={cl(styles.root, styles._placeholder, className)}>
        <Stack gap={4} align="center" p="xs">
          <ThemeIcon size={36} radius="xl" variant="light" color="gray">
            <PlaceholderIcon size={20} aria-hidden="true" />
          </ThemeIcon>
          <Text size="xs" c="dimmed" ta="center">{placeholderLabel}</Text>
          {hasLoadError && (
            <Button
              className={styles.retry}
              size="xs"
              variant="subtle"
              aria-label="Повторить загрузку превью"
              onClick={(event) => {
                event.stopPropagation()
                setFailedKey(null)
              }}
            >
              Повторить
            </Button>
          )}
        </Stack>
      </div>
    )
  }

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <picture className={styles.picture}>
        {sources.map((source) => <source key={source.format} type={source.mimeType} srcSet={source.srcSet} sizes={sizes} />)}
        <Image
          src={fallback.url}
          alt={image.title || image.filename}
          layout="fullWidth"
          aspectRatio={fallback.width / fallback.height}
          breakpoints={widths}
          transformer={transformVariant}
          sizes={sizes}
          objectFit={objectFit}
          unstyled
          className={cl(styles.image, isContained && styles._contained)}
          onError={() => setFailedKey(previewKey)}
        />
      </picture>
    </div>
  )
}
