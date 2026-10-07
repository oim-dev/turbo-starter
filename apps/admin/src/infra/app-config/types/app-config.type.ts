import type { ResolvedPublicConfig } from '@biocad/config'

export type RawAppConfig = Record<never, never>

export type AppConfig = ResolvedPublicConfig<RawAppConfig>
