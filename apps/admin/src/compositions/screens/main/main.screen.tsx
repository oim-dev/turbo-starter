import { Badge, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconActivityHeartbeat } from '@tabler/icons-react'
import cl from 'clsx'

import type { MainScreenProps } from './types/main-screen-props.type'
import styles from './styles/main.module.css'

/**
 * Стартовый экран панели администрирования.
 *
 * Используется для:
 *  - подтверждения готовности базового каркаса кабинета
 *  - размещения будущих административных модулей
 */
export const MainScreen = (props: MainScreenProps) => {
  const { className, ...rootAttrs } = props

  return (
    <main {...rootAttrs} className={cl(styles.root, className)} aria-labelledby="main-title">
      <Stack gap="xl">
        <Stack gap={6}>
          <Badge variant="light">
            Admin console
          </Badge>
          <Title id="main-title" order={1}>
            Панель управления
          </Title>
          <Text c="dimmed" maw={680}>
            Базовый интерфейс готов. Доменные разделы и авторизация Keycloak будут подключаться отдельными
            модулями по мере развития продукта.
          </Text>
        </Stack>
        <Paper p="lg" radius="lg" withBorder>
          <Group align="flex-start" gap="md" wrap="nowrap">
            <ThemeIcon color="teal" radius="xl" size="lg" variant="light">
              <IconActivityHeartbeat size={20} stroke={1.7} />
            </ThemeIcon>
            <Stack gap={4}>
              <Text fw={600}>Каркас приложения работает</Text>
              <Text c="dimmed" size="sm">
                Router, Mantine theme, адаптивный layout и SLM-структура подключены.
              </Text>
            </Stack>
          </Group>
        </Paper>
      </Stack>
    </main>
  )
}
