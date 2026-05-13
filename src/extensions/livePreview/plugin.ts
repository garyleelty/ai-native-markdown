import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, EditorView } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'
import { parseMarkdownElements } from './parsers'
import { buildDecorations } from './decorations'

const updateDecorations = StateEffect.define<DecorationSet>()

const livePreviewState = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(updateDecorations)) {
        return effect.value
      }
    }
    return decorations
  },
  provide: (f) => EditorView.decorations.from(f)
})

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    private lastDocText: string
    private lastCursorLine: number
    private cachedElements: ReturnType<typeof parseMarkdownElements>
    private view: EditorView

    constructor(view: EditorView) {
      this.view = view
      this.lastDocText = view.state.doc.toString()
      this.lastCursorLine = this.getCursorLine(view)
      this.cachedElements = parseMarkdownElements(this.lastDocText)
      this.applyDecorations()
    }

    getCursorLine(view: EditorView): number {
      const pos = view.state.selection.main.head
      return view.state.doc.lineAt(pos).number - 1
    }

    update(update: ViewUpdate) {
      const docChanged = update.docChanged
      const selectionChanged = update.selectionSet

      if (!docChanged && !selectionChanged) return

      const currentDocText = update.state.doc.toString()
      const currentCursorLine = this.getCursorLine(update.view)

      if (docChanged) {
        this.cachedElements = parseMarkdownElements(currentDocText)
        this.lastDocText = currentDocText
      }

      this.lastCursorLine = currentCursorLine
      this.applyDecorations()
    }

    private applyDecorations() {
      const decorations = buildDecorations(
        this.cachedElements,
        this.lastCursorLine,
        this.lastDocText
      )
      this.view.dispatch({
        effects: updateDecorations.of(decorations)
      })
    }
  }
)

export function livePreviewExtension() {
  return [livePreviewState, livePreviewPlugin]
}
