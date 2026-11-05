import { Button, Paper, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconRefresh, IconAlertCircle } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import type { QueryStateProps } from './types/query-state-props.type'
import styles from './styles/query-state.module.css'

/**
 * Показывает устойчивую геометрию загрузки и восстанавливаемую ошибку.
 *
 * Используется для:
 *  - ожидания данных страницы и повторной загрузки
 */
export const QueryState = (props: QueryStateProps): JSX.Element => {
  const { isLoading, title, onRetry, className, ...rootAttrs } = props
  const rootClassName = cl(styles.root, className)
  if (isLoading) {
    return (
      <Paper {...rootAttrs} withBorder className={rootClassName} aria-busy="true" aria-label={title}>
        <Stack gap="xl">
          <Skeleton height={24} width="40%" />
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Text size="sm" c="dimmed" role="status">
            Загружаем данные…
          </Text>
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper {...rootAttrs} withBorder className={rootClassName}>
      <Stack align="center" py="xl" gap="md">
        <ThemeIcon size={48} radius="xl" color="orange" variant="light">
          <IconAlertCircle size={24} />
        </ThemeIcon>
        <Title order={2} size="h3">
          {title}
        </Title>
        <Text c="dimmed" ta="center" maw={380}>
          Проверьте соединение и попробуйте ещё раз.
        </Text>
        <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={onRetry}>
          Повторить загрузку
        </Button>
      </Stack>
    </Paper>
  )
}
