// src/services/commandRegistry.ts
import type { EditorView } from '@codemirror/view'
import type { AIService } from './ai'
import type { fileSystem } from './fileSystem'
import type { knowledgeIndex } from './knowledgeIndex'
import type { ragService } from './rag'

export interface CommandContext {
  view: EditorView
  from: number
  to: number
  selectedText: string
  services: {
    ai: AIService
    fileSystem: typeof fileSystem
    knowledgeIndex: typeof knowledgeIndex
    rag: typeof ragService
  }
}

export interface SlashCommand {
  id: string
  label: string
  description: string
  icon: string
  category: 'block' | 'ai' | 'insert'
  keywords: string[]
  group?: string
  priority?: number
  requireSelection?: boolean
  execute: (ctx: CommandContext) => void | Promise<void>
}

export interface CommandHooks {
  beforeExecute?: (ctx: CommandContext) => boolean | Promise<boolean>
  afterExecute?: (ctx: CommandContext, result?: unknown) => void
}

class CommandRegistryImpl {
  private commands = new Map<string, SlashCommand>()
  private hooks = new Map<string, CommandHooks>()

  register(command: SlashCommand, hooks?: CommandHooks): () => void {
    this.commands.set(command.id, command)
    if (hooks) this.hooks.set(command.id, hooks)
    return () => this.unregister(command.id)
  }

  unregister(id: string): void {
    this.commands.delete(id)
    this.hooks.delete(id)
  }

  getFiltered(query: string, category?: string): SlashCommand[] {
    const q = query.toLowerCase()
    let results: SlashCommand[] = []

    for (const cmd of this.commands.values()) {
      if (category && cmd.category !== category) continue
      const match =
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords.some(k => k.toLowerCase().includes(q)) ||
        cmd.id.toLowerCase().includes(q)
      if (match) results.push(cmd)
    }

    results.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    return results
  }

  getAll(category?: string): SlashCommand[] {
    let results = [...this.commands.values()]
    if (category) results = results.filter(c => c.category === category)
    results.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    return results
  }

  get(id: string): SlashCommand | undefined {
    return this.commands.get(id)
  }

  async execute(id: string, ctx: CommandContext): Promise<void> {
    const cmd = this.commands.get(id)
    if (!cmd) return

    const hooks = this.hooks.get(id)
    if (hooks?.beforeExecute) {
      const shouldContinue = await hooks.beforeExecute(ctx)
      if (!shouldContinue) return
    }

    const result = await cmd.execute(ctx)

    if (hooks?.afterExecute) {
      hooks.afterExecute(ctx, result)
    }
  }
}

export const commandRegistry = new CommandRegistryImpl()
