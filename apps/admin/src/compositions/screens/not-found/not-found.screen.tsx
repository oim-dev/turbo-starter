import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'

/**
 * Показывает состояние неизвестного URL.
 *
 * Используется для:
 *  - возврата в приложение по несуществующему адресу
 */
export const NotFoundScreen = () => (
  <Center component="main" mih="100svh" p="md">
    <Stack align="center" gap="md">
      <Title order={1}>Страница не найдена</Title>
      <Text c="dimmed">Проверьте адрес или вернитесь в приложение.</Text>
      <Button component={Link} to="/">На главную</Button>
    </Stack>
  </Center>
)
