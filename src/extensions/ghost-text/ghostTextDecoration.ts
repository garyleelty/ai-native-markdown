import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

export const ghostTextMark = Decoration.mark({
  class: 'cm-ghost-text',
  attributes: { style: 'opacity: 0.4; color: var(--text-muted); font-style: italic;' }
})

export function buildGhostTextDecoration(
  view: EditorView,
  ghostText: string,
  ghostTextPos: number
): DecorationSet {
  if (!ghostText || ghostTextPos < 0) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  const from = ghostTextPos
  const to = ghostTextPos + ghostText.length

  if (from <= view.state.doc.length && to <= view.state.doc.length) {
    builder.add(from, to, ghostTextMark)
  }

  return builder.finish()
}
