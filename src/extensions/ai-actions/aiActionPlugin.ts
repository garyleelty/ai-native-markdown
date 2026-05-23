import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { AIActionMenuWidget } from './AIActionMenuWidget'

export const aiActionPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.selectionSet || update.docChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const { from, to } = view.state.selection.main
    const selectedText = view.state.sliceDoc(from, to)

    if (!selectedText || from === to) {
      return Decoration.none
    }

    const widget = new AIActionMenuWidget(selectedText, from, to, view)

    const builder = new RangeSetBuilder<Decoration>()
    builder.add(to, to, Decoration.widget({ widget, side: 1 }))
    return builder.finish()
  }
}, {
  decorations: v => v.decorations
})

export const aiActionKeymap = keymap.of([
  {
    key: 'Mod-k',
    run(view) {
      const { from, to } = view.state.selection.main
      if (from === to) return false
      view.dispatch({ selection: { anchor: from, head: to } })
      return true
    }
  }
])