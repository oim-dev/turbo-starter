import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { AuthContext } from './context/auth.context'
import {
  logoutAuthSessionLifecycle,
  startAuthSessionLifecycle
} from './services/auth-lifecycle.service'
import { completeAuthLogout } from './services/auth.service'
import { authStateReducer, INITIAL_AUTH_STATE } from './state/auth-state.reducer'

/**
 * Корневая граница административной авторизации.
 *
 * Используется для:
 *  - разрешения BFF-сессии до отображения дочерних маршрутов
 *  - владения auth state, подпиской на 401 и cleanup запросов
 */
export const AuthRoot = () => {
  const [state, dispatch] = useReducer(authStateReducer, INITIAL_AUTH_STATE)
  const [resolveAttempt, setResolveAttempt] = useState(0)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [hasLogoutError, setHasLogoutError] = useState(false)
  const logoutControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return startAuthSessionLifecycle(dispatch)
  }, [resolveAttempt])

  useEffect(() => {
    return () => {
      const logoutController = logoutControllerRef.current
      logoutControllerRef.current = null
      logoutController?.abort()
    }
  }, [])

  /**
   * Завершает сессию в lifecycle домена с fail-closed обработкой неопределённого результата.
   */
  const logout = async (): Promise<void> => {
    if (logoutControllerRef.current) {
      return
    }

    const logoutController = new AbortController()
    logoutControllerRef.current = logoutController
    setHasLogoutError(false)
    setIsLoggingOut(true)

    try {
      const result = await logoutAuthSessionLifecycle(dispatch, logoutController.signal)

      if (result.status === 'succeeded') {
        completeAuthLogout(result.redirectUrl)
      }

      if (result.status === 'failed') {
        setHasLogoutError(true)
      }
    } catch {
      setHasLogoutError(true)
    } finally {
      if (logoutControllerRef.current === logoutController) {
        logoutControllerRef.current = null
        setIsLoggingOut(false)
      }
    }
  }

  if (state.status === 'unresolved' || state.status === 'resolving') {
    return (
      <Center mih="100vh">
        <Loader aria-label="Проверка сессии" />
      </Center>
    )
  }

  if (state.status === 'error') {
    return (
      <Center mih="100vh" p="md">
        <Alert color="red" icon={<IconAlertTriangle />} title="Не удалось проверить сессию">
          <Stack gap="sm">
            <Text size="sm">Проверьте подключение к admin API и повторите запрос.</Text>
            <Button color="red" variant="light" onClick={() => setResolveAttempt((attempt) => attempt + 1)}>
              Повторить
            </Button>
          </Stack>
        </Alert>
      </Center>
    )
  }

  return (
    <AuthContext.Provider value={{ dispatch, hasLogoutError, isLoggingOut, logout, state }}>
      <Outlet />
    </AuthContext.Provider>
  )
}
