import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, keymap } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { InlineEditWidget } from './InlineEditWidget'

// 跟踪当前是否有活跃的 inline edit widget，避免重复创建
let hasActiveWidget = false

export const inlineEditPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(_view: EditorView) {
    this.decorations = Decoration.none
  }

  update(update: ViewUpdate) {
    // 只在选区变化且没有活跃 widget 时创建新 widget
    if (update.selectionSet) {
      const { from, to } = update.state.selection.main
      const selectedText = update.state.sliceDoc(from, to)

      if (selectedText.length > 0 && !hasActiveWidget) {
        const widget = Decoration.widget({
          widget: new InlineEditWidget(selectedText, from, to, update.view, () => {
            hasActiveWidget = false
          }),
          side: 1
        })
        const builder = new RangeSetBuilder<Decoration>()
        builder.add(to, to, widget)
        this.decorations = builder.finish()
        hasActiveWidget = true
      } else if (selectedText.length === 0) {
        // 选区清空时移除 widget
        this.decorations = Decoration.none
        hasActiveWidget = false
      }
    }

    // 文档变化时清除 widget（因为 from/to 可能已失效）
    if (update.docChanged && hasActiveWidget) {
      this.decorations = Decoration.none
      hasActiveWidget = false
    }
  }

  destroy() {
    hasActiveWidget = false
  }
}, {
  decorations: v => v.decorations
})

export const inlineEditKeymap = keymap.of([
  {
    key: 'Mod-Shift-e',
    run(view) {
      const { from, to } = view.state.selection.main
      const selectedText = view.state.sliceDoc(from, to)
      if (!selectedText) return false
      // 重新触发选区更新以显示浮层
      hasActiveWidget = false
      view.dispatch({ selection: { anchor: from, head: to } })
      return true
    }
  }
])
