import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import cl from 'clsx'
import { useState } from 'react'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import { AUTH_ERROR_CODE, isAuthError } from '../../errors/auth.error'
import type { AuthError } from '../../errors/auth.error'
import { useAuthentication } from '../../hooks/use-authentication.hook'
import { signIn } from '../../operations/session-lifecycle.operation'
import { getSignInErrorMessage } from '../../helpers/get-sign-in-error-message'
import type { SignInFormProps } from './types/sign-in-form-props.type'
import type { SignInFormValues } from './types/sign-in-form-values.type'
import styles from './styles/sign-in-form.module.css'

/**
 * Предоставляет форму входа администратора независимо от экрана и маршрутизатора.
 *
 * Используется для:
 *  - ввода, проверки и отправки учётных данных
 *  - отображения предусмотренных причин отказа и завершения сессии
 */
export const SignInForm = (props: SignInFormProps) => {
  const { className, ...rootAttrs } = props
  const authentication = useAuthentication()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [dismissedAuthError, setDismissedAuthError] = useState<AuthError | null>(null)
  const form = useForm<SignInFormValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    initialValues: { login: '', password: '' },
    onValuesChange: () => {
      setSubmitError(null)
      setDismissedAuthError(authentication.error)
    },
    validate: {
      login: (login) => (
        /^[a-zA-Z0-9_.-]{3,64}$/.test(login)
          ? null
          : 'Логин: от 3 до 64 латинских букв, цифр или символов _ . -'
      ),
      password: (password) => (
        password.length >= 1 && password.length <= 128
          ? null
          : 'Введите пароль длиной от 1 до 128 символов'
      )
    }
  })
  const sessionMessage = isDefined(authentication.error) && authentication.error !== dismissedAuthError
    ? getSignInErrorMessage(authentication.error)
    : null
  const errorMessage = sessionMessage ?? submitError
  const isFormDisabled = form.submitting || authentication.error?.code === AUTH_ERROR_CODE.UNSUPPORTED_BROWSER
  const isPasswordInvalid = isDefined(form.errors.password)

  /**
   * Подтверждает вход; дальнейшее размещение и навигацию определяет потребитель домена.
   */
  const handleSubmit = async (values: SignInFormValues): Promise<void> => {
    if (isFormDisabled) {
      return
    }

    setSubmitError(null)
    setDismissedAuthError(authentication.error)

    try {
      await signIn(values)
    } catch (error) {
      if (isAuthError(error)) {
        setSubmitError(getSignInErrorMessage(error))
        return
      }

      reportApplicationDefect(toApplicationDefect('admin.signIn', error))
      setSubmitError('Не удалось выполнить вход. Повторите попытку позже.')
    }
  }

  /**
   * Переводит фокус на первое некорректное поле после отправки с клавиатуры.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const firstErrorPath = Object.keys(errors)[0]
    if (isDefined(firstErrorPath)) {
      form.getInputNode(firstErrorPath)?.focus()
    }
  }

  return (
    <form
      aria-label="Вход администратора"
      {...rootAttrs}
      className={cl(styles.root, className)}
      noValidate
      onSubmit={form.onSubmit(handleSubmit, handleValidationError)}
    >
      <fieldset className={styles.fields} disabled={isFormDisabled}>
        <Stack gap="md">
          <TextInput
            key={form.key('login')}
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            disabled={isFormDisabled}
            label="Логин"
            maxLength={64}
            name="login"
            required
            size="md"
            spellCheck={false}
            {...form.getInputProps('login')}
          />
          <PasswordInput
            key={form.key('password')}
            aria-invalid={isPasswordInvalid}
            autoComplete="current-password"
            disabled={isFormDisabled}
            label="Пароль"
            maxLength={128}
            name="password"
            required
            size="md"
            visibilityToggleButtonProps={{ 'aria-label': 'Показать или скрыть пароль', tabIndex: 0 }}
            {...form.getInputProps('password')}
          />

          {isDefined(errorMessage) && (
            <Alert color="red" title="Не удалось продолжить">
              {errorMessage}
            </Alert>
          )}

          <Button disabled={isFormDisabled} fullWidth loading={form.submitting} mt="xs" size="md" type="submit">
            Войти
          </Button>
        </Stack>
      </fieldset>
    </form>
  )
}
