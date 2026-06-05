<template>
  <div class="editor-wrapper">
    <div class="editor-toolbar">
      <div class="toolbar-inner">
        <el-button-group>
          <el-tooltip content="粗体 (Ctrl+B)" placement="bottom">
            <el-button :icon="EditPen" native-type="button" aria-label="加粗" @click="wrapSelection('**', '**')" />
          </el-tooltip>
          <el-tooltip content="斜体 (Ctrl+I)" placement="bottom">
            <el-button native-type="button" aria-label="斜体" @click="wrapSelection('*', '*')">
              <template #icon>
                <span style="font-style: italic; font-weight: 600;">I</span>
              </template>
            </el-button>
          </el-tooltip>
          <el-tooltip content="删除线" placement="bottom">
            <el-button native-type="button" aria-label="删除线" @click="wrapSelection('~~', '~~')">
              <template #icon>
                <span style="text-decoration: line-through; font-weight: 600;">S</span>
              </template>
            </el-button>
          </el-tooltip>
        </el-button-group>

        <el-divider direction="vertical" />

        <el-button-group>
          <el-tooltip content="一级标题" placement="bottom">
            <el-button native-type="button" aria-label="一级标题" @click="insertLine('# ')">
              <template #icon>
                <span style="font-weight: 700; font-size: 14px;">H1</span>
              </template>
            </el-button>
          </el-tooltip>
          <el-tooltip content="二级标题" placement="bottom">
            <el-button native-type="button" aria-label="二级标题" @click="insertLine('## ')">
              <template #icon>
                <span style="font-weight: 700; font-size: 14px;">H2</span>
              </template>
            </el-button>
          </el-tooltip>
          <el-tooltip content="三级标题" placement="bottom">
            <el-button native-type="button" aria-label="三级标题" @click="insertLine('### ')">
              <template #icon>
                <span style="font-weight: 700; font-size: 14px;">H3</span>
              </template>
            </el-button>
          </el-tooltip>
        </el-button-group>

        <el-divider direction="vertical" />

        <el-button-group>
          <el-tooltip content="行内代码" placement="bottom">
            <el-button :icon="DocumentCopy" native-type="button" aria-label="行内代码" @click="wrapSelection('`', '`')" />
          </el-tooltip>
          <el-tooltip content="代码块" placement="bottom">
            <el-button :icon="Monitor" native-type="button" aria-label="代码块" @click="wrapSelection('```\n', '\n```')" />
          </el-tooltip>
          <el-tooltip content="引用" placement="bottom">
            <el-button :icon="ChatDotRound" native-type="button" aria-label="引用" @click="wrapSelection('> ', '')" />
          </el-tooltip>
        </el-button-group>

        <el-divider direction="vertical" />

        <el-button-group>
          <el-tooltip content="无序列表" placement="bottom">
            <el-button :icon="List" native-type="button" aria-label="无序列表" @click="wrapSelection('- ', '')" />
          </el-tooltip>
          <el-tooltip content="有序列表" placement="bottom">
            <el-button :icon="Finished" native-type="button" aria-label="有序列表" @click="wrapSelection('1. ', '')" />
          </el-tooltip>
          <el-tooltip content="链接" placement="bottom">
            <el-button :icon="Link" native-type="button" aria-label="链接" @click="insertLink" />
          </el-tooltip>
          <el-tooltip content="图片" placement="bottom">
            <el-button :icon="Picture" native-type="button" aria-label="图片" @click="insertImage" />
          </el-tooltip>
        </el-button-group>

        <el-divider direction="vertical" />

        <el-tooltip content="实时预览" placement="bottom">
          <el-button
            :type="settingsStore.livePreview ? 'primary' : 'default'"
            native-type="button"
            :icon="View"
            aria-label="实时预览"
            @click="toggleLivePreview"
          />
        </el-tooltip>

        <el-divider direction="vertical" />

        <el-tooltip content="自动换行" placement="bottom">
          <el-button
            :type="wordWrap ? 'primary' : 'default'"
            native-type="button"
            :icon="ScaleToOriginal"
            circle
            aria-label="自动换行"
            @click="toggleWordWrap"
          />
        </el-tooltip>

        <el-divider direction="vertical" />

        <el-tooltip content="语音输入" placement="bottom">
          <VoiceInputButton mode="toggle" @result="insertText" />
        </el-tooltip>

        <el-divider direction="vertical" />

        <el-tooltip content="智能补全 (Alt+\ 切换)" placement="bottom">
          <el-button
            :type="settingsStore.ghostTextConfig.enabled ? 'primary' : 'default'"
            native-type="button"
            :icon="MagicStick"
            circle
            aria-label="智能补全"
            @click="toggleGhostText"
          />
        </el-tooltip>
      </div>
    </div>
      <FindReplace ref="findReplaceRef" :visible="showFindReplace" @update:visible="showFindReplace = $event" @close="showFindReplace = false" @find="handleFind" @replace="handleReplace" @replace-all="handleReplaceAll" />
    <div class="editor-container" ref="editorContainer"></div>
    <div
      v-if="completionContext"
      class="wiki-link-completion"
      role="listbox"
      aria-label="Wiki Link 建议"
    >
      <div class="completion-header">Wiki Link 建议</div>
      <template v-if="wikiLinkSuggestions.length > 0">
        <button
          v-for="(suggestion, index) in wikiLinkSuggestions"
          :key="suggestion.id"
          class="completion-item"
          :class="{ selected: index === selectedCompletionIndex }"
          type="button"
          role="option"
          :aria-selected="index === selectedCompletionIndex"
          @mouseenter="selectedCompletionIndex = index"
          @mousedown.prevent="applyWikiLinkSuggestion(suggestion)"
        >
          <span class="completion-title">{{ suggestion.title }}</span>
          <span class="completion-path">{{ suggestion.meta }}</span>
        </button>
      </template>
      <div v-else class="completion-empty">{{ completionEmptyText }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, onUnmounted, watch, shallowRef, nextTick } from 'vue'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState, Compartment, Prec } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { SearchCursor } from '@codemirror/search'
