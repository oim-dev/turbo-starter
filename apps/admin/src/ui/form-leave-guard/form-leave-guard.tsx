import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useCallback } from 'react'
import type { JSX } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import type { FormLeaveGuardProps } from './types/form-leave-guard-props.type'

/**
 * Согласовывает уход со страницы при наличии несохранённого ввода.
 *
 * Используется для:
 *  - защиты форм при переходе и обновлении страницы
 */
export const FormLeaveGuard = ({ shouldBlock }: FormLeaveGuardProps): JSX.Element => {
  // Контекст Router нельзя передавать в form.isDirty: её аргумент означает путь поля.
  const blocker = useBlocker(() => shouldBlock())
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (shouldBlock()) {
          event.preventDefault()
          event.returnValue = ''
        }
      },
      [shouldBlock]
    )
  )
  const isBlocked = blocker.state === 'blocked'

  return (
    <Modal opened={isBlocked} onClose={() => blocker.reset?.()} title="Сохранить изменения?">
      <Stack>
        <Text c="dimmed">
          Вы изменили данные, но ещё не сохранили их. При уходе со страницы изменения будут потеряны.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => blocker.reset?.()}>
            Продолжить редактирование
          </Button>
          <Button color="red" onClick={() => blocker.proceed?.()}>
            Уйти без сохранения
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
