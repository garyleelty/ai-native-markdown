import { ViewPlugin, type ViewUpdate, type EditorView } from '@codemirror/view'
import { computeDecorations } from './decorations'

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations
    view

    constructor(view: EditorView) {
      this.view = view
      this.decorations = computeDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = computeDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
)

export { computeDecorations } from './decorations'
export * from './widgets'