import { useSettingsStore } from '@/stores/settings'
import { ghostTextPlugin, updateGhostTextConfig, ghostTextKeymap } from '@/extensions/ghost-text/ghostTextPlugin'
import { inlineEditPlugin, inlineEditKeymap } from '@/extensions/inline-edit/inlineEditPlugin'
import { dropHandlerExtension } from '@/extensions/multimodal/dropHandler'
import { aiActionPlugin, aiActionKeymap } from '@/extensions/ai-actions/aiActionPlugin'
import '@/extensions/ai-actions/styles.css'
import { livePreviewPlugin } from '@/extensions/live-preview/livePreviewPlugin'
import '@/extensions/live-preview/styles.css'
import { smartPasteExtension } from '@/extensions/smart-paste/pasteHandler'
import { aiService } from '@/services/ai'
import { extractMarkdownHeadings, resolveWikiLinkTarget } from '@/utils/wikiLinks'
import FindReplace from './editor/FindReplace.vue'
import VoiceInputButton from '@/components/ui/VoiceInputButton.vue'
import {
  EditPen,
  DocumentCopy,
  Monitor,
  ChatDotRound,
  List,
  Finished,
  Link,
  Picture,
  View,
  ScaleToOriginal,
  MagicStick
} from '@element-plus/icons-vue'

interface Props {
  modelValue?: string
  markdownPaths?: string[]
  currentFile?: string
  readMarkdownFile?: (path: string) => Promise<string>
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  markdownPaths: () => [],
  currentFile: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  update: [content: string]
  'cursor-change': [line: number]
  'selection-change': [text: string]
}>()

const settingsStore = useSettingsStore()

const editorContainer = ref<HTMLElement>()
const editorView = shallowRef<EditorView>()
const showFindReplace = ref(false)
const findReplaceRef = ref()
const readOnlyCompartment = new Compartment()
const livePreviewCompartment = new Compartment()
const ghostTextCompartment = new Compartment()
const inlineEditCompartment = new Compartment()
const themeCompartment = new Compartment()
const lineWrappingCompartment = new Compartment()
const smartPasteCompartment = new Compartment()
let ignoreNextUpdate = false

const wordWrap = ref(true)

const aiActionCompartment = new Compartment()
const activeHeadingFrom = ref(-1)

interface WikiLinkCompletionContext {
  from: number
  to: number
  query: string
  mode: 'note' | 'current-heading' | 'cross-heading'
  fileTarget?: string
  headingQuery?: string
  targetPath?: string | null
}

interface WikiLinkSuggestion {
  id: string
  kind: 'note' | 'heading'
  title: string
  insertText: string
  meta: string
  sortKey: string
}

interface MarkdownHeadingSuggestion {
  title: string
  level: number
  slug: string
  lineNumber: number
}

