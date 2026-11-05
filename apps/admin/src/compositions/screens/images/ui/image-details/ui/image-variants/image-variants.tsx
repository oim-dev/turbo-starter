import { Badge, Group, Tabs, Text } from '@mantine/core'
import { useState } from 'react'
import type { JSX } from 'react'
import { formatImageBytes, getImageFormatGroups } from 'domains/images'
import { isEmptyArray } from 'shared/value-predicates'
import type { ImageVariantsProps } from './types/image-variants-props.type'
import { ImageFormatFiles } from './ui/image-format-files/image-format-files'
import styles from './styles/image-variants.module.css'

/**
 * Показывает файлы готового манифеста с форматами, размерами и публичными URL.
 *
 * Используется для:
 *  - выбора подходящего размера изображения
 *  - копирования ссылки на конкретный готовый файл
 */
export const ImageVariants = (props: ImageVariantsProps): JSX.Element => {
  const { variants } = props
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const totalBytes = formatImageBytes(variants.reduce((total, variant) => total + variant.byteSize, 0))
  const groups = getImageFormatGroups(variants)
  const activeFormat = groups.find((group) => group.format === selectedFormat)?.format ?? groups[0]?.format ?? null
  if (isEmptyArray(variants)) {
    return <Text size="sm" c="dimmed">Готовых файлов пока нет.</Text>
  }

  return (
    <div className={styles.root}>
      <Group justify="space-between" mb="sm">
        <Text size="sm" fw={600}>Готовые файлы</Text>
        <Badge color="gray" variant="light">{variants.length} файлов · {totalBytes}</Badge>
      </Group>
      <Tabs value={activeFormat} onChange={setSelectedFormat} keepMounted={false}>
        <Tabs.List aria-label="Форматы готовых файлов" grow>
          {groups.map((group) => (
            <Tabs.Tab key={group.format} value={group.format} className={styles.tab}>
              {group.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {groups.map((group) => (
          <Tabs.Panel key={group.format} value={group.format} pt="sm">
            <ImageFormatFiles variants={group.variants} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  )
}
