import { changeAccountLogin, changeAccountPassword, updateAccountName } from '../adapters/update-account.adapter'
import { logout } from '../operations/session-lifecycle.operation'
import { useGetCurrentUser } from './use-get-current-user/use-get-current-user.hook'

/**
 * Действия собственного аккаунта с синхронизацией сессии.
 */
type AccountSettingsActions = {
  /**
   * Сохранить имя и обновить профиль.
   */
  updateName: typeof updateAccountName
  /**
   * Сменить логин и завершить сессию.
   */
  changeLogin: typeof changeAccountLogin
  /**
   * Сменить пароль и завершить сессию.
   */
  changePassword: typeof changeAccountPassword
}

/**
 * Синхронизирует профиль и завершает локальную сессию после смены credentials.
 */
export const useAccountSettings = (): AccountSettingsActions => {
  const profile = useGetCurrentUser()
  return {
    updateName: async (name: string): Promise<void> => {
      await updateAccountName(name)
      await profile.mutate()
    },
    changeLogin: async (login: string, currentPassword?: string): Promise<void> => {
      await changeAccountLogin(login, currentPassword)
      await logout()
    },
    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
      await changeAccountPassword(currentPassword, newPassword)
      await logout()
    }
  }
}
