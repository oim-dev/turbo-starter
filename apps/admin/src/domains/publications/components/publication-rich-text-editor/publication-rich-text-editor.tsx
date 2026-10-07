import { parseRichTextDocument } from '@biocad/rich-text'
import { createRichTextExtensions, ArtifactImage } from '@biocad/rich-text/tiptap'
import { isDefined, isEmptyArray, isNonEmptyString } from '@biocad/value-predicates'
import { Alert, Button } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import {
  IconAlertTriangle,
  IconArrowsHorizontal,
  IconFileTextAi,
  IconPhotoPlus,
  IconTextGrammar,
  IconTextPlus,
  IconTextSize
} from '@tabler/icons-react'
import { ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import cl from 'clsx'
import { useEffect, useRef, useState } from 'react'

import { PublicationArtifactsContext } from '../../context/publication-artifacts.context'
import { isPublicationError } from '../../errors/publication.error'
import { transformPublicationText } from '../../services/transform-publication-text.service'
import { uploadPublicationImage } from '../../services/upload-publication-image.service'
import type { UploadPublicationImageOptions } from '../../services/upload-publication-image.service'
import type { PublicationAiAction, PublicationArtifact } from '../../types/publication.type'
import { PublicationArtifactImage } from '../publication-artifact-image'
import { PublicationImageUploadExtension } from '../publication-image-upload'
import type { PublicationRichTextEditorProps } from './types/publication-rich-text-editor-props.type'
import styles from './styles/publication-rich-text-editor.module.css'

const RuntimeArtifactImage = ArtifactImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PublicationArtifactImage)
  }
})

const PERSISTED_EDITOR_EXTENSIONS = createRichTextExtensions({
  artifactImage: RuntimeArtifactImage
})

const EDITOR_EXTENSIONS = [...PERSISTED_EDITOR_EXTENSIONS, PublicationImageUploadExtension]

const AI_ACTIONS: Array<{
  action: PublicationAiAction
  icon: typeof IconFileTextAi
  label: string
}> = [
  { action: 'rewrite', icon: IconTextGrammar, label: 'Переписать' },
  { action: 'shorten', icon: IconArrowsHorizontal, label: 'Сократить' },
  { action: 'expand', icon: IconTextPlus, label: 'Расширить' },
  { action: 'tone', icon: IconTextSize, label: 'Изменить тон' }
]

const EDITOR_LABEL_ID = 'publication-body-label'

/**
 * Исключает editor-only upload nodes из канонического persisted документа.
 */
const removeRuntimeUploadNodes = (node: JSONContent): JSONContent | null => {
  if (node.type === PublicationImageUploadExtension.name) {
    return null
  }

  if (!node.content) {
    return node
  }

  const contentItems = node.content.map(removeRuntimeUploadNodes).filter(isDefined)

  if (node.type === 'doc' && isEmptyArray(contentItems)) {
    return { ...node, content: [{ type: 'paragraph' }] }
  }

  return { ...node, content: contentItems }
}

/**
 * Возвращает сериализуемую часть editor state без transient upload UI.
 */
const getPersistedEditorContent = (editor: Editor): JSONContent => {
  return removeRuntimeUploadNodes(editor.getJSON()) ?? {
    content: [{ type: 'paragraph' }],
    type: 'doc'
  }
}

/**
 * Возвращает plain-text selection и документ для AI dependency.
 */
const getEditorText = (editor: Editor): { document: string; selection: string } => {
  const { from, to } = editor.state.selection

  return {
    document: editor.getText({ blockSeparator: '\n' }),
    selection: editor.state.doc.textBetween(from, to, '\n')
  }
}

/**
 * Применяет plain-text AI result к сохранённому диапазону без HTML parsing.
 */
const applyAiText = (
  editor: Editor,
  text: string,
  selection: { from: number; to: number }
): void => {
  editor.view.dispatch(editor.state.tr.insertText(text, selection.from, selection.to))
  editor.commands.focus()
}

/**
 * Редактирует канонический rich-text документ с image upload и AI toolbar.
 *
 * Используется для:
 *  - форматирования текста единой shared schema
 *  - вставки только completed media artifacts
 *  - применения AI-ответа к selection или документу
 */
