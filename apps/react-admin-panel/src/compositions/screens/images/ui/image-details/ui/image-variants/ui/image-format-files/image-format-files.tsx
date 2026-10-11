import { ActionIcon, CopyButton, Group, Table, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconExternalLink } from '@tabler/icons-react'
import type { JSX } from 'react'
import { formatImageBytes } from 'domains/images'
import type { ImageFormatFilesProps } from './types/image-format-files-props.type'
import styles from './styles/image-format-files.module.css'

/**
 * Показывает размеры выбранного формата и действия с готовыми ссылками.
 *
 * Используется для:
 *  - сравнения размеров и веса внутри вкладки
 *  - открытия и копирования конкретного опубликованного файла
 */
export const ImageFormatFiles = (props: ImageFormatFilesProps): JSX.Element => {
  const rows = props.variants.map((variant) => ({
    ...variant,
    byteSizeLabel: formatImageBytes(variant.byteSize),
    openLabel: `Открыть ${variant.format.toUpperCase()} ${variant.width} × ${variant.height}`,
    copyLabel: `Копировать URL ${variant.width} × ${variant.height}`
  }))

  return (
    <Table className={styles.root} verticalSpacing="xs" horizontalSpacing={4} highlightOnHover aria-label="Размеры и URL выбранного формата">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Размер, px</Table.Th>
          <Table.Th>Вес</Table.Th>
          <Table.Th ta="right">Ссылка</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((variant) => (
          <Table.Tr key={variant.id}>
            <Table.Td><Text size="xs" className={styles.dimensions}>{variant.width} × {variant.height}</Text></Table.Td>
            <Table.Td><Text size="xs" className={styles.dimensions}>{variant.byteSizeLabel}</Text></Table.Td>
            <Table.Td>
              <Group gap={0} wrap="nowrap" justify="flex-end">
                <Tooltip label="Открыть файл">
                  <ActionIcon component="a" href={variant.url} target="_blank" rel="noopener noreferrer" variant="subtle" size="lg" aria-label={variant.openLabel}>
                    <IconExternalLink size={16} aria-hidden="true" />
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={variant.url}>
                  {({ copied, copy }) => {
                    const label = copied ? 'Скопировано' : variant.copyLabel
                    const CopyIcon = copied ? IconCheck : IconCopy
                    return (
                      <Tooltip label={label}>
                        <ActionIcon variant="subtle" size="lg" onClick={copy} aria-label={label}>
                          <CopyIcon size={16} aria-hidden="true" />
                        </ActionIcon>
                      </Tooltip>
                    )
                  }}
                </CopyButton>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
