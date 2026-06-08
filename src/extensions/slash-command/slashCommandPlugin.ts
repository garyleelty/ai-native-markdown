import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from '@codemirror/view'
import { Prec, RangeSetBuilder } from '@codemirror/state'
import { commandRegistry, type CommandContext, type SlashCommand } from '@/services/commandRegistry'
import { aiService } from '@/services/ai'
import { fileSystem } from '@/services/fileSystem'
import { knowledgeIndex } from '@/services/knowledgeIndex'
import { ragService } from '@/services/rag'
import { SlashCommandMenuWidget } from './SlashCommandMenuWidget'
import { blockCommands } from './commands/blockCommands'
import { aiCommands } from './commands/aiCommands'
import { insertCommands } from './commands/insertCommands'

let activeMenu: SlashCommandMenuWidget | null = null
let selectedIndex = 0
let slashFrom = 0
let dismissed = false

function registerCommands(): void {
  const allCommands = [...blockCommands, ...aiCommands, ...insertCommands]
  for (const cmd of allCommands) {
    commandRegistry.register(cmd)
  }
}

registerCommands()

function detectSlashCommand(view: EditorView): { from: number; query: string } | null {
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const textBefore = line.text.slice(0, pos - line.from)

  const match = textBefore.match(/(?:^|\s)\/([^\s]*)$/)
  if (!match) return null

  const query = match[1]
  const slashIndex = match.index! + match[0].length - query.length - 1
  const from = line.from + slashIndex

  return { from, query }
}

function buildCommandContext(view: EditorView, from: number, to: number): CommandContext {
  const sel = view.state.selection.main
  const selectedText = view.state.sliceDoc(sel.from, sel.to)
  return {
    view,
    from,
    to,
    selectedText,
    services: {
      ai: aiService,
      fileSystem,
      knowledgeIndex,
      rag: ragService,
    },
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  if (dismissed) {
    dismissed = false
    activeMenu = null
    return Decoration.none
  }
  const detected = detectSlashCommand(view)
  if (!detected) {
    activeMenu = null
    return Decoration.none
  }

  const { from, query } = detected
  const pos = view.state.selection.main.head
  const commands = commandRegistry.getFiltered(query)

  if (commands.length === 0) {
    activeMenu = null
    return Decoration.none
  }

  if (selectedIndex >= commands.length) {
    selectedIndex = 0
  }

  const onSelect = (command: SlashCommand) => {
    const currentPos = view.state.selection.main.head
    view.dispatch({
      changes: { from: slashFrom, to: currentPos, insert: '' },
    })
    const ctx = buildCommandContext(view, slashFrom, slashFrom)
    command.execute(ctx)
    activeMenu = null
    selectedIndex = 0
  }

  const onClose = () => {
    activeMenu = null
    selectedIndex = 0
    view.dispatch({})
  }

  const widget = new SlashCommandMenuWidget(
    commands,
    selectedIndex,
    onSelect,
    onClose,
  )

  activeMenu = widget
  slashFrom = from

  const builder = new RangeSetBuilder<Decoration>()
  builder.add(pos, pos, Decoration.widget({ widget, side: 1 }))
  return builder.finish()
}

const slashCommandPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet) {
      this.decorations = buildDecorations(update.view)
    }
  }
}, {
  decorations: v => v.decorations,
})

const slashCommandKeymap = Prec.highest(keymap.of([
  {
    key: 'ArrowDown',
    run(view) {
      if (!activeMenu) return false
      const detected = detectSlashCommand(view)
      if (!detected) return false
      const commands = commandRegistry.getFiltered(detected.query)
      if (commands.length === 0) return false
      selectedIndex = (selectedIndex + 1) % commands.length
      activeMenu.updateSelected(selectedIndex)
      return true
    },
  },
  {
    key: 'ArrowUp',
    run(view) {
      if (!activeMenu) return false
      const detected = detectSlashCommand(view)
      if (!detected) return false
      const commands = commandRegistry.getFiltered(detected.query)
      if (commands.length === 0) return false
      selectedIndex = (selectedIndex - 1 + commands.length) % commands.length
      activeMenu.updateSelected(selectedIndex)
      return true
    },
  },
  {
    key: 'Enter',
    run(view) {
      if (!activeMenu) return false
      const detected = detectSlashCommand(view)
      if (!detected) return false
      const commands = commandRegistry.getFiltered(detected.query)
      if (commands.length === 0) return false

      const command = commands[selectedIndex]
      const currentPos = view.state.selection.main.head

      view.dispatch({
        changes: { from: slashFrom, to: currentPos, insert: '' },
      })

      const ctx = buildCommandContext(view, slashFrom, slashFrom)
      command.execute(ctx)

      activeMenu = null
      selectedIndex = 0
      return true
    },
  },
]))

// Use native DOM event handler for Escape since CM6 keymap may be intercepted
// by other extensions (closeBrackets, search, etc.)
const slashCommandDomHandler = EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.key === 'Escape' && activeMenu) {
      event.preventDefault()
      event.stopPropagation()
      activeMenu = null
      selectedIndex = 0
      const currentPos = view.state.selection.main.head
      view.dispatch({
        changes: { from: slashFrom, to: currentPos, insert: '' }
      })
      return true
    }
    return false
  }
})

export const slashCommandExtension = [
  slashCommandPlugin,
  slashCommandKeymap,
  slashCommandDomHandler,
]