const completionContext = ref<WikiLinkCompletionContext | null>(null)
const selectedCompletionIndex = ref(0)
const crossDocumentHeadingState = ref<{
  requestKey: string
  path: string
  headings: MarkdownHeadingSuggestion[]
  loading: boolean
  error: boolean
} | null>(null)
let crossDocumentHeadingRequestId = 0

const stripMarkdownExtension = (path: string): string => path.replace(/\.(md|markdown)$/i, '')

const getWikiLinkTitle = (path: string): string => {
  const fileName = path.split('/').pop() || path
  return stripMarkdownExtension(fileName)
}

const getWorkspaceRelativePath = (path: string): string => path.replace(/^\/workspace\/?/, '')

const getMarkdownHeadings = (content: string): MarkdownHeadingSuggestion[] => {
  return extractMarkdownHeadings(content).map(heading => ({
    title: heading.text,
    level: heading.level,
    slug: heading.slug,
    lineNumber: heading.lineNumber,
  }))
}

const getCurrentMarkdownHeadings = (): MarkdownHeadingSuggestion[] => {
  const view = editorView.value
  if (!view) return []
  return getMarkdownHeadings(view.state.doc.toString())
}

const getHeadingSuggestions = (rawQuery: string): WikiLinkSuggestion[] => {
  const query = rawQuery.replace(/^#/, '').trim().toLowerCase()
  return getCurrentMarkdownHeadings()
    .filter(heading => {
      if (!query) return true
      return heading.title.toLowerCase().includes(query) || heading.slug.includes(query)
    })
    .map(heading => ({
      id: `heading:${heading.lineNumber}:${heading.title}`,
      kind: 'heading' as const,
      title: heading.title,
      insertText: `#${heading.title}`,
      meta: `当前文档 · H${heading.level}`,
      sortKey: `${String(heading.lineNumber).padStart(5, '0')}:${heading.title}`,
    }))
    .slice(0, 6)
}

const getCrossDocumentHeadingSuggestions = (context: WikiLinkCompletionContext): WikiLinkSuggestion[] => {
  if (context.mode !== 'cross-heading' || !context.targetPath || !context.fileTarget) return []
  const state = crossDocumentHeadingState.value
  if (!state || state.path !== context.targetPath || state.loading || state.error) return []

  const query = (context.headingQuery || '').trim().toLowerCase()
  const fileTarget = context.fileTarget.trim()
  const noteTitle = getWikiLinkTitle(context.targetPath)

  return state.headings
    .filter(heading => {
      if (!query) return true
      return heading.title.toLowerCase().includes(query) || heading.slug.includes(query)
    })
    .map(heading => ({
      id: `cross-heading:${context.targetPath}:${heading.lineNumber}:${heading.title}`,
      kind: 'heading' as const,
      title: heading.title,
      insertText: `${fileTarget}#${heading.title}`,
      meta: `${noteTitle} · H${heading.level}`,
      sortKey: `${String(heading.lineNumber).padStart(5, '0')}:${heading.title}`,
    }))
    .slice(0, 6)
}

const getNoteSuggestions = (rawQuery: string): WikiLinkSuggestion[] => {
  const query = rawQuery.trim().toLowerCase()
  return props.markdownPaths
    .filter(path => /\.(md|markdown)$/i.test(path))
    .map(path => {
      const title = getWikiLinkTitle(path)
      const relativePath = getWorkspaceRelativePath(path)
      return {
        id: `note:${path}`,
        kind: 'note' as const,
        title,
        insertText: title,
        meta: relativePath,
        sortKey: relativePath,
      }
    })
    .filter(suggestion => {
      if (!query) return true
      return suggestion.title.toLowerCase().includes(query) ||
        suggestion.meta.toLowerCase().includes(query)
    })
    .sort((a, b) => {
      const aTitle = a.title.toLowerCase()
      const bTitle = b.title.toLowerCase()
      const aStarts = query && aTitle.startsWith(query)
      const bStarts = query && bTitle.startsWith(query)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return a.sortKey.localeCompare(b.sortKey)
    })
    .slice(0, 6)
}

const isHeadingCompletion = computed(() => completionContext.value?.mode === 'current-heading' || completionContext.value?.mode === 'cross-heading')

const completionEmptyText = computed(() => {
  const context = completionContext.value
  if (context?.mode === 'cross-heading' && !context.targetPath) return '没有找到目标笔记，继续输入可创建链接'
  if (isHeadingCompletion.value) return '没有匹配标题，继续输入可创建标题链接'
  return '没有匹配笔记，继续输入可创建新链接'
})

const wikiLinkSuggestions = computed<WikiLinkSuggestion[]>(() => {
  const context = completionContext.value
  if (!context) return []

  if (context.mode === 'current-heading') return getHeadingSuggestions(context.query)
  if (context.mode === 'cross-heading') return getCrossDocumentHeadingSuggestions(context)
  return getNoteSuggestions(context.query)
})

watch(wikiLinkSuggestions, (suggestions) => {
  if (selectedCompletionIndex.value >= suggestions.length) {
    selectedCompletionIndex.value = Math.max(0, suggestions.length - 1)
  }
})

watch(completionContext, async (context) => {
  if (context?.mode !== 'cross-heading' || !context.targetPath || !props.readMarkdownFile) {
    crossDocumentHeadingRequestId++
    crossDocumentHeadingState.value = null
    return
  }

  if (
    crossDocumentHeadingState.value?.path === context.targetPath &&
    !crossDocumentHeadingState.value.error
  ) {
    return
  }

  const requestId = ++crossDocumentHeadingRequestId
  const requestKey = `${context.targetPath}:${context.fileTarget || ''}`
  crossDocumentHeadingState.value = {
    requestKey,
    path: context.targetPath,
    headings: [],
    loading: true,
    error: false,
  }

  try {
    const content = await props.readMarkdownFile(context.targetPath)
    if (requestId !== crossDocumentHeadingRequestId) return
    crossDocumentHeadingState.value = {
      requestKey,
      path: context.targetPath,
      headings: getMarkdownHeadings(content),
      loading: false,
      error: false,
    }
  } catch {
    if (requestId !== crossDocumentHeadingRequestId) return
    crossDocumentHeadingState.value = {
      requestKey,
      path: context.targetPath,
      headings: [],
      loading: false,
      error: true,
    }
  }
})

const detectWikiLinkCompletion = (view: EditorView): WikiLinkCompletionContext | null => {
  const selection = view.state.selection.main
  if (!selection.empty) return null

  const position = selection.head
  const line = view.state.doc.lineAt(position)
  const textBeforeCursor = line.text.slice(0, position - line.from)
  const openIndex = textBeforeCursor.lastIndexOf('[[')
  if (openIndex === -1) return null

  const closeIndex = textBeforeCursor.lastIndexOf(']]')
  if (closeIndex > openIndex) return null

  const query = textBeforeCursor.slice(openIndex + 2)
  if (query.includes(']') || query.includes('|')) return null

  if (query.trim().startsWith('#')) {
    return {
      from: line.from + openIndex,
      to: position,
      query,
      mode: 'current-heading',
      headingQuery: query.replace(/^#/, ''),
    }
  }

  const hashIndex = query.indexOf('#')
  if (hashIndex > 0) {
    const fileTarget = query.slice(0, hashIndex).trim()
    const headingQuery = query.slice(hashIndex + 1)
    const targetPath = fileTarget
      ? resolveWikiLinkTarget(fileTarget, props.currentFile || '', props.markdownPaths)
      : null

    return {
      from: line.from + openIndex,
      to: position,
      query,
      mode: 'cross-heading',
      fileTarget,
      headingQuery,
      targetPath,
    }
  }

  return {
    from: line.from + openIndex,
    to: position,
    query,
    mode: 'note',
  }
}

const refreshWikiLinkCompletion = (view: EditorView) => {
  const nextContext = detectWikiLinkCompletion(view)
  if (!nextContext) {
    completionContext.value = null
    selectedCompletionIndex.value = 0
    return
  }

  const previousQuery = completionContext.value?.query
  completionContext.value = nextContext
  if (previousQuery !== nextContext.query) {
    selectedCompletionIndex.value = 0
  }
}

const closeWikiLinkCompletion = () => {
  completionContext.value = null
  selectedCompletionIndex.value = 0
}

const moveWikiLinkCompletionSelection = (delta: number): boolean => {
  const suggestions = wikiLinkSuggestions.value
  if (!completionContext.value || suggestions.length === 0) return false
  selectedCompletionIndex.value = (selectedCompletionIndex.value + delta + suggestions.length) % suggestions.length
  return true
}

const applyWikiLinkSuggestion = (suggestion: WikiLinkSuggestion) => {
  const view = editorView.value
  const context = completionContext.value
  if (!view || !context) return

  const insert = `[[${suggestion.insertText}]]`
  view.dispatch({
    changes: { from: context.from, to: context.to, insert },
    selection: { anchor: context.from + insert.length },
    scrollIntoView: true
  })
  closeWikiLinkCompletion()
  view.focus()
}

const acceptSelectedWikiLinkCompletion = (): boolean => {
  if (!completionContext.value) return false
  const suggestions = wikiLinkSuggestions.value
  const suggestion = suggestions[selectedCompletionIndex.value] || suggestions[0]
  if (!suggestion) return false
  applyWikiLinkSuggestion(suggestion)
  return true
}

const wikiLinkCompletionKeymap = Prec.highest(keymap.of([
  {
    key: 'ArrowDown',
    run: () => moveWikiLinkCompletionSelection(1),
  },
  {
    key: 'ArrowUp',
    run: () => moveWikiLinkCompletionSelection(-1),
  },
  {
    key: 'Enter',
    run: () => acceptSelectedWikiLinkCompletion(),
  },
  {
    key: 'Tab',
    run: () => acceptSelectedWikiLinkCompletion(),
  },
  {
    key: 'Escape',
    run: () => {
      if (!completionContext.value) return false
      closeWikiLinkCompletion()
      return true
    },
  },
]))

const handleWikiLinkCompletionKeydown = (event: KeyboardEvent, view: EditorView): boolean => {
  if (!completionContext.value) return false

  if (event.key === 'Escape') {
    event.preventDefault()
    closeWikiLinkCompletion()
    return true
  }

  const suggestions = wikiLinkSuggestions.value
  if (event.key === 'ArrowDown' && suggestions.length > 0) {
    event.preventDefault()
    return moveWikiLinkCompletionSelection(1)
  }
  if (event.key === 'ArrowUp' && suggestions.length > 0) {
    event.preventDefault()
    return moveWikiLinkCompletionSelection(-1)
  }
  if ((event.key === 'Enter' || event.key === 'Tab') && suggestions.length > 0) {
    event.preventDefault()
    return acceptSelectedWikiLinkCompletion()
  }

  refreshWikiLinkCompletion(view)
  return false
}

const createEditor = () => {
  if (!editorContainer.value) return

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      markdown(),
      themeCompartment.of(oneDark),
      wikiLinkCompletionKeymap,
      keymap.of([indentWithTab]),
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
      livePreviewCompartment.of(settingsStore.livePreview ? [livePreviewPlugin] : []),
      aiActionCompartment.of(settingsStore.enableAIActions ? [aiActionPlugin, aiActionKeymap] : []),
      smartPasteCompartment.of(settingsStore.enableSmartPaste ? [smartPasteExtension] : []),
      ghostTextCompartment.of(settingsStore.ghostTextConfig.enabled ? [ghostTextPlugin, ghostTextKeymap] : []),
      inlineEditCompartment.of(settingsStore.enableInlineEdit ? [inlineEditPlugin, inlineEditKeymap] : []),
      dropHandlerExtension,
      lineWrappingCompartment.of(EditorView.lineWrapping),
      placeholder('开始写作...'),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString()
          ignoreNextUpdate = true
          emit('update:modelValue', content)
          emit('update', content)
        }
        if (update.selectionSet || update.docChanged) {
          const pos = update.state.selection.main.head
          const line = update.state.doc.lineAt(pos).number
          emit('cursor-change', line)
          const { from, to } = update.state.selection.main
          const selectedText = update.state.sliceDoc(from, to)
          emit('selection-change', selectedText)
        }
        if (update.selectionSet || update.docChanged) {
          refreshWikiLinkCompletion(update.view)
        }
      }),
      EditorView.domEventHandlers({
        keydown(event, view) {
          return handleWikiLinkCompletionKeydown(event, view)
        },
        scroll(_event, view) {
          const scroller = view.scrollDOM
          const scrollTop = scroller.scrollTop
          const pos = view.posAtCoords({ x: 100, y: scrollTop + 50 })
          if (pos === null) return false
          const doc = view.state.doc
          let currentLine = doc.lineAt(pos)
          for (let i = 0; i < 20; i++) {
            const match = currentLine.text.match(/^(#{1,6})\s+(.+)/)
            if (match) {
              activeHeadingFrom.value = currentLine.from
              return false
            }
            if (currentLine.number <= 1) break
            currentLine = doc.line(currentLine.number - 1)
          }
          activeHeadingFrom.value = -1
          return false
        }
      }),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.8'
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'var(--font-mono)'
        },
        '&.cm-focused': {
          outline: 'none'
        }
      })
    ]
  })

  editorView.value = new EditorView({
    state: startState,
    parent: editorContainer.value
  })

  updateGhostTextConfig(settingsStore.ghostTextConfig)
}

