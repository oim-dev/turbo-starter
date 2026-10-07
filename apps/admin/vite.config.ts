import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Преобразует путь внутри src в абсолютный URL для Vite alias.
 */
const resolveSrcPath = (path: string): string => {
  return fileURLToPath(new URL(`./src/${path}`, import.meta.url))
}

const adminPort = Number(process.env.ADMIN_PORT ?? 3001)
const adminApiProxyTarget = process.env.ADMIN_API_PROXY_TARGET ?? 'http://localhost:4001'

export default defineConfig({
  define: {
    __APP_ENV__: JSON.stringify(process.env.APP_ENV ?? '')
  },
  plugins: [react()],
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
  server: {
    port: adminPort,
    proxy: {
      '/api': {
        target: adminApiProxyTarget
      }
    }
  },
  preview: {
    port: adminPort
  }
})
