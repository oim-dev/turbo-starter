import cl from 'clsx'

import type { {{name.pascalCase}}ScreenProps } from './types/{{name.kebabCase}}-screen-props.type'
import styles from './styles/{{name.kebabCase}}.module.css'

/**
 * Размещает экран {{name.pascalCase}} в layout приложения.
 */
export const {{name.pascalCase}}Screen = (props: {{name.pascalCase}}ScreenProps) => {
  const { className, ...rootAttrs } = props

  return <main {...rootAttrs} className={cl(styles.root, className)} />
}