watch(() => props.modelValue, (newValue) => {
  if (ignoreNextUpdate) {
    ignoreNextUpdate = false
    return
  }
  if (editorView.value && newValue !== editorView.value.state.doc.toString()) {
    editorView.value.dispatch({
      changes: {
        from: 0,
        to: editorView.value.state.doc.length,
        insert: newValue
      }
    })
  }
})

watch(() => settingsStore.isDark(), (isDark) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: themeCompartment.reconfigure(isDark ? oneDark : [])
    })
  }
})

watch(() => settingsStore.ghostTextConfig, (config) => {
  updateGhostTextConfig(config)
  if (editorView.value) {
    editorView.value.dispatch({
      effects: ghostTextCompartment.reconfigure(
        config.enabled ? [ghostTextPlugin, ghostTextKeymap] : []
      )
    })
  }
}, { deep: true })

watch(() => settingsStore.enableInlineEdit, (enabled) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: inlineEditCompartment.reconfigure(
        enabled ? [inlineEditPlugin, inlineEditKeymap] : []
      )
    })
  }
})

watch(() => settingsStore.enableAIActions, (enabled) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: aiActionCompartment.reconfigure(
        enabled ? [aiActionPlugin, aiActionKeymap] : []
      )
    })
  }
})

watch(() => settingsStore.enableSmartPaste, (enabled) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: smartPasteCompartment.reconfigure(
        enabled ? [smartPasteExtension] : []
      )
    })
  }
})

