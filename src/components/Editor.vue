<template>
  <div class="editor-wrapper">
    <!-- 工具栏 -->
    <div class="editor-toolbar" :class="{ collapsed: toolbarCollapsed }">
      <div class="toolbar-inner">
        <div class="toolbar-group">
          <button class="tool-btn" @click="wrapSelection('**', '**')" title="粗体 (Ctrl+B)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('*', '*')" title="斜体 (Ctrl+I)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('~~', '~~')" title="删除线">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button class="tool-btn" @click="insertLine('# ')" title="H1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12h3"/><path d="M17 18V6"/></svg>
          </button>
          <button class="tool-btn" @click="insertLine('## ')" title="H2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
          </button>
          <button class="tool-btn" @click="insertLine('### ')" title="H3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 01-2 2"/><path d="M17 17v4"/><path d="M21 17v4"/></svg>
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button class="tool-btn" @click="wrapSelection('`', '`')" title="行内代码">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('```\n', '\n```')" title="代码块">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('> ', '')" title="引用">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button class="tool-btn" @click="wrapSelection('- ', '')" title="无序列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('1. ', '')" title="有序列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('- [ ] ', '')" title="任务列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><rect x="3" y="3" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="3" y="17" width="4" height="4" rx="1"/></svg>
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button class="tool-btn" @click="wrapSelection('[', '](url)')" title="链接">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('![alt](', ')')" title="图片">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('---\n', '')" title="分割线">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button class="tool-btn" @click="wrapSelection('|  |  |\n| --- | --- |\n|  |  |', '')" title="表格">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
          </button>
          <button class="tool-btn" @click="wrapSelection('$$\n', '\n$$')" title="公式">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
          </button>
        </div>
      </div>
      <button class="toolbar-toggle" @click="toolbarCollapsed = !toolbarCollapsed" :title="toolbarCollapsed ? '展开工具栏' : '收起工具栏'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
    </div>
    <!-- 编辑器 -->
    <div class="editor-container" ref="editorContainer"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, rectangularSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, indentUnit } from '@codemirror/language'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'

interface Props {
  modelValue?: string
}
const props = withDefaults(defineProps<Props>(), { modelValue: '' })

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update', value: string): void
  (e: 'cursor-change', line: number): void
  (e: 'outline-change', headings: { level: number; text: string; from: number; to: number }[]): void
  (e: 'selection-change', text: string): void
}>()

const editorContainer = ref<HTMLElement>()
let view: EditorView | null = null
const toolbarCollapsed = ref(false)

const createEditor = () => {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const content = update.state.doc.toString()
      emit('update:modelValue', content)
      emit('update', content)
      const headings: { level: number; text: string; from: number; to: number }[] = []
      const text = content
      const lines = text.split('\n')
      let pos = 0
      for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.+)$/)
        if (match) {
          headings.push({
            level: match[1].length,
            text: match[2].trim(),
            from: pos,
            to: pos + line.length
          })
        }
        pos += line.length + 1
      }
      emit('outline-change', headings)
    }
    if (update.selectionSet) {
      const pos = update.state.selection.main.head
      emit('cursor-change', update.state.doc.lineAt(pos).number)
      const { from, to } = update.state.selection.main
      emit('selection-change', from === to ? '' : update.state.doc.sliceString(from, to))
    }
  })

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      foldGutter(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      rectangularSelection(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      markdown({ base: markdownLanguage }),
      oneDark,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      autocompletion(),
      indentUnit.of('  '),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
      ]),
      EditorView.lineWrapping,
      updateListener,
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
          backgroundColor: 'var(--bg-base)',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: "var(--font-mono)",
          lineHeight: '1.75',
          backgroundColor: 'var(--bg-base)',
        },
        '.cm-content': {
          padding: '28px 40px 80px',
          caretColor: 'var(--accent)',
          backgroundColor: 'var(--bg-base)',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--accent)',
          borderLeftWidth: '2px',
          animation: 'cursorBlink 1.1s ease-in-out infinite',
        },
        '.cm-activeLine': {
          backgroundColor: 'transparent !important',
          boxShadow: 'inset 3px 0 0 var(--accent)',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--bg-base) !important',
          borderRight: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)',
          paddingLeft: '8px',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--bg-base) !important',
          color: 'var(--accent) !important',
          fontWeight: '600',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          fontSize: '12px',
          minWidth: '40px',
          padding: '0 8px',
          fontFeatureSettings: '"tnum"',
        },
        '&.cm-focused': {
          outline: 'none',
        },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
          background: 'var(--accent-soft-hover) !important',
        },
        '.cm-matchingBracket': {
          backgroundColor: 'var(--accent-soft)',
          outline: '1px solid var(--accent)',
          outlineOffset: '-1px',
          borderRadius: '2px',
          color: 'var(--accent) !important',
        },
        '.cm-foldPlaceholder': {
          backgroundColor: 'var(--accent-soft)',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
          borderRadius: '4px',
          padding: '0 4px',
          cursor: 'pointer',
        },
        '.cm-foldGutter .cm-gutterElement': {
          padding: '0 4px',
          cursor: 'pointer',
          opacity: 0.4,
          transition: 'opacity 0.15s',
        },
        '.cm-foldGutter .cm-gutterElement:hover': {
          opacity: 0.8,
        },
      }),
    ]
  })

  if (editorContainer.value) {
    view = new EditorView({ state, parent: editorContainer.value })
  }
}

