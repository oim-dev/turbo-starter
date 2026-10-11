/** Учётные данные администратора для нового входа. */
export type SignInInput = {
  /** Логин без окружающих пробелов. */
  readonly login: string
  /** Пароль, сохраняющий исходные пробелы и регистр. */
  readonly password: string
}