const wrapSelection = (before: string, after: string) => {
  if (!editorView.value) return
  const { from, to } = editorView.value.state.selection.main
  const selected = editorView.value.state.sliceDoc(from, to)
  const hasSelection = selected.length > 0

  if (hasSelection) {
    const wrapped = before + selected + after
    editorView.value.dispatch({
      changes: { from, to, insert: wrapped },
      selection: { anchor: from + before.length, head: from + before.length + selected.length }
    })
  } else {
    editorView.value.dispatch({
      changes: { from, to, insert: before + after },
      selection: { anchor: from + before.length, head: from + before.length }
    })
  }
  editorView.value.focus()
}

const insertLine = (prefix: string) => {
  if (!editorView.value) return
  const { from } = editorView.value.state.selection.main
  const line = editorView.value.state.doc.lineAt(from)
  const lineText = line.text
  const hasContent = lineText.length > 0

  if (hasContent) {
    editorView.value.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: line.from + prefix.length }
    })
  } else {
    editorView.value.dispatch({
      changes: { from: line.from, to: line.to, insert: prefix },
      selection: { anchor: line.from + prefix.length }
    })
  }
  editorView.value.focus()
}

const insertLink = () => {
  if (!editorView.value) return
  const { from, to } = editorView.value.state.selection.main
  const selected = editorView.value.state.sliceDoc(from, to)
  const linkText = selected || '链接文字'
  const insert = `[${linkText}](url)`

  editorView.value.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + linkText.length + 3, head: from + linkText.length + 6 }
  })
  editorView.value.focus()
}