// 工具栏操作
const wrapSelection = (before: string, after: string) => {
  if (!view) return
  const { from, to } = view.state.selection.main
  const selected = view.state.doc.sliceString(from, to)
  const replacement = before + selected + after
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from + before.length, head: from + before.length + selected.length }
  })
}

const insertLine = (prefix: string) => {
  if (!view) return
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const lineStart = line.from
  const lineText = view.state.doc.sliceString(lineStart, line.to)
  const newText = lineText.trim() ? prefix + lineText : prefix
  view.dispatch({
    changes: { from: lineStart, to: line.to, insert: newText },
    selection: { anchor: lineStart + newText.length }
  })
}

const getContent = () => view?.state.doc.toString() || ''
const setContent = (content: string) => {
  if (view) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
  }
}
const getCurrentLine = () => {
  if (!view) return 0
  return view.state.doc.lineAt(view.state.selection.main.head).number
}
const getCursorPosition = () => {
  if (!view) return { line: 0, column: 0 }
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  return { line: line.number, column: pos - line.from }
}
const insertText = (text: string) => {
  if (!view) return
  const pos = view.state.selection.main.head
  view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } })
}
const getSelectedText = () => {
  if (!view) return ''
  const { from, to } = view.state.selection.main
  return from === to ? '' : view.state.doc.sliceString(from, to)
}
const replaceSelection = (text: string) => {
  if (!view) return
  const { from, to } = view.state.selection.main
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
}
const focus = () => view?.focus()
const blur = () => view?.contentDOM.blur()

onMounted(() => { createEditor() })
onUnmounted(() => { view?.destroy() })
watch(() => props.modelValue, (newVal) => {
  if (view && newVal !== getContent()) setContent(newVal)
})

defineExpose({ getContent, setContent, getCurrentLine, getCursorPosition, insertText, getSelectedText, replaceSelection, focus, blur })
</script>

<style scoped>
.editor-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 工具栏 */
.editor-toolbar {
  background: var(--bg-mantle);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  transition: all var(--transition-smooth);
  overflow: hidden;
}
.editor-toolbar.collapsed {
  height: 0 !important;
  border-bottom-color: transparent;
}
.editor-toolbar:not(.collapsed) {
  height: 36px;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}
.toolbar-inner::-webkit-scrollbar {
  display: none;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* 分隔线 */
.toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--border-subtle);
  margin: 0 var(--space-2);
  flex-shrink: 0;
}

/* 工具按钮 */
.tool-btn {
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}
.tool-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}
.tool-btn:active {
  background: var(--bg-active);
  transform: scale(0.95);
}

/* 折叠按钮 */
.toolbar-toggle {
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid transparent;
  border-left: 1px solid var(--border-subtle);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  margin-left: var(--space-2);
  border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
}
.toolbar-toggle:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}
.editor-toolbar.collapsed .toolbar-toggle svg {
  transform: rotate(180deg);
}

/* 编辑器容器 */
.editor-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}
.editor-container :deep(.cm-editor) {
  height: 100%;
}

/* 光标闪烁动画 */
@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
