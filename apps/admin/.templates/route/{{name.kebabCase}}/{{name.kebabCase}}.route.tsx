import { {{name.pascalCase}}Screen } from 'compositions/screens/{{name.kebabCase}}'

/**
 * Подключает экран {{name.pascalCase}} к route graph приложения.
 */
export const {{name.pascalCase}}Route = () => {
  return <{{name.pascalCase}}Screen />
}
