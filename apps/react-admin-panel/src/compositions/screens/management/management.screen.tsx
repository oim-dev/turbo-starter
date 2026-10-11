import { Group, Text, ThemeIcon, Title } from '@mantine/core'
import { IconArrowRight, IconKey, IconListCheck, IconShieldCheck, IconUsers } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { usePermission } from 'domains/management/auth'
import { PageHeading } from 'ui/page-heading'
import type { ManagementScreenProps } from './types/management-screen-props.type'
import styles from './styles/management.module.css'

/**
 * Даёт единую точку входа в настройки административной панели.
 *
 * Используется для:
 *  - выбора управления командой, правами и способом входа
 */
export const ManagementScreen = (props: ManagementScreenProps): JSX.Element => {
  const { className, ...rootAttrs } = props
  const canManageAccess = usePermission('system.access.manage')
  const canReadAccounts = usePermission('accounts.read')
  const canManageKeycloak = usePermission('system.keycloak.manage')
  const sectionItems = [
    {
      to: '/management/users',
      title: 'Команда',
      description: 'Учётные записи сотрудников, их роли и доступ к административной панели.',
      action: 'Пользователи админки',
      icon: IconUsers,
      isAllowed: canReadAccounts
    },
    {
      to: '/management/roles',
      title: 'Роли',
      description: 'Наборы возможностей для сотрудников. Настройте, кто и что может делать в панели.',
      action: 'Управление ролями',
      icon: IconShieldCheck,
      isAllowed: canManageAccess
    },
    {
      to: '/management/permissions',
      title: 'Права доступа',
      description: 'Каталог разрешённых действий с описаниями и списком ролей, которым они доступны.',
      action: 'Открыть каталог',
      icon: IconListCheck,
      isAllowed: canManageAccess
    },
    {
      to: '/management/keycloak',
      title: 'Корпоративный вход',
      description: 'Подключение Keycloak для входа сотрудников с корпоративной учётной записью.',
      action: 'Настроить вход',
      icon: IconKey,
      isAllowed: canManageKeycloak
    }
  ].filter((entry) => entry.isAllowed)

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <PageHeading
        eyebrow="Административная панель"
        title="Панель управления"
        description="Настройте команду, её возможности и способы входа в админку."
      />
      <div className={styles.grid}>
        {sectionItems.map((entry) => {
          const SectionIcon = entry.icon
          return (
            <Link to={entry.to} key={entry.to} className={styles.card}>
              <ThemeIcon variant="light" size={48} radius="lg">
                <SectionIcon size={25} stroke={1.6} aria-hidden="true" />
              </ThemeIcon>
              <Title order={2} size="h3" mt="lg">
                {entry.title}
              </Title>
              <Text c="dimmed" size="sm" mt="sm" lh={1.7}>
                {entry.description}
              </Text>
              <Group justify="space-between" className={styles.action}>
                <Text size="sm" fw={600}>
                  {entry.action}
                </Text>
                <IconArrowRight size={18} aria-hidden="true" />
              </Group>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