export const PublicationRichTextEditor = (props: PublicationRichTextEditorProps) => {
  const { artifacts, title, value, onChange, className, ...rootAttrs } = props
  const [uploadedArtifacts, setUploadedArtifacts] = useState<PublicationArtifact[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [activeAiAction, setActiveAiAction] = useState<PublicationAiAction | null>(null)
  const aiControllerRef = useRef<AbortController | null>(null)

  /**
   * Загружает и регистрирует completed artifact для всех image node views editor session.
   */
  const handleUploadImage = async (
    file: File,
    options?: UploadPublicationImageOptions
  ): Promise<PublicationArtifact> => {
    const artifact = await uploadPublicationImage(file, options)
    setUploadedArtifacts(current => {
      return current.some(currentArtifact => currentArtifact.id === artifact.id)
        ? current
        : [...current, artifact]
    })

    return artifact
  }

  const artifactsById = new Map(
    [...artifacts, ...uploadedArtifacts].map(artifact => [artifact.id, artifact] as const)
  )
  const artifactsContextValue = {
    artifactsById,
    uploadImage: handleUploadImage
  }
  const editor = useEditor({
    content: value.doc,
    editorProps: {
      attributes: {
        'aria-labelledby': EDITOR_LABEL_ID
      }
    },
    extensions: EDITOR_EXTENSIONS,
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(parseRichTextDocument({
        doc: getPersistedEditorContent(updatedEditor),
        schemaVersion: 1
      }))
    },
    shouldRerenderOnTransaction: true
  })
  const isAiPending = isDefined(activeAiAction)
  const hasAiSelection = isNonEmptyString(getEditorText(editor).selection)

  useEffect(() => {
    return () => {
      aiControllerRef.current?.abort()
      aiControllerRef.current = null
    }
  }, [])

  /**
   * Передаёт selection/document доменному AI dependency и применяет plain-text ответ.
   */
  const handleAiTransform = async (action: PublicationAiAction): Promise<void> => {
    const editorText = getEditorText(editor)

    if (!isNonEmptyString(editorText.selection)) {
      setAiError('Выделите текст, который нужно обработать.')
      return
    }

    aiControllerRef.current?.abort()
    const controller = new AbortController()
    aiControllerRef.current = controller
    const sourceDocument = JSON.stringify(editor.getJSON())
    const selection = {
      from: editor.state.selection.from,
      to: editor.state.selection.to
    }

    setAiError(null)
    setActiveAiAction(action)

    try {
      const transformedText = await transformPublicationText(
        {
          action,
          document: editorText.document,
          selection: editorText.selection,
          title
        },
        controller.signal
      )

      if (JSON.stringify(editor.getJSON()) !== sourceDocument) {
        setAiError('Текст изменился во время запроса. Запустите действие ещё раз.')
        return
      }

      applyAiText(editor, transformedText, selection)
    } catch (error) {
      if (aiControllerRef.current === controller && !controller.signal.aborted) {
        setAiError(isPublicationError(error) ? error.message : 'Не удалось обработать текст.')
      }
    } finally {
      if (aiControllerRef.current === controller) {
        aiControllerRef.current = null
        setActiveAiAction(null)
      }
    }
  }

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <PublicationArtifactsContext.Provider value={artifactsContextValue}>
        <RichTextEditor
          className={styles.editor}
          classNames={{
            control: styles.editorControl,
            controlIcon: styles.editorControlIcon,
            controlsGroup: styles.controlsGroup
          }}
          editor={editor}
          labels={{
            blockquoteControlLabel: 'Цитата',
            boldControlLabel: 'Полужирный',
            bulletListControlLabel: 'Маркированный список',
            clearFormattingControlLabel: 'Очистить форматирование',
            h2ControlLabel: 'Заголовок второго уровня',
            h3ControlLabel: 'Заголовок третьего уровня',
            h4ControlLabel: 'Заголовок четвёртого уровня',
            italicControlLabel: 'Курсив',
            linkControlLabel: 'Добавить ссылку',
            orderedListControlLabel: 'Нумерованный список',
            redoControlLabel: 'Повторить',
            strikeControlLabel: 'Зачёркнутый',
            underlineControlLabel: 'Подчёркнутый',
            undoControlLabel: 'Отменить',
            unlinkControlLabel: 'Удалить ссылку'
          }}
        >
          <RichTextEditor.Toolbar className={styles.toolbar} sticky stickyOffset="4rem">
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.Underline />
              <RichTextEditor.Strikethrough />
              <RichTextEditor.ClearFormatting />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.H2 />
              <RichTextEditor.H3 />
              <RichTextEditor.H4 />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Blockquote />
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Link />
              <RichTextEditor.Unlink />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Undo />
              <RichTextEditor.Redo />
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>

          <div className={styles.aiControls} role="toolbar" aria-label="AI-инструменты редактора">
            {AI_ACTIONS.map(({ action, icon: ActionIcon, label }) => (
              <Button
                disabled={!hasAiSelection || isAiPending}
                key={action}
                leftSection={<ActionIcon size={16} />}
                loading={activeAiAction === action}
                size="sm"
                type="button"
                variant="subtle"
                onClick={() => void handleAiTransform(action)}
              >
                {label}
              </Button>
            ))}
            <Button
              leftSection={<IconPhotoPlus size={16} />}
              size="sm"
              type="button"
              variant="subtle"
              onClick={() => editor.chain().focus().setPublicationImageUpload().run()}
            >
              Добавить изображение
            </Button>
          </div>

          {aiError && (
            <Alert color="red" icon={<IconAlertTriangle />} title="AI-действие не выполнено">
              {aiError}
            </Alert>
          )}

          <RichTextEditor.Content className={styles.content} />
        </RichTextEditor>
      </PublicationArtifactsContext.Provider>
    </div>
  )
}