const insertImage = () => {
  if (!editorView.value) return
  const { from, to } = editorView.value.state.selection.main
  const selected = editorView.value.state.sliceDoc(from, to)
  const altText = selected || '图片描述'
  const insert = `![${altText}](url)`

  editorView.value.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + altText.length + 4, head: from + altText.length + 7 }
  })
  editorView.value.focus()
}

const setContent = (content: string) => {
  if (!editorView.value) return
  editorView.value.dispatch({
    changes: {
      from: 0,
      to: editorView.value.state.doc.length,
      insert: content
    }
  })
}

const insertText = (text: string) => {
  if (!editorView.value) return
  const { from } = editorView.value.state.selection.main
  editorView.value.dispatch({
    changes: { from, insert: text },
    selection: { anchor: from + text.length }
  })
  editorView.value.focus()
}

const getSelectedText = (): string => {
  if (!editorView.value) return ''
  const { from, to } = editorView.value.state.selection.main
  return editorView.value.state.sliceDoc(from, to)
}

const toggleLivePreview = () => {
  settingsStore.toggleLivePreview()
  if (!editorView.value) return
  editorView.value.dispatch({
    effects: livePreviewCompartment.reconfigure(
      settingsStore.livePreview ? [livePreviewPlugin] : []
    )
  })
}

