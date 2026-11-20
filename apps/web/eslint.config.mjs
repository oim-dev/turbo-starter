import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Приёмочные тесты проверяют наблюдаемый результат, а не детали сборки.
    files: ['test/**/*.{js,mjs,ts}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/module__|__next_f/], Literal[regex.pattern=/module__|__next_f/]',
          message: 'Проверяйте тексты, роли, ссылки и статусы, а не хешированные классы CSS Modules и RSC payload.'
        },
        {
          selector: 'TemplateElement[value.raw=/module__|__next_f/]',
          message: 'Проверяйте тексты, роли, ссылки и статусы, а не хешированные классы CSS Modules и RSC payload.'
        }
      ]
    }
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.templates/**'
  ])
])

export default eslintConfig
