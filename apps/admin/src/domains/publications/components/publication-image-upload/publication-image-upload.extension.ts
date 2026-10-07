import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { PublicationImageUpload } from './publication-image-upload'

/**
 * Настройки временного editor-only upload node.
 */
export type PublicationImageUploadOptions = {
  /** MIME-типы, доступные в browser file picker. */
  accept: string
  /** Максимальный размер файла в байтах. */
  maxSize: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    publicationImageUpload: {
      /** Вставляет временную область загрузки в текущую позицию документа. */
      setPublicationImageUpload: () => ReturnType
    }
  }
}

/**
 * Вставляет официальный Tiptap-style upload flow без изменения канонической schema.
 *
 * Node существует только в editor runtime и после complete заменяется на artifactImage.
 */
export const PublicationImageUploadExtension = Node.create<PublicationImageUploadOptions>({
  addAttributes() {
    return {
      accept: { default: this.options.accept },
      maxSize: { default: this.options.maxSize }
    }
  },

  addCommands() {
    return {
      setPublicationImageUpload: () => ({ commands }) => {
        return commands.insertContent({ type: this.name })
      }
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(PublicationImageUpload)
  },

  addOptions() {
    return {
      accept: 'image/jpeg,image/png,image/webp',
      maxSize: 10 * 1024 * 1024
    }
  },

  atom: true,
  draggable: true,
  group: 'block',
  name: 'publicationImageUpload',
  parseHTML() {
    return [{ tag: 'div[data-type="publication-image-upload"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'publication-image-upload' })
    ]
  },
  selectable: true
})
