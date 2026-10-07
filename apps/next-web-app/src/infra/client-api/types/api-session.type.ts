/** Credential текущей вкладки; никогда не сериализуется в React или storage. */
export type ApiCredential = {
  /** Bearer-токен API. */
  accessToken: string
  /** Владелец токена; права независимо проверяет backend. */
  subject: string
  /** Сессия, к которой относится токен. */
  sessionId: string
  /** Момент упреждающего обновления access-токена в миллисекундах. */
  refreshAt: number
  /** Несекретная ревизия cookies между вкладками. */
  scope: string
}

/** Жизненный цикл браузерного ресурса без credentials и предметных данных. */
export type ApiSessionSnapshot = {
  /** Меняется при замене сессии, но не при обычной ротации токена. */
  version: number
  /** Завершена начальная попытка восстановления в браузере. */
  isReady: boolean
}

/** Разделяемый результат одной попытки ротации. */
export type ApiRefreshFlight = {
  /** Снимок, вызвавший обновление; две ротации могут вернуть одинаковую строку JWT. */
  credential: ApiCredential | null
  /** Область cookies, для которой начат обмен. */
  scope: string
  /** Один результат для всех ожидающих запросов вкладки. */
  promise: Promise<ApiCredential | null>
}
