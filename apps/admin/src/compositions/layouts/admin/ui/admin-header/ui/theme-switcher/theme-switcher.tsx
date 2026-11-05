import { ActionIcon, Menu } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import type { JSX } from 'react'
import { useThemeColorScheme } from 'ui/themes'
import { THEME_OPTIONS } from './config/theme-options.config'
import styles from './styles/theme-switcher.module.css'

/**
 * Предоставляет доступный выбор светлой, тёмной или системной темы из шапки.
 *
 * Используется для:
 *  - переключения общей цветовой схемы с клавиатуры и указателя
 */
export const ThemeSwitcher = (): JSX.Element => {
  const { colorScheme, setColorScheme } = useThemeColorScheme()
  const selectedOption = THEME_OPTIONS.find((option) => option.value === colorScheme) ?? THEME_OPTIONS[2]
  const ThemeIcon = selectedOption.icon
  const controlLabel = `Тема оформления: ${selectedOption.label.toLowerCase()}`

  return (
    <Menu position="bottom-end" width={200} shadow="md" offset={10}>
      <Menu.Target>
        <ActionIcon
          className={styles.root}
          variant="subtle"
          color="gray"
          size={40}
          aria-label={controlLabel}
          title="Тема оформления"
        >
          <ThemeIcon size={20} stroke={1.7} aria-hidden="true" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Тема оформления</Menu.Label>
        {THEME_OPTIONS.map((option) => {
          const OptionIcon = option.icon
          const isSelected = colorScheme === option.value
          const checkVisibility = isSelected ? 'visible' : 'hidden'
          const optionLabel = isSelected ? `${option.label} (выбрана)` : option.label

          return (
            <Menu.Item
              key={option.value}
              aria-label={optionLabel}
              leftSection={<OptionIcon size={17} aria-hidden="true" />}
              rightSection={<IconCheck size={15} visibility={checkVisibility} aria-hidden="true" />}
              onClick={() => setColorScheme(option.value)}
            >
              {option.label}
            </Menu.Item>
          )
        })}
      </Menu.Dropdown>
    </Menu>
  )
}
