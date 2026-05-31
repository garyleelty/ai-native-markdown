import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, keymap } from '@codemirror/view'
import { StateEffect, RangeSetBuilder } from '@codemirror/state'
import { InlineEditWidget } from './InlineEditWidget'

export const showInlineEditEffect = StateEffect.define<{ from: number; to: number; text: string }>()

let hasActiveWidget = false

export const inlineEditPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(_view: EditorView) {
    this.decorations = Decoration.none
  }

  update(update: ViewUpdate) {
    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (effect.is(showInlineEditEffect)) {
          const { from, to, text } = effect.value
          const widget = Decoration.widget({
            widget: new InlineEditWidget(text, from, to, update.view, () => {
              hasActiveWidget = false
            }),
            side: 1
          })
          const builder = new RangeSetBuilder<Decoration>()
          builder.add(to, to, widget)
          this.decorations = builder.finish()
          hasActiveWidget = true
          return
        }
      }
    }

    if (update.selectionSet) {
      const { from, to } = update.state.selection.main
      if (from === to && this.decorations.size > 0) {
        this.decorations = Decoration.none
        hasActiveWidget = false
      }
    }

    if (update.docChanged && this.decorations.size > 0) {
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
      view.dispatch({ effects: showInlineEditEffect.of({ from, to, text: selectedText }) })
      return true
    }
  }
])
