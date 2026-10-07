import cl from 'clsx'

import type { {{name.pascalCase}}Props } from './types/{{name.kebabCase}}-props.type'
import styles from './styles/{{name.kebabCase}}.module.css'

/**
 * Отображает интерфейс {{name.pascalCase}}.
 */
export const {{name.pascalCase}} = (props: {{name.pascalCase}}Props) => {
  const { className, ...rootAttrs } = props

  return <section {...rootAttrs} className={cl(styles.root, className)} />
}
