import { Portal, Text, ThemeIcon } from '@mantine/core'
import { IconCloudUpload, IconLock } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import type { FileDropOverlayProps } from './types/file-drop-overlay-props.type'
import styles from './styles/file-drop-overlay.module.css'

/**
 * Подсвечивает назначение перетаскиваемого документа поверх страницы.
 *
 * Используется для:
 *  - открытия загрузчика новых файлов или версии выбранного документа
 */
export const FileDropOverlay = (props: FileDropOverlayProps): JSX.Element => {
  const { canUpload, targetTitle, className, ...rootAttrs } = props
  const DropIcon = canUpload ? IconCloudUpload : IconLock
  const title = canUpload ? targetTitle === undefined ? 'Добавить документы' : 'Добавить новую версию' : 'Загрузка недоступна'
  const description = canUpload ? targetTitle ?? 'Отпустите файлы — откроется загрузчик' : 'Для загрузки необходимо право files.upload.'

  return (
    <Portal><div {...rootAttrs} className={cl(styles.root, className)} role="status"><div className={styles.panel}><ThemeIcon size={72} radius="xl" variant="light"><DropIcon size={40} /></ThemeIcon><Text size="xl" fw={700}>{title}</Text><Text className={styles.description} size="sm">{description}</Text></div></div></Portal>
  )
}
