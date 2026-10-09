import { Card, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { useLocation } from 'react-router-dom'
import { getKeycloakSignInUrl, KeycloakSignIn, SignInForm } from 'domains/auth'
import { getSessionReturnTo } from 'shared/navigation'
import styles from './styles/sign-in.module.css'
import type { SignInScreenProps } from './types/sign-in-screen-props.type'

/**
 * Размещает доменную форму входа в публичном экране административной панели.
 *
 * Используется для:
 *  - отображения заголовка, пояснений и формы авторизации
 */
export const SignInScreen = (props: SignInScreenProps): JSX.Element => {
  const { className, ...rootAttrs } = props
  const location = useLocation()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    /**
     * Возвращает кнопку в рабочее состояние после Back из внешнего провайдера через bfcache.
     */
    const handlePageShow = (): void => setIsRedirecting(false)
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  /**
   * Начинает редиректный вход обычной навигацией; callback вернёт на безопасный приватный адрес.
   */
  const handleKeycloakSignIn = (): void => {
    if (isRedirecting) {
      return
    }
    setIsRedirecting(true)
    window.location.assign(getKeycloakSignInUrl(getSessionReturnTo(location.state)))
  }

  return (
    <main {...rootAttrs} className={cl(styles.root, className)}>
      <Card className={styles.card} padding="xl" radius="md" withBorder>
        <Stack gap="xl">
          <Stack gap="xs">
            <Text c="dimmed" fw={600} size="sm">Панель администратора</Text>
            <Title order={1} size="h2">Вход в панель</Title>
            <Text c="dimmed" size="sm">
              Используйте учётную запись панели.
            </Text>
          </Stack>

          <SignInForm />
          <KeycloakSignIn onContinue={handleKeycloakSignIn} isRedirecting={isRedirecting} />

          <Text c="dimmed" size="sm" ta="center">
            Доступ для пользователей с выданной учётной записью.
          </Text>
        </Stack>
      </Card>
    </main>
  )
}
