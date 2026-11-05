import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * Настройки Next.js для локального запуска и автономного контейнера.
 */
const nextConfig: NextConfig = {
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  // Отдельный каталог позволяет проверять production параллельно с работающим dev-сервером.
  distDir: process.env.NEXT_DIST_DIR ?? '.next'
}

export default nextConfig
