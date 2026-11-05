import { Alert, Button, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconFiles } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { isEmptyArray } from 'shared/value-predicates'
import { FileRow } from './ui/file-row/file-row'
import type { FileListProps } from './types/file-list-props.type'
import styles from './styles/file-list.module.css'

/**
 * Показывает адаптивный список документов и состояния чтения.
 *
 * Используется для:
 *  - выбора документа, открытия и копирования ссылки
 *  - отображения пустого результата и повторного чтения
 */
export const FileList = (props: FileListProps): JSX.Element => {
  const { files, isLoading, errorMessage, hasFilters, onOpen, onRetry, onReset, className, ...rootAttrs } = props
  if (isLoading) return <Stack aria-label="Загружаем файлы"><Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} /></Stack>
  if (errorMessage !== undefined) return <Alert color="red" title="Не удалось получить файлы" role="alert"><Text size="sm">{errorMessage}</Text><Button variant="light" color="red" mt="sm" onClick={onRetry}>Повторить</Button></Alert>
  const emptyTitle = hasFilters ? 'Файлы не найдены' : 'Добавьте первый документ'
  const emptyDescription = hasFilters ? 'Попробуйте другое имя или снимите фильтры.' : 'Загрузите документы, чтобы прикреплять их к постам постоянными ссылками.'
  if (isEmptyArray(files)) return (
    <div className={styles.empty}>
      <ThemeIcon size={60} radius="xl" variant="light" color="gray"><IconFiles size={30} /></ThemeIcon>
      <Title order={2} size="h3">{emptyTitle}</Title>
      <Text c="dimmed" size="sm" maw={380}>{emptyDescription}</Text>
      {hasFilters && (
        <Button variant="default" onClick={onReset}>Сбросить фильтры</Button>
      )}
    </div>
  )

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <div className={styles.columns} aria-hidden="true"><span>Документ</span><span>Размер</span><span>Папка</span><span>Загружен</span><span>Действия</span></div>
      <ul className={styles.list} aria-label="Документы">
        {files.map((file) => <FileRow key={file.id} file={file} onOpen={onOpen} />)}
      </ul>
    </div>
  )
}