const toggleWordWrap = () => {
  wordWrap.value = !wordWrap.value
  if (editorView.value) {
    editorView.value.dispatch({
      effects: lineWrappingCompartment.reconfigure(wordWrap.value ? EditorView.lineWrapping : [])
    })
  }
}

const toggleGhostText = () => {
  settingsStore.ghostTextConfig = {
    ...settingsStore.ghostTextConfig,
    enabled: !settingsStore.ghostTextConfig.enabled
  }
}

interface SearchOptions {
  caseSensitive: boolean
  useRegex: boolean
}

const getSearchSource = (text: string, options: SearchOptions): string =>
  options.useRegex ? text : text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildSearchRegExp = (text: string, options: SearchOptions): RegExp | null => {
  try {
    const source = getSearchSource(text, options)
    return new RegExp(source, options.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

const buildExactSearchRegExp = (text: string, options: SearchOptions): RegExp | null => {
  try {
    const source = getSearchSource(text, options)
    return new RegExp(`^(?:${source})$`, options.caseSensitive ? '' : 'i')
  } catch {
    return null
  }
}

const reportInvalidSearch = () => {
  findReplaceRef.value?.setSearchError?.('正则表达式无效')
}

const getAllMatches = (text: string, query: RegExp): { from: number; to: number }[] => {
  const matches: { from: number; to: number }[] = []
  query.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = query.exec(text)) !== null) {
    if (m[0].length === 0) { query.lastIndex++; continue }
    matches.push({ from: m.index, to: m.index + m[0].length })
  }
  return matches
}

const handleFind = (text: string, options: { caseSensitive: boolean; useRegex: boolean; direction: 'next' | 'prev' }) => {
  const view = editorView.value
  if (!view || !text) return
  const re = buildSearchRegExp(text, options)
  if (!re) {
    reportInvalidSearch()
    return
  }
  const docText = view.state.doc.toString()
  const matches = getAllMatches(docText, re)
  if (matches.length === 0) {
    findReplaceRef.value?.setMatchInfo(0, 0)
    return
  }
  const currentPos = view.state.selection.main.head
  let targetIdx = 0
  if (options.direction === 'next') {
    targetIdx = matches.findIndex(m => m.from >= currentPos)
    if (targetIdx === -1) targetIdx = 0
  } else {
    targetIdx = matches.findIndex(m => m.to > currentPos)
    if (targetIdx === -1) targetIdx = matches.length - 1
    else targetIdx = Math.max(0, targetIdx - 1)
  }
  const target = matches[targetIdx]
  view.dispatch({
    selection: { anchor: target.from, head: target.to },
    scrollIntoView: true
  })
  findReplaceRef.value?.setMatchInfo(targetIdx + 1, matches.length)
}

const handleReplace = (findText: string, replaceText: string, options: { caseSensitive: boolean; useRegex: boolean }) => {
  const view = editorView.value
  if (!view || !findText) return
  const { from, to } = view.state.selection.main
  const selectedText = view.state.sliceDoc(from, to)
  const re = buildSearchRegExp(findText, options)
  const exactRe = buildExactSearchRegExp(findText, options)
  if (!re || !exactRe) {
    reportInvalidSearch()
    return
  }
  re.lastIndex = 0
  const isSelectedMatch = exactRe.test(selectedText)
  if (isSelectedMatch) {
    const nextText = options.useRegex ? selectedText.replace(re, replaceText) : replaceText
    view.dispatch({
      changes: { from, to, insert: nextText },
      selection: { anchor: from + nextText.length }
    })
  }
  handleFind(findText, { ...options, direction: 'next' })
}

const handleReplaceAll = (findText: string, replaceText: string, options: { caseSensitive: boolean; useRegex: boolean }) => {
  const view = editorView.value
  if (!view || !findText) return
  const re = buildSearchRegExp(findText, options)
  if (!re) {
    reportInvalidSearch()
    return
  }
  const docText = view.state.doc.toString()
  const matches = getAllMatches(docText, re)
  if (matches.length === 0) return
  re.lastIndex = 0
  const nextText = docText.replace(re, replaceText)
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: nextText }
  })
  findReplaceRef.value?.setMatchInfo(0, 0)
}

const scrollToLine = (lineNumber: number) => {
  const view = editorView.value
  if (!view) return
  const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines))
  view.dispatch({
    selection: { anchor: line.from },
    scrollIntoView: true
  })
  view.focus()
}

defineExpose({
  setContent,
  insertText,
  getSelectedText,
  wrapSelection,
  insertLink,
  scrollToLine,
  activeHeadingFrom
})

