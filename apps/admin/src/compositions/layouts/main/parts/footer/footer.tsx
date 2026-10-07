import { Box, Group, Text } from '@mantine/core'
import cl from 'clsx'

import type { FooterProps } from './types/footer-props.type'
import styles from './styles/footer.module.css'

/**
 * Нижняя панель основного layout.
 *
 * Используется для:
 *  - отображения владельца панели администрирования
 *  - визуального завершения области содержимого
 */
export const Footer = (props: FooterProps) => {
  const { className, ...rootAttrs } = props

  return (
    <Box {...rootAttrs} className={cl(styles.root, className)} component="footer">
      <Group className={styles.inner} justify="space-between" px="xl" py="sm">
        <Text c="dimmed" size="xs">
          © 2026 BIOCAD
        </Text>
        <Text c="dimmed" size="xs">
          Панель администрирования
        </Text>
      </Group>
    </Box>
  )
}
