import { Alert, Button, Center, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import styles from './styles/route-error-boundary.module.css'
import type { RouteErrorBoundaryProps } from './types/route-error-boundary-props.type'

/**
 * Показывает безопасное сообщение при ошибке маршрута.
 *
 * Используется для:
 *  - восстановления навигации после ошибки маршрутной ветки
 */
export const RouteErrorBoundary = (props: RouteErrorBoundaryProps) => {
  const { className, ...rootAttrs } = props
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `Маршрут завершился с кодом ${error.status}`
    : 'При открытии страницы произошла непредвиденная ошибка'

  return (
    <Center
      {...rootAttrs}
      className={cl(styles.root, className)}
      component="main"
      mih="100svh"
      p="md"
    >
      <Stack maw={480} w="100%" gap="lg">
        <Title order={1}>Не удалось открыть страницу</Title>
        <Alert color="red" title="Ошибка маршрута">
          <Text>{message}</Text>
        </Alert>
        <Button component={Link} to="/">
          Вернуться на главную
        </Button>
      </Stack>
    </Center>
  )
}
