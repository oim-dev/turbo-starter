import { ActionIcon, Menu, Tooltip } from '@mantine/core'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { Link } from 'react-router-dom'

import type { PublicationStatusActionProps } from './types/publication-status-action-props.type'
import styles from './styles/publication-status-action.module.css'

/**
 * Отображает интерфейс PublicationStatusAction.
 */
export const PublicationStatusAction = (props: PublicationStatusActionProps) => {
  const { isMutationPending, isPending, placement, publication, onChange } = props
  const isPublished = publication.status === 'published'
  const label = isPublished ? 'Снять с публикации' : 'Открыть и опубликовать'
  const StatusIcon = isPublished ? IconEyeOff : IconEye
  const publicationUrl = `/publications/${publication.id}`

  if (placement === 'menu' && isPublished) {
    return (
      <Menu.Item
        className={styles.root}
        color="orange"
        disabled={isMutationPending}
        leftSection={<StatusIcon size={17} />}
        onClick={() => onChange(publication)}
      >
        {label}
      </Menu.Item>
    )
  }

  if (placement === 'menu') {
    return (
      <Menu.Item
        className={styles.root}
        color="teal"
        component={Link}
        leftSection={<StatusIcon size={17} />}
        to={publicationUrl}
      >
        {label}
      </Menu.Item>
    )
  }

  if (isPublished) {
    return (
      <Tooltip label={label} position="bottom">
        <ActionIcon
          aria-label={`${label}: ${publication.title}`}
          className={styles.root}
          color="orange"
          disabled={isMutationPending}
          loading={isPending}
          radius="md"
          size="lg"
          variant="subtle"
          onClick={() => onChange(publication)}
        >
          <StatusIcon size={18} />
        </ActionIcon>
      </Tooltip>
    )
  }

  return (
    <Tooltip label={label} position="bottom">
      <ActionIcon
        aria-label={`${label}: ${publication.title}`}
        className={styles.root}
        color="teal"
        component={Link}
        radius="md"
        size="lg"
        to={publicationUrl}
        variant="subtle"
      >
        <StatusIcon size={18} />
      </ActionIcon>
    </Tooltip>
  )
}
