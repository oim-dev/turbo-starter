import cl from 'clsx'
import { IconPhotoOff } from '@tabler/icons-react'
import Image from 'next/image'
import type { JSX } from 'react'
import { useState } from 'react'
import type { PictureProps } from './types/picture-props.type'
import styles from './styles/picture.module.css'

/**
 * Показывает изображение с устойчивой геометрией и доступной заглушкой при ошибке.
 *
 * Используется для:
 *  - просмотра внешних фотографий без кеширования их копии через Next.js Image Optimization
 */
export const Picture = (props: PictureProps): JSX.Element => {
  const { src, alt, fit = 'cover', isEager = false, className, ...rootAttrs } = props
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const isUnavailable = !src || failedSrc === src
  const loading = isEager ? 'eager' : 'lazy'

  if (isUnavailable) {
    return (
      <span {...rootAttrs} className={cl(styles.root, styles._empty, className)} role="img" aria-label={`${alt}: фото недоступно`}>
        <IconPhotoOff size={28} aria-hidden="true" />
        <span>Фото недоступно</span>
      </span>
    )
  }

  return (
    <span {...rootAttrs} className={cl(styles.root, className)}>
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        loading={loading}
        className={cl(styles.image, { [styles._contain]: fit === 'contain' })}
        onError={() => setFailedSrc(src)}
      />
    </span>
  )
}