onMounted(() => {
  createEditor()
  const handleEditorKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && completionContext.value) {
      e.preventDefault()
      closeWikiLinkCompletion()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      showFindReplace.value = true
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
      e.preventDefault()
      showFindReplace.value = true
      nextTick(() => {
        findReplaceRef.value?.openReplace?.()
      })
    }
  }
  document.addEventListener('keydown', handleEditorKeyDown, true)
  onUnmounted(() => {
    document.removeEventListener('keydown', handleEditorKeyDown, true)
  })
})

onBeforeUnmount(() => {
  if (editorView.value) {
    editorView.value.destroy()
  }
})
</script>

<style scoped>
.editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--obsidian-bg-primary);
  position: relative;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  height: 36px;
  min-height: 36px;
  padding: 0 8px;
  background: var(--obsidian-bg-secondary);
  border-bottom: 1px solid var(--obsidian-border);
  overflow: hidden;
  box-shadow: none;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  overflow: hidden;
}

.toolbar-inner :deep(.el-button-group) {
  display: inline-flex;
}

.toolbar-inner :deep(.el-button) {
  height: 28px;
  min-height: 28px;
  padding: 0 8px;
  border-radius: 4px;
  background: transparent;
  color: var(--obsidian-text-muted);
  border: none;
  box-shadow: none;
}
.toolbar-inner :deep(.el-button:hover) {
  background: var(--obsidian-bg-hover);
  color: var(--obsidian-text-normal);
}
.toolbar-inner :deep(.el-button--primary) {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
  border: none;
}
.toolbar-inner :deep(.el-button--primary:hover) {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
}

.toolbar-inner :deep(.el-divider--vertical) {
  margin: 0 4px;
  height: 16px;
  border-left: 1px solid var(--obsidian-border);
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
  background: var(--obsidian-bg-primary);
}

.editor-container :deep(.cm-scroller) {
  font-family: var(--font-mono);
  font-size: 15px;
  line-height: 1.75;
  color: var(--obsidian-text-normal);
  padding: var(--space-4) 0;
}

.editor-container :deep(.cm-content) {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
  padding: 0 var(--space-8);
  max-width: 720px;
  margin: 0 auto;
  caret-color: var(--obsidian-accent);
}

.editor-container :deep(.cm-cursor) {
  border-left-color: var(--obsidian-accent);
  border-left-width: 2px;
}

.editor-container :deep(.cm-selectionBackground) {
  background: rgba(127, 109, 242, 0.2) !important;
}

.editor-container :deep(.cm-focused .cm-selectionBackground) {
  background: rgba(127, 109, 242, 0.25) !important;
}

.editor-container :deep(.cm-gutters) {
  background: var(--obsidian-bg-primary);
  border-right: 1px solid var(--obsidian-border);
  color: var(--obsidian-text-muted);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
}

.editor-container :deep(.cm-activeLineGutter) {
  background: var(--obsidian-bg-hover);
  color: var(--obsidian-text-normal);
}

.editor-container :deep(.cm-activeLine) {
  background: var(--obsidian-bg-hover);
  border-radius: var(--radius-sm);
}

.editor-container :deep(.cm-foldGutter) {
  color: var(--obsidian-text-muted);
}

.editor-container :deep(.cm-placeholder) {
  color: var(--obsidian-text-muted);
  font-style: italic;
}

.wiki-link-completion {
  position: absolute;
  top: 76px;
  left: max(56px, calc((100% - 720px) / 2 + 32px));
  z-index: 30;
  width: min(360px, calc(100% - 32px));
  max-height: 284px;
  padding: 6px;
  overflow: hidden;
  background: var(--obsidian-bg-secondary);
  border: 1px solid var(--obsidian-border);
  border-radius: 8px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}

.completion-header {
  padding: 6px 8px 7px;
  color: var(--obsidian-text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.completion-item {
  display: grid;
  width: 100%;
  min-height: 44px;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--obsidian-text-normal);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.completion-item:hover,
.completion-item.selected {
  background: var(--obsidian-bg-hover);
}

.completion-item.selected {
  box-shadow: inset 2px 0 0 var(--obsidian-accent);
}

.completion-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completion-path {
  overflow: hidden;
  color: var(--obsidian-text-muted);
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completion-empty {
  min-height: 44px;
  padding: 12px 8px;
  color: var(--obsidian-text-muted);
  font-size: 13px;
  line-height: 1.4;
}
</style>
