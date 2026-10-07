import {
  definePublicConfig,
  resolveAppEnv,
  selectPublicConfig,
} from '@biocad/config'
import developmentConfig from './config/development.config'
import localConfig from './config/local.config'
import productionConfig from './config/production.config'
import testConfig from './config/test.config'
import type { AppConfig, RawAppConfig } from './types/app-config.type'

const configs = definePublicConfig<RawAppConfig>({
  local: localConfig,
  development: developmentConfig,
  test: testConfig,
  production: productionConfig,
})

const appEnv = resolveAppEnv(__APP_ENV__)

export const appPublicConfig: AppConfig = selectPublicConfig(
  configs,
  appEnv,
)
