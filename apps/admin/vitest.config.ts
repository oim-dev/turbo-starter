import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Преобразует src path в абсолютный alias для доменных тестов.
 */
const resolveSrcPath = (path: string): string => {
  return fileURLToPath(new URL(`./src/${path}`, import.meta.url))
}

export default defineConfig({
  resolve: {
    alias: {
      app: resolveSrcPath('app'),
      compositions: resolveSrcPath('compositions'),
      domains: resolveSrcPath('domains'),
      infra: resolveSrcPath('infra'),
      shared: resolveSrcPath('shared'),
      ui: resolveSrcPath('ui')
    }
  },
  test: {
    environment: 'node'
  }
})
