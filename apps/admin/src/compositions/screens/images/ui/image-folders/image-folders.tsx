import { Alert, Button, Group, NavLink, Skeleton, Stack, Text, Tooltip } from '@mantine/core'
import { IconFolder, IconFolderOpen, IconLibraryPhoto, IconPhoto } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { isDefined } from 'shared/value-predicates'
import type { ImageFoldersProps } from './types/image-folders-props.type'
import styles from './styles/image-folders.module.css'

/**
 * Показывает папки медиатеки и количество изображений в каждой.
 *
 * Используется для:
 *  - настольной панели классификации
 *  - выбора папки в мобильном drawer
 */
export const ImageFolders = (props: ImageFoldersProps): JSX.Element => {
  const { facets, folder, isUnfiled, isLoading, errorMessage, onRetry, onSelect, className, ...rootAttrs } = props
  const folders = facets?.folders ?? []
  const isAllSelected = folder === null && !isUnfiled

  return (
    <nav {...rootAttrs} className={cl(styles.root, className)} aria-label="Папки изображений">
      <Group justify="space-between" mb="md" px="xs">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1}>Медиатека</Text>
        <IconFolderOpen size={17} aria-hidden="true" />
      </Group>
      <Stack gap={4}>
        <Tooltip label="Все изображения" withArrow events={{ hover: true, focus: true, touch: false }}>
          <NavLink
            component="button"
            type="button"
            aria-pressed={isAllSelected}
            label="Все изображения"
            title="Все изображения"
            active={isAllSelected}
            leftSection={<IconLibraryPhoto size={19} aria-hidden="true" />}
            rightSection={<Text size="xs" c="var(--app-color-text-strong)" className={styles.count}>{facets?.total ?? '—'}</Text>}
            onClick={() => onSelect(null, false)}
            className={styles.link}
            classNames={{ body: styles.body, label: styles.label, section: styles.section }}
          />
        </Tooltip>
        <Tooltip label="Без папки" withArrow events={{ hover: true, focus: true, touch: false }}>
          <NavLink
            component="button"
            type="button"
            aria-pressed={isUnfiled}
            label="Без папки"
            title="Без папки"
            active={isUnfiled}
            leftSection={<IconPhoto size={19} aria-hidden="true" />}
            rightSection={<Text size="xs" c="var(--app-color-text-strong)" className={styles.count}>{facets?.unfiledCount ?? '—'}</Text>}
            onClick={() => onSelect(null, true)}
            className={styles.link}
            classNames={{ body: styles.body, label: styles.label, section: styles.section }}
          />
        </Tooltip>
      </Stack>
      <Text size="xs" fw={600} c="dimmed" mt="xl" mb="xs" px="xs">ПАПКИ</Text>
      {isLoading && (
        <Stack gap="xs" p="xs" aria-label="Загрузка папок">
          <Skeleton height={30} />
          <Skeleton height={30} />
          <Skeleton height={30} />
        </Stack>
      )}
      {isDefined(errorMessage) && (
        <Alert color="red" title="Папки недоступны">
          <Text size="xs">{errorMessage}</Text>
          <Button variant="subtle" size="xs" onClick={onRetry}>Повторить</Button>
        </Alert>
      )}
      <Stack gap={4}>
        {folders.map((category) => (
          <Tooltip key={category.name} label={category.name} withArrow events={{ hover: true, focus: true, touch: false }}>
            <NavLink
              component="button"
              type="button"
              aria-pressed={folder === category.name}
              label={category.name}
              title={category.name}
              active={folder === category.name}
              leftSection={<IconFolder size={18} aria-hidden="true" />}
              rightSection={<Text size="xs" c="var(--app-color-text-strong)" className={styles.count}>{category.count}</Text>}
              onClick={() => onSelect(category.name, false)}
              className={styles.link}
              classNames={{ body: styles.body, label: styles.label, section: styles.section }}
            />
          </Tooltip>
        ))}
      </Stack>
      <Text size="xs" c="dimmed" mt="xl" px="xs" lh={1.7}>
        Новую папку можно создать при загрузке или в карточке изображения.
      </Text>
    </nav>
  )
}
