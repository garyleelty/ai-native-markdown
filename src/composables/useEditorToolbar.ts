import { toRef } from 'vue'
import type { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'

export function useEditorToolbar(options: {
  editorView: () => EditorView | undefined
  livePreview: () => boolean
  currentFile: () => string
  settingsStore: () => ReturnType<typeof import('@/stores/settings').useSettingsStore>
  emit: {
    (e: 'toggle-live-preview'): void
  }
}) {
  const { editorView, settingsStore, emit } = options

  const store = settingsStore()
  const wordWrap = toRef(store, 'wordWrap')

  const wrapSelection = (before: string, after: string) => {
    const view = editorView()
    if (!view) return
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const hasSelection = selected.length > 0

    if (hasSelection) {
      const wrapped = before + selected + after
      view.dispatch({
        changes: { from, to, insert: wrapped },
        selection: { anchor: from + before.length, head: from + before.length + selected.length }
      })
    } else {
      view.dispatch({
        changes: { from, to, insert: before + after },
        selection: { anchor: from + before.length, head: from + before.length }
      })
    }
    view.focus()
  }

  const insertLine = (prefix: string) => {
    const view = editorView()
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const lineText = line.text
    const hasContent = lineText.length > 0

    if (hasContent) {
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: prefix },
        selection: { anchor: line.from + prefix.length }
      })
    } else {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: prefix },
        selection: { anchor: line.from + prefix.length }
      })
    }
    view.focus()
  }

  const insertLink = () => {
    const view = editorView()
    if (!view) return
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const linkText = selected || '链接文字'
    const insert = `[${linkText}](url)`

    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + linkText.length + 3, head: from + linkText.length + 6 }
    })
    view.focus()
  }

  const insertImage = () => {
    const view = editorView()
    if (!view) return
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const altText = selected || '图片描述'
    const insert = `![${altText}](url)`

    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + altText.length + 4, head: from + altText.length + 7 }
    })
    view.focus()
  }

  const setContent = (content: string) => {
    const view = editorView()
    if (!view) return
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: content
      }
    })
  }

  const insertText = (text: string) => {
    const view = editorView()
    if (!view) return
    const { from } = view.state.selection.main
    view.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + text.length }
    })
    view.focus()
  }

  const getSelectedText = (): string => {
    const view = editorView()
    if (!view) return ''
    const { from, to } = view.state.selection.main
    return view.state.sliceDoc(from, to)
  }

  const scrollToLine = (lineNumber: number) => {
    const view = editorView()
    if (!view) return
    const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines))
    view.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: true
    })
    view.focus()
  }

  const toggleWordWrap = () => {
    wordWrap.value = !wordWrap.value
  }

  const toggleLivePreview = () => {
    emit('toggle-live-preview')
  }

  const insertUnorderedList = () => {
    const view = editorView()
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const lineText = line.text
    if (lineText.startsWith('- ')) {
      view.dispatch({
        changes: { from: line.from, to: line.from + 2, insert: '' },
        selection: { anchor: line.from }
      })
    } else {
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: '- ' },
        selection: { anchor: line.from + 2 }
      })
    }
    view.focus()
  }

  const insertOrderedList = () => {
    const view = editorView()
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const lineText = line.text
    if (lineText.startsWith('1. ')) {
      view.dispatch({
        changes: { from: line.from, to: line.from + 3, insert: '' },
        selection: { anchor: line.from }
      })
    } else {
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: '1. ' },
        selection: { anchor: line.from + 3 }
      })
    }
    view.focus()
  }

  const insertTaskList = () => {
    const view = editorView()
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const lineText = line.text
    if (lineText.startsWith('- [ ] ')) {
      view.dispatch({
        changes: { from: line.from, to: line.from + 6, insert: '' },
        selection: { anchor: line.from }
      })
    } else {
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: '- [ ] ' },
        selection: { anchor: line.from + 6 }
      })
    }
    view.focus()
  }

  const toggleGhostText = () => {
    const store = settingsStore()
    store.ghostTextConfig = {
      ...store.ghostTextConfig,
      enabled: !store.ghostTextConfig.enabled
    }
  }

  const handleUndo = () => {
    const view = editorView()
    if (!view) return
    undo(view)
  }

  const handleRedo = () => {
    const view = editorView()
    if (!view) return
    redo(view)
  }

  return {
    wordWrap,
    wrapSelection,
    insertLine,
    insertLink,
    insertImage,
    insertUnorderedList,
    insertOrderedList,
    insertTaskList,
    insertText,
    setContent,
    getSelectedText,
    scrollToLine,
    toggleWordWrap,
    toggleLivePreview,
    toggleGhostText,
    handleUndo,
    handleRedo,
  }
}
