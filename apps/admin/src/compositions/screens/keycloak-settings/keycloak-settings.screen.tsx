import type { JSX } from 'react'
import { useKeycloakSettings } from 'domains/management/keycloak-settings'
import { isDefined } from 'shared/value-predicates'
import { PageHeading } from 'ui/page-heading'
import { QueryState } from 'ui/query-state'
import { KeycloakForm } from './ui/keycloak-form/keycloak-form'

/**
 * Предоставляет владельцу настройку корпоративного входа.
 *
 * Используется для:
 *  - включения Keycloak и замены его конфигурации
 */
export const KeycloakSettingsScreen = (): JSX.Element => {
  const settings = useKeycloakSettings()
  if (!isDefined(settings.data) || isDefined(settings.error)) {
    return (
      <section>
        <PageHeading
          eyebrow="Настройки"
          title="Корпоративный вход"
          description="Единая учётная запись для доступа к рабочему пространству."
        />
        <QueryState
          isLoading={settings.isLoading}
          title="Не удалось загрузить настройки"
          onRetry={() => {
            void settings.mutate().catch(() => undefined)
          }}
        />
      </section>
    )
  }
  return (
    <section>
      <PageHeading
        eyebrow="Настройки"
        title="Корпоративный вход"
        description="Подключите Keycloak, чтобы сотрудники входили с корпоративной учётной записью."
      />
      <KeycloakForm settings={settings.data} />
    </section>
  )
}
