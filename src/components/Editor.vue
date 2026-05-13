<template>
  <div class="editor-wrapper">
    <div class="editor-container" ref="editorContainer"></div>
    <div class="editor-toolbar">
      <div class="toolbar-inner">
        <div class="toolbar-group">
          <button class="tool-btn" @click="wrapSelection('**', '**')" title="粗体 (Ctrl+B)" aria-label="粗体">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('*', '*')" title="斜体 (Ctrl+I)" aria-label="斜体">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('~~', '~~')" title="删除线" aria-label="删除线">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button class="tool-btn" @click="insertLine('# ')" title="H1" aria-label="一级标题">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12h3"/><path d="M17 18V6"/></svg>
          </button>
          <button class="tool-btn" @click="insertLine('## ')" title="H2" aria-label="二级标题">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
          </button>
          <button class="tool-btn" @click="insertLine('### ')" title="H3" aria-label="三级标题">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 01-2 2"/><path d="M17 17v4"/><path d="M21 17v4"/></svg>
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button class="tool-btn" @click="wrapSelection('`', '`')" title="行内代码" aria-label="行内代码">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('```\n', '\n```')" title="代码块" aria-label="代码块">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('> ', '')" title="引用" aria-label="引用">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button class="tool-btn" @click="wrapSelection('- ', '')" title="无序列表" aria-label="无序列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('1. ', '')" title="有序列表" aria-label="有序列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
          </button>
          <button class="tool-btn" @click="insertLink" title="链接" aria-label="链接">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          </button>
          <button class="tool-btn" @click="insertImage" title="图片" aria-label="图片">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'

interface Props {
  modelValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  update: [content: string]
  'cursor-change': [line: number]
}>()

const editorContainer = ref<HTMLElement>()
const editorView = shallowRef<EditorView>()
const readOnlyCompartment = new Compartment()
let ignoreNextUpdate = false

const createEditor = () => {
  if (!editorContainer.value) return

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      markdown(),
      oneDark,
      keymap.of([indentWithTab]),
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
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
        }
      }),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.8'
        },
        '.cm-content': {
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.8',
          padding: '16px 0'
        },
        '.cm-gutters': {
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

defineExpose({
  setContent,
  insertText,
  getSelectedText
})

onMounted(() => {
  createEditor()
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
  background: var(--bg-base);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  height: 40px;
  min-height: 40px;
  padding: 0 8px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  overflow: hidden;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  overflow: hidden;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--border-subtle);
  margin: 0 4px;
  flex-shrink: 0;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default),
              color var(--duration-fast) var(--ease-default),
              transform var(--duration-fast) var(--ease-default);
  flex-shrink: 0;
}

.tool-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
}

.tool-btn:active {
  transform: scale(0.97);
  background: var(--bg-active);
}

.tool-btn:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 1px;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
  background: var(--bg-base);
}

.editor-container :deep(.cm-scroller) {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
}

.editor-container :deep(.cm-content) {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
  caret-color: var(--accent-primary);
}

.editor-container :deep(.cm-gutters) {
  background: var(--bg-base);
  border-right: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
}

.editor-container :deep(.cm-activeLineGutter) {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.editor-container :deep(.cm-activeLine) {
  background: var(--bg-hover);
}

.editor-container :deep(.cm-selectionBackground) {
  background: rgba(129, 140, 248, 0.2) !important;
}

.editor-container :deep(.cm-cursor) {
  border-left-color: var(--accent-primary);
}

.editor-container :deep(.cm-foldGutter) {
  color: var(--text-muted);
}

.editor-container :deep(.cm-placeholder) {
  color: var(--text-muted);
  font-style: italic;
}
</style>
