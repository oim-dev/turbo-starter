/**
 * Credential браузера; сохраняется только в localStorage, не передаётся через React/SSR.
 */
export type ApiCredential = {
  /**
   * Bearer-токен API.
   */
  accessToken: string
  /**
   * Владелец токена; права независимо проверяет backend.
   */
  subject: string
  /**
   * Сессия, к которой относится токен.
   */
  sessionId: string
  /**
   * Фиксированный момент окончания доступа в миллисекундах; не пересчитывается при восстановлении.
   */
  expiresAt: number
  /**
   * Несекретная ревизия сессии между вкладками.
   */
  scope: string
}

/**
 * Жизненный цикл браузерного ресурса без credentials и предметных данных.
 */
export type ApiSessionSnapshot = {
  /**
   * Меняется при замене сессии, включая logout и смену аккаунта в другой вкладке.
   */
  version: number
  /**
   * Завершена начальная попытка проверки; ошибку нужно проверять через getApiCredential.
   */
  isReady: boolean
}

/**
 * Версионированная запись localStorage. Guest-ревизия не позволяет позднему login отменить logout.
 */
export type PersistedApiSession = {
  /**
   * Версия схемы; неизвестные версии требуют нового входа.
   */
  version: 1
  /**
   * Ревизия credential или гостевого состояния.
   */
  scope: string
  /**
   * JWT и фиксированный срок либо гостевое состояние без токена.
   */
  credential: ApiCredential | null
}
