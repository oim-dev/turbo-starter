import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

/**
 * Проверяет общий порт локального dev/preview-сервера.
 */
const parsePort = (value: string): number => {
  if (!/^\d+$/.test(value)) {
    throw new Error('VITE_PORT must be an integer between 1 and 65535')
  }

  const port = Number(value)
  if (port < 1 || port > 65_535) {
    throw new Error('VITE_PORT must be an integer between 1 and 65535')
  }

  return port
}

/**
 * Проверяет origin API до настройки локального reverse proxy.
 */
const parseProxyUrl = (name: string, value: string, protocols: readonly string[]): URL => {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute URL`)
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(`${name} must use ${protocols.join(' or ')}`)
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must contain only protocol, host and optional port`)
  }

  return url
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isHttpsEnabled = env.VITE_HTTPS === 'true'
  const backendUrl = parseProxyUrl(
    'VITE_BACKEND_URL',
    env.VITE_BACKEND_URL || 'http://127.0.0.1:3002',
    ['http:', 'https:']
  )
  const localServer = {
    host: env.VITE_HOST || 'localhost',
    port: parsePort(env.VITE_PORT || '5173'),
    strictPort: true,
    proxy: {
      '/api/': {
        target: backendUrl.origin,
        changeOrigin: true,
        secure: false,
        rewrite: (requestPath: string): string => requestPath.replace(/^\/api\//, '/')
      }
    }
  }

  return {
    plugins: [
      react(),
      ...(isHttpsEnabled ? [basicSsl()] : [])
    ],
    resolve: {
      alias: {
        app: path.resolve(__dirname, './src/app'),
        compositions: path.resolve(__dirname, './src/compositions'),
        domains: path.resolve(__dirname, './src/domains'),
        infra: path.resolve(__dirname, './src/infra'),
        shared: path.resolve(__dirname, './src/shared'),
        ui: path.resolve(__dirname, './src/ui'),
      },
    },
    server: localServer,
    preview: localServer
  }
})
