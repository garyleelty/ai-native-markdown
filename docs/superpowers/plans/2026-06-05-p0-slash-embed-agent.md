# P0 功能实施计划：斜杠命令 + 块嵌入 + AI Agent 工作流

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现斜杠命令面板、块嵌入渲染、AI Agent 工作流三个 P0 功能，使产品在编辑体验和 AI 原生深度上超越 Obsidian。

**Architecture:** 渐进式三阶段交付。阶段 1 实现斜杠命令系统（CommandRegistry + CM6 Plugin + Widget），阶段 2 实现块嵌入（MarkdownIt 插件 + EmbedResolver + EmbedWidget + 实时同步），阶段 3 实现 AI Agent（工具注册表 + 上下文构建器 + AgentController + LLM Function Calling）。斜杠命令是统一入口，AI Agent 通过斜杠命令和 Chat Panel 触发。

**Tech Stack:** CodeMirror 6 (ViewPlugin + WidgetType + Decoration), MarkdownIt (inline rule), Dexie (IndexedDB), Web Crypto API, OpenAI Function Calling / Ollama tool calling, Playwright e2e tests

---

## 阶段 1：斜杠命令系统

### 文件结构

```
src/
├── services/
│   └── commandRegistry.ts              # 命令注册表（新建）
├── extensions/
│   └── slash-command/
│       ├── slashCommandPlugin.ts        # CM6 ViewPlugin（新建）
│       ├── SlashCommandMenuWidget.ts    # 命令菜单 Widget（新建）
│       ├── commands/
│       │   ├── blockCommands.ts         # Markdown 语法块命令（新建）
│       │   ├── aiCommands.ts            # AI 操作命令（新建）
│       │   └── insertCommands.ts        # 插入类命令（新建）
│       └── styles.css                   # 样式（新建）
├── components/
│   └── Editor.vue                       # 修改：接入斜杠命令扩展
e2e/
└── slash-commands.spec.ts               # E2E 测试（新建）
```

---

### Task 1: CommandRegistry 核心类型与注册逻辑

**Files:**
- Create: `src/services/commandRegistry.ts`

- [ ] **Step 1: 创建 CommandRegistry**

```ts
// src/services/commandRegistry.ts
import type { EditorView } from '@codemirror/view'
import type { AIService } from './ai'
import type { FileSystemService } from './fileSystem'
import type { KnowledgeIndexService } from './knowledgeIndex'
import type { RAGService } from './rag'

export interface CommandContext {
  view: EditorView
  from: number
  to: number
  selectedText: string
  services: {
    ai: AIService
    fileSystem: FileSystemService
    knowledgeIndex: KnowledgeIndexService
    rag: RAGService
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
```

- [ ] **Step 2: 验证类型检查通过**

Run: `cd /Users/tianyi/code/ai-native-markdown && npx vue-tsc --noEmit 2>&1 | head -20`

Expected: 无新增错误（可能有未使用 import 的警告，后续步骤会用到）

- [ ] **Step 3: Commit**

```bash
git add src/services/commandRegistry.ts
git commit -m "feat: add CommandRegistry for slash command system"
```

---

### Task 2: Markdown 语法块命令

**Files:**
- Create: `src/extensions/slash-command/commands/blockCommands.ts`

- [ ] **Step 1: 创建 blockCommands**

```ts
// src/extensions/slash-command/commands/blockCommands.ts
import type { SlashCommand, CommandContext } from '@/services/commandRegistry'

function insertBlock(ctx: CommandContext, text: string): void {
  const { view, from, to } = ctx
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length }
  })
}

export const blockCommands: SlashCommand[] = [
  {
    id: 'heading-1',
    label: '一级标题',
    description: '插入一级标题',
    icon: 'heading',
    category: 'block',
    keywords: ['heading', 'h1', '标题', '一级'],
    priority: 10,
    execute: (ctx) => insertBlock(ctx, '# ')
  },
  {
    id: 'heading-2',
    label: '二级标题',
    description: '插入二级标题',
    icon: 'heading',
    category: 'block',
    keywords: ['heading', 'h2', '标题', '二级'],
    priority: 9,
    execute: (ctx) => insertBlock(ctx, '## ')
  },
  {
    id: 'heading-3',
    label: '三级标题',
    description: '插入三级标题',
    icon: 'heading',
    category: 'block',
    keywords: ['heading', 'h3', '标题', '三级'],
    priority: 8,
    execute: (ctx) => insertBlock(ctx, '### ')
  },
  {
    id: 'code-block',
    label: '代码块',
    description: '插入代码块',
    icon: 'code',
    category: 'block',
    keywords: ['code', '代码', '代码块'],
    priority: 7,
    execute: (ctx) => {
      const { view, from, to } = ctx
      const insert = '```\n\n```'
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 4 }
      })
    }
  },
  {
    id: 'ordered-list',
    label: '有序列表',
    description: '插入有序列表',
    icon: 'list-ol',
    category: 'block',
    keywords: ['ordered', 'list', '有序', '列表', '数字'],
    priority: 6,
    execute: (ctx) => insertBlock(ctx, '1. ')
  },
  {
    id: 'unordered-list',
    label: '无序列表',
    description: '插入无序列表',
    icon: 'list-ul',
    category: 'block',
    keywords: ['unordered', 'list', '无序', '列表', 'bullet'],
    priority: 5,
    execute: (ctx) => insertBlock(ctx, '- ')
  },
  {
    id: 'task-list',
    label: '任务列表',
    description: '插入任务列表',
    icon: 'check-square',
    category: 'block',
    keywords: ['task', 'todo', '任务', '待办', 'checkbox'],
    priority: 4,
    execute: (ctx) => insertBlock(ctx, '- [ ] ')
  },
  {
    id: 'blockquote',
    label: '引用',
    description: '插入引用块',
    icon: 'quote-right',
    category: 'block',
    keywords: ['quote', 'blockquote', '引用'],
    priority: 3,
    execute: (ctx) => insertBlock(ctx, '> ')
  },
  {
    id: 'table',
    label: '表格',
    description: '插入表格',
    icon: 'table',
    category: 'block',
    keywords: ['table', '表格'],
    priority: 2,
    execute: (ctx) => {
      const { view, from, to } = ctx
      const insert = '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| | | |'
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 2 }
      })
    }
  },
  {
    id: 'horizontal-rule',
    label: '分割线',
    description: '插入分割线',
    icon: 'minus',
    category: 'block',
    keywords: ['horizontal', 'rule', '分割线', '分隔', 'hr'],
    priority: 1,
    execute: (ctx) => insertBlock(ctx, '\n---\n')
  },
  {
    id: 'callout',
    label: '标注',
    description: '插入标注块',
    icon: 'alert-circle',
    category: 'block',
    keywords: ['callout', 'note', '标注', '提示', '警告'],
    priority: 1,
    execute: (ctx) => insertBlock(ctx, '> [!note]\n> ')
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/slash-command/commands/blockCommands.ts
git commit -m "feat: add block commands for slash command system"
```

---

### Task 3: AI 操作命令

**Files:**
- Create: `src/extensions/slash-command/commands/aiCommands.ts`

- [ ] **Step 1: 创建 aiCommands**

```ts
// src/extensions/slash-command/commands/aiCommands.ts
import type { SlashCommand, CommandContext } from '@/services/commandRegistry'
import { aiService } from '@/services/ai'
import { handleError } from '@/utils/errorHandler'

async function executeAIAction(
  ctx: CommandContext,
  systemRole: string,
  promptPrefix: string,
  temperature?: number
): Promise<void> {
  const provider = aiService.getActiveProvider()
  if (!provider) return

  const { view, from, to, selectedText } = ctx
  const text = selectedText || view.state.sliceDoc(
    Math.max(0, from - 500),
    from
  )

  const controller = new AbortController()

  try {
    const messages = [
      { role: 'system' as const, content: systemRole },
      { role: 'user' as const, content: `${promptPrefix}\n\n${text}` }
    ]

    let result = ''
    for await (const chunk of provider.streamChat(messages, {
      temperature,
      signal: controller.signal
    })) {
      result += chunk
    }

    if (result) {
      view.dispatch({
        changes: { from, to, insert: result },
        selection: { anchor: from + result.length }
      })
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      handleError(e, 'AI 操作失败')
    }
  }
}

export const aiCommands: SlashCommand[] = [
  {
    id: 'ai-summarize',
    label: 'AI 摘要',
    description: '生成选中文本的摘要',
    icon: 'file-text',
    category: 'ai',
    keywords: ['summarize', '摘要', '总结', '概括'],
    priority: 10,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的文本摘要助手。请生成简洁准确的摘要，保留核心要点。',
      '请为以下文本生成摘要：'
    )
  },
  {
    id: 'ai-translate-zh',
    label: 'AI 译中',
    description: '将选中文本翻译为中文',
    icon: 'languages',
    category: 'ai',
    keywords: ['translate', 'chinese', '翻译', '中文', '译中'],
    priority: 9,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的翻译助手。请将文本翻译为自然流畅的中文。',
      '请将以下文本翻译为中文：'
    )
  },
  {
    id: 'ai-translate-en',
    label: 'AI 译英',
    description: '将选中文本翻译为英文',
    icon: 'languages',
    category: 'ai',
    keywords: ['translate', 'english', '翻译', '英文', '译英'],
    priority: 8,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的翻译助手。请将文本翻译为自然流畅的英文。',
      '请将以下文本翻译为英文：'
    )
  },
  {
    id: 'ai-polish',
    label: 'AI 润色',
    description: '润色选中文本',
    icon: 'sparkles',
    category: 'ai',
    keywords: ['polish', '润色', '优化', '改进', '修饰'],
    priority: 7,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的文本润色助手。请改善文本的表达，使其更清晰、流畅、专业，同时保持原意不变。',
      '请润色以下文本：'
    )
  },
  {
    id: 'ai-expand',
    label: 'AI 扩写',
    description: '扩写选中文本',
    icon: 'maximize-2',
    category: 'ai',
    keywords: ['expand', '扩写', '扩展', '展开', '详细'],
    priority: 6,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的文本扩写助手。请在保持原意的基础上，丰富细节、增加论据、扩展内容。',
      '请扩写以下文本：'
    )
  },
  {
    id: 'ai-outline',
    label: 'AI 大纲',
    description: '为当前文档生成大纲',
    icon: 'list',
    category: 'ai',
    keywords: ['outline', '大纲', '目录', '结构'],
    priority: 5,
    requireSelection: false,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的大纲生成助手。请根据文档内容生成结构化大纲，使用 Markdown 标题层级。',
      '请为以下文档生成大纲：'
    )
  },
  {
    id: 'ai-continue',
    label: 'AI 续写',
    description: '续写光标后的内容',
    icon: 'corner-down-right',
    category: 'ai',
    keywords: ['continue', '续写', '继续', '补全'],
    priority: 4,
    requireSelection: false,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的文本续写助手。请自然地续写文本，保持风格和语调一致。',
      '请续写以下文本：'
    )
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/slash-command/commands/aiCommands.ts
git commit -m "feat: add AI commands for slash command system"
```

---

### Task 4: 插入类命令

**Files:**
- Create: `src/extensions/slash-command/commands/insertCommands.ts`

- [ ] **Step 1: 创建 insertCommands**

```ts
// src/extensions/slash-command/commands/insertCommands.ts
import type { SlashCommand, CommandContext } from '@/services/commandRegistry'

export const insertCommands: SlashCommand[] = [
  {
    id: 'insert-date',
    label: '当前日期',
    description: '插入当前日期',
    icon: 'calendar',
    category: 'insert',
    keywords: ['date', '日期', '今天'],
    priority: 3,
    execute: (ctx) => {
      const date = new Date().toISOString().split('T')[0]
      const { view, from, to } = ctx
      view.dispatch({
        changes: { from, to, insert: date },
        selection: { anchor: from + date.length }
      })
    }
  },
  {
    id: 'insert-time',
    label: '当前时间',
    description: '插入当前时间',
    icon: 'clock',
    category: 'insert',
    keywords: ['time', '时间', '现在'],
    priority: 2,
    execute: (ctx) => {
      const time = new Date().toTimeString().slice(0, 5)
      const { view, from, to } = ctx
      view.dispatch({
        changes: { from, to, insert: time },
        selection: { anchor: from + time.length }
      })
    }
  },
  {
    id: 'insert-timestamp',
    label: '日期时间',
    description: '插入日期和时间',
    icon: 'calendar-clock',
    category: 'insert',
    keywords: ['timestamp', '日期时间', '时间戳'],
    priority: 1,
    execute: (ctx) => {
      const now = new Date()
      const ts = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`
      const { view, from, to } = ctx
      view.dispatch({
        changes: { from, to, insert: ts },
        selection: { anchor: from + ts.length }
      })
    }
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/slash-command/commands/insertCommands.ts
git commit -m "feat: add insert commands for slash command system"
```

---

### Task 5: SlashCommandMenuWidget

**Files:**
- Create: `src/extensions/slash-command/SlashCommandMenuWidget.ts`

- [ ] **Step 1: 创建 SlashCommandMenuWidget**

```ts
// src/extensions/slash-command/SlashCommandMenuWidget.ts
import { WidgetType } from '@codemirror/view'
import type { SlashCommand, CommandContext } from '@/services/commandRegistry'

const MAX_VISIBLE = 8

export class SlashCommandMenuWidget extends WidgetType {
  private filtered: SlashCommand[]
  private selectedIdx = 0
  private destroyed = false
  private container: HTMLElement | null = null

  constructor(
    private commands: SlashCommand[],
    private query: string,
    private context: CommandContext
  ) {
    super()
    this.filtered = this.filterCommands()
  }

  private filterCommands(): SlashCommand[] {
    const q = this.query.toLowerCase()
    if (!q) return this.commands.slice(0, MAX_VISIBLE)
    return this.commands
      .filter(cmd => {
        if (cmd.requireSelection && !this.context.selectedText) return false
        return cmd.label.toLowerCase().includes(q) ||
          cmd.keywords.some(k => k.toLowerCase().includes(q)) ||
          cmd.id.toLowerCase().includes(q)
      })
      .slice(0, MAX_VISIBLE)
  }

  updateQuery(query: string): boolean {
    this.query = query
    this.filtered = this.filterCommands()
    this.selectedIdx = 0
    this.renderList()
    return this.filtered.length > 0
  }

  selectNext(): void {
    if (this.selectedIdx < this.filtered.length - 1) {
      this.selectedIdx++
      this.renderList()
    }
  }

  selectPrev(): void {
    if (this.selectedIdx > 0) {
      this.selectedIdx--
      this.renderList()
    }
  }

  async confirm(): Promise<boolean> {
    const cmd = this.filtered[this.selectedIdx]
    if (!cmd) return false
    await cmd.execute(this.context)
    return true
  }

  hasItems(): boolean {
    return this.filtered.length > 0
  }

  toDOM(): HTMLElement {
    this.container = document.createElement('div')
    this.container.className = 'slash-command-menu'
    this.renderList()
    return this.container
  }

  private renderList(): void {
    if (!this.container || this.destroyed) return
    this.container.innerHTML = ''

    let currentCategory = ''
    for (let i = 0; i < this.filtered.length; i++) {
      const cmd = this.filtered[i]

      if (cmd.category !== currentCategory) {
        currentCategory = cmd.category
        const header = document.createElement('div')
        header.className = 'slash-command-category'
        header.textContent = this.getCategoryLabel(cmd.category)
        this.container.appendChild(header)
      }

      const item = document.createElement('div')
      item.className = 'slash-command-item' + (i === this.selectedIdx ? ' selected' : '')
      item.innerHTML = `
        <span class="slash-command-icon">${this.getIcon(cmd.icon)}</span>
        <span class="slash-command-label">${cmd.label}</span>
        <span class="slash-command-desc">${cmd.description}</span>
      `
      item.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.selectedIdx = i
        this.confirm()
      })
      this.container.appendChild(item)
    }
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      block: 'Markdown 语法块',
      ai: 'AI 操作',
      insert: '插入'
    }
    return labels[category] || category
  }

  private getIcon(icon: string): string {
    return `<svg class="icon" viewBox="0 0 24 24" width="16" height="16"><use href="#icon-${icon}"/></svg>`
  }

  eq(other: SlashCommandMenuWidget): boolean {
    return other.query === this.query && other.commands === this.commands
  }

  ignoreEvent(): boolean {
    return false
  }

  destroy(): void {
    this.destroyed = true
    this.container = null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/slash-command/SlashCommandMenuWidget.ts
git commit -m "feat: add SlashCommandMenuWidget for slash command menu rendering"
```

---

### Task 6: SlashCommandPlugin

**Files:**
- Create: `src/extensions/slash-command/slashCommandPlugin.ts`

- [ ] **Step 1: 创建 SlashCommandPlugin**

```ts
// src/extensions/slash-command/slashCommandPlugin.ts
import { ViewPlugin, ViewUpdate, Decoration, EditorView, keymap } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { Prec } from '@codemirror/state'
import { commandRegistry } from '@/services/commandRegistry'
import { SlashCommandMenuWidget } from './SlashCommandMenuWidget'
import { blockCommands } from './commands/blockCommands'
import { aiCommands } from './commands/aiCommands'
import { insertCommands } from './commands/insertCommands'
import { aiService } from '@/services/ai'
import { fileSystem } from '@/services/fileSystem'
import { knowledgeIndex } from '@/services/knowledgeIndex'
import { ragService } from '@/services/rag'

// Register all commands
const allCommands = [...blockCommands, ...aiCommands, ...insertCommands]
for (const cmd of allCommands) {
  commandRegistry.register(cmd)
}

let activeMenu: SlashCommandMenuWidget | null = null
let slashFrom = -1

const slashCommandPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = Decoration.none
  }

  update(update: ViewUpdate) {
    if (!update.docChanged && !update.selectionSet) return

    const { state } = update.view
    const pos = state.selection.main.head
    const line = state.doc.lineAt(pos)
    const textBefore = state.sliceDoc(line.from, pos)

    // Check if cursor is after a slash at line start or after space
    const slashMatch = textBefore.match(/(?:^|\s)\/([^\s]*)$/)

    if (slashMatch) {
      const query = slashMatch[1]
      const slashPos = line.from + slashMatch.index! + (slashMatch[0].startsWith(' ') ? 1 : 0)
      const selectedText = state.sliceDoc(
        state.selection.main.from,
        state.selection.main.to
      )

      const ctx = {
        view: update.view,
        from: slashPos,
        to: pos,
        selectedText,
        services: { ai: aiService, fileSystem, knowledgeIndex, rag: ragService }
      }

      const commands = commandRegistry.getAll()
      const widget = new SlashCommandMenuWidget(commands, query, ctx)

      if (widget.hasItems()) {
        activeMenu = widget
        slashFrom = slashPos
        const builder = new RangeSetBuilder<Decoration>()
        builder.add(pos, pos, Decoration.widget({ widget, side: 1 }))
        this.decorations = builder.finish()
        return
      }
    }

    // No slash command active
    activeMenu = null
    slashFrom = -1
    this.decorations = Decoration.none
  }

  destroy() {
    activeMenu = null
    slashFrom = -1
  }
}, {
  decorations: v => v.decorations
})

const slashCommandKeymap = keymap.of([
  {
    key: 'Escape',
    run(view) {
      if (activeMenu) {
        activeMenu = null
        slashFrom = -1
        view.dispatch({ changes: [] })
        return true
      }
      return false
    }
  },
  {
    key: 'ArrowDown',
    run(view) {
      if (activeMenu) {
        activeMenu.selectNext()
        return true
      }
      return false
    }
  },
  {
    key: 'ArrowUp',
    run(view) {
      if (activeMenu) {
        activeMenu.selectPrev()
        return true
      }
      return false
    }
  },
  {
    key: 'Enter',
    run(view) {
      if (activeMenu) {
        const pos = view.state.selection.main.head
        // Delete the slash and query text first
        view.dispatch({
          changes: { from: slashFrom, to: pos, insert: '' }
        })
        // Update context positions after deletion
        const ctx = activeMenu['context'] || {
          view,
          from: slashFrom,
          to: slashFrom,
          selectedText: view.state.sliceDoc(
            view.state.selection.main.from,
            view.state.selection.main.to
          ),
          services: { ai: aiService, fileSystem, knowledgeIndex, rag: ragService }
        }
        activeMenu.confirm()
        activeMenu = null
        slashFrom = -1
        return true
      }
      return false
    }
  }
])

export const slashCommandExtension = Prec.highest([
  slashCommandPlugin,
  slashCommandKeymap
])
```

**注意**：`Enter` 键处理中需要先删除 `/query` 文本再执行命令。`activeMenu` 的 `context` 需要在 confirm 前更新 `from`/`to` 为删除后的位置。实现时需在 `SlashCommandMenuWidget` 中暴露 context 或在 Plugin 中直接管理。

- [ ] **Step 2: 修正 — 在 SlashCommandMenuWidget 中暴露 context**

在 `SlashCommandMenuWidget.ts` 中将 `private context` 改为 `readonly context`（或添加 getter），以便 Plugin 的 Enter 处理中访问。

- [ ] **Step 3: 验证类型检查**

Run: `cd /Users/tianyi/code/ai-native-markdown && npx vue-tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/extensions/slash-command/slashCommandPlugin.ts
git commit -m "feat: add SlashCommandPlugin with keymap and command triggering"
```

---

### Task 7: 斜杠命令样式

**Files:**
- Create: `src/extensions/slash-command/styles.css`

- [ ] **Step 1: 创建样式文件**

```css
/* src/extensions/slash-command/styles.css */
.slash-command-menu {
  position: absolute;
  z-index: 100;
  background: var(--color-bg-elevated, #1e1e2e);
  border: 1px solid var(--color-border, #45475a);
  border-radius: 8px;
  padding: 4px 0;
  min-width: 280px;
  max-height: 320px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
}

.slash-command-category {
  padding: 6px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted, #6c7086);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.slash-command-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--color-text, #cdd6f4);
  transition: background 0.1s;
}

.slash-command-item:hover,
.slash-command-item.selected {
  background: var(--color-bg-hover, #313244);
}

.slash-command-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--color-text-muted, #6c7086);
}

.slash-command-item.selected .slash-command-icon {
  color: var(--color-accent, #89b4fa);
}

.slash-command-label {
  flex-shrink: 0;
  font-weight: 500;
}

.slash-command-desc {
  color: var(--color-text-muted, #6c7086);
  font-size: 12px;
  margin-left: auto;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/slash-command/styles.css
git commit -m "feat: add slash command menu styles"
```

---

### Task 8: 接入 Editor.vue

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: 在 Editor.vue 中导入斜杠命令扩展**

在 Editor.vue 的 `<script setup>` 中：

1. 添加 import：
```ts
import { slashCommandExtension } from '@/extensions/slash-command/slashCommandPlugin'
import '@/extensions/slash-command/styles.css'
```

2. 在 `createExtensions()` 函数中，将 `slashCommandExtension` 添加到扩展列表中（与其他 AI 扩展并列）。

- [ ] **Step 2: 验证开发服务器启动**

Run: `cd /Users/tianyi/code/ai-native-markdown && npx vite --port 1420 &`

在浏览器中打开编辑器，输入 `/` 应弹出命令菜单。

- [ ] **Step 3: Commit**

```bash
git add src/components/Editor.vue
git commit -m "feat: integrate slash command extension into Editor"
```

---

### Task 9: 斜杠命令 E2E 测试

**Files:**
- Create: `e2e/slash-commands.spec.ts`

- [ ] **Step 1: 创建 E2E 测试**

```ts
// e2e/slash-commands.spec.ts
import { test, expect } from '@playwright/test'
import { resetBrowserState, loadDemoWorkspace, openFirstMarkdownFile, setEditorContent } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page)
  await loadDemoWorkspace(page)
  await openFirstMarkdownFile(page)
})

test('slash command menu appears on / input', async ({ page }) => {
  await setEditorContent(page, '')
  const editor = page.locator('.cm-editor')
  await editor.click()
  await editor.press('/')
  await expect(page.locator('.slash-command-menu')).toBeVisible({ timeout: 3000 })
})

test('slash command menu filters by typing', async ({ page }) => {
  await setEditorContent(page, '')
  const editor = page.locator('.cm-editor')
  await editor.click()
  await editor.press('/')
  await editor.pressSequentially('heading')
  await expect(page.locator('.slash-command-item')).toHaveCount(3) // h1, h2, h3
})

test('slash command inserts heading', async ({ page }) => {
  await setEditorContent(page, '')
  const editor = page.locator('.cm-editor')
  await editor.click()
  await editor.press('/')
  await editor.pressSequentially('h1')
  await editor.press('Enter')
  const content = await page.evaluate(async () => {
    const { fileSystem } = await import('/src/services/fileSystem.ts')
    return fileSystem.readFile('/workspace/notes/Research Map.md')
  })
  expect(content).toContain('# ')
})

test('slash command inserts date', async ({ page }) => {
  await setEditorContent(page, '')
  const editor = page.locator('.cm-editor')
  await editor.click()
  await editor.press('/')
  await editor.pressSequentially('date')
  await editor.press('Enter')
  const today = new Date().toISOString().split('T')[0]
  const content = await page.evaluate(async () => {
    const { fileSystem } = await import('/src/services/fileSystem.ts')
    return fileSystem.readFile('/workspace/notes/Research Map.md')
  })
  expect(content).toContain(today)
})

test('slash command escapes on Escape key', async ({ page }) => {
  await setEditorContent(page, '')
  const editor = page.locator('.cm-editor')
  await editor.click()
  await editor.press('/')
  await expect(page.locator('.slash-command-menu')).toBeVisible({ timeout: 3000 })
  await editor.press('Escape')
  await expect(page.locator('.slash-command-menu')).not.toBeVisible()
})
```

- [ ] **Step 2: 运行测试验证**

Run: `cd /Users/tianyi/code/ai-native-markdown && npx playwright test e2e/slash-commands.spec.ts 2>&1`

- [ ] **Step 3: Commit**

```bash
git add e2e/slash-commands.spec.ts
git commit -m "test: add e2e tests for slash commands"
```

---

## 阶段 2：块嵌入系统

### 文件结构

```
src/
├── utils/
│   └── markdown/
│       └── embedPlugin.ts              # MarkdownIt embed 插件（新建）
├── services/
│   ├── embedResolver.ts                # 嵌入解析器（新建）
│   └── embedSyncService.ts             # 嵌入同步服务（新建）
├── extensions/
│   └── embed/
│       └── embedWidget.ts              # 编辑器嵌入 Widget（新建）
├── components/
│   └── Preview.vue                     # 修改：渲染嵌入内容
├── utils/
│   └── security.ts                     # 修改：白名单添加 embed 标签
e2e/
└── embed.spec.ts                       # E2E 测试（新建）
```

---

### Task 10: MarkdownIt embed 插件

**Files:**
- Create: `src/utils/markdown/embedPlugin.ts`

- [ ] **Step 1: 创建 embed 插件**

```ts
// src/utils/markdown/embedPlugin.ts
import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'

export function embedPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('wiki_link', 'embed', (state, silent) => {
    const start = state.pos
    const max = state.posMax

    // Check for ![[ prefix
    if (start + 2 >= max) return false
    if (state.src.charCodeAt(start) !== 0x21 /* ! */) return false
    if (state.src.charCodeAt(start + 1) !== 0x5B /* [ */) return false
    if (state.src.charCodeAt(start + 2) !== 0x5B /* [ */) return false

    let pos = start + 3
    let depth = 1

    while (pos < max && depth > 0) {
      const ch = state.src.charCodeAt(pos)
      if (ch === 0x5B /* [ */) {
        if (state.src.charCodeAt(pos + 1) === 0x5B) depth++
      } else if (ch === 0x5D /* ] */) {
        if (pos + 1 < max && state.src.charCodeAt(pos + 1) === 0x5D) {
          depth--
          if (depth === 0) break
          pos++ // skip second ]
        }
      }
      pos++
    }

    if (depth !== 0) return false
    if (pos + 1 >= max) return false

    const content = state.src.slice(start + 3, pos)
    const endPos = pos + 2 // skip ]]

    if (silent) return true

    // Parse target and optional heading
    let target = content
    let heading: string | undefined

    const hashIdx = content.indexOf('#')
    if (hashIdx !== -1) {
      target = content.slice(0, hashIdx)
      heading = content.slice(hashIdx + 1)
    }

    const token = state.push('embed', 'div', 0)
    token.attrSet('class', 'embed')
    token.attrSet('data-target', target)
    if (heading) token.attrSet('data-heading', heading)
    token.content = content

    state.pos = endPos
    return true
  })

  md.renderer.rules.embed = (tokens, idx) => {
    const token = tokens[idx]
    const target = token.attrGet('data-target') || ''
    const heading = token.attrGet('data-heading')
    const headingAttr = heading ? ` data-heading="${md.utils.escapeHtml(heading)}"` : ''
    return `<div class="embed" data-target="${md.utils.escapeHtml(target)}"${headingAttr}></div>`
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/markdown/embedPlugin.ts
git commit -m "feat: add MarkdownIt embed plugin for ![[...]] syntax"
```

---

### Task 11: EmbedResolver

**Files:**
- Create: `src/services/embedResolver.ts`

- [ ] **Step 1: 创建 EmbedResolver**

```ts
// src/services/embedResolver.ts
import { fileSystem } from './fileSystem'
import { createMarkdownRenderer } from '@/utils/exportHtml'
import type MarkdownIt from 'markdown-it'

export interface EmbedResult {
  type: 'note' | 'image' | 'not-found'
  filePath?: string
  content?: string
  rawContent?: string
  heading?: string
  sourceLine?: number
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']

let mdInstance: MarkdownIt | null = null

function getMarkdownRenderer(): MarkdownIt {
  if (!mdInstance) {
    mdInstance = createMarkdownRenderer([])
  }
  return mdInstance
}

function isImagePath(target: string): boolean {
  const lower = target.toLowerCase()
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

function extractSection(content: string, heading: string): { text: string; line: number } | null {
  const lines = content.split('\n')
  let startLine = -1
  let startLevel = -1
  let endLine = lines.length

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const title = match[2].trim()

      if (title === heading && startLine === -1) {
        startLine = i
        startLevel = level
        continue
      }

      if (startLine !== -1 && level <= startLevel) {
        endLine = i
        break
      }
    }
  }

  if (startLine === -1) return null
  return {
    text: lines.slice(startLine, endLine).join('\n'),
    line: startLine + 1
  }
}

export async function resolveEmbed(target: string, heading?: string, depth = 0): Promise<EmbedResult> {
  if (depth > 3) {
    return { type: 'not-found' }
  }

  // Image embed
  if (isImagePath(target)) {
    const filePath = target.startsWith('/') ? target : `/workspace/${target}`
    try {
      const content = await fileSystem.readFile(filePath)
      if (content instanceof ArrayBuffer) {
        const base64 = btoa(
          new Uint8Array(content).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const ext = target.split('.').pop()?.toLowerCase() || 'png'
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp'
        }
        const mime = mimeMap[ext] || 'image/png'
        return {
          type: 'image',
          filePath,
          content: `data:${mime};base64,${base64}`
        }
      }
    } catch {
      return { type: 'not-found' }
    }
  }

  // Note embed
  const filePath = target.startsWith('/') ? target : `/workspace/${target}`
  const mdPath = filePath.endsWith('.md') ? filePath : `${filePath}.md`

  try {
    const rawContent = await fileSystem.readFileOrEmpty(mdPath)
    if (!rawContent) {
      return { type: 'not-found' }
    }

    if (heading) {
      const section = extractSection(rawContent, heading)
      if (!section) return { type: 'not-found' }

      const md = getMarkdownRenderer()
      const rendered = md.render(section.text)
      return {
        type: 'note',
        filePath: mdPath,
        content: rendered,
        rawContent: section.text,
        heading,
        sourceLine: section.line
      }
    }

    const md = getMarkdownRenderer()
    const rendered = md.render(rawContent)
    return {
      type: 'note',
      filePath: mdPath,
      content: rendered,
      rawContent
    }
  } catch {
    return { type: 'not-found' }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/embedResolver.ts
git commit -m "feat: add EmbedResolver for resolving ![[...]] targets"
```

---

### Task 12: EmbedSyncService

**Files:**
- Create: `src/services/embedSyncService.ts`

- [ ] **Step 1: 创建 EmbedSyncService**

```ts
// src/services/embedSyncService.ts
import type { EditorView } from '@codemirror/view'

export interface EmbedRef {
  view: EditorView
  pos: number
  targetPath: string
}

type ChangeCallback = (changedPath: string) => void

class EmbedSyncServiceImpl {
  private refs = new Map<string, Set<EmbedRef>>()
  private pendingChanges = new Set<string>()
  private rafId: number | null = null
  private changeCallbacks: ChangeCallback[] = []

  registerRef(ref: EmbedRef): void {
    if (!this.refs.has(ref.targetPath)) {
      this.refs.set(ref.targetPath, new Set())
    }
    this.refs.get(ref.targetPath)!.add(ref)
  }

  unregisterRef(ref: EmbedRef): void {
    const set = this.refs.get(ref.targetPath)
    if (set) {
      set.delete(ref)
      if (set.size === 0) this.refs.delete(ref.targetPath)
    }
  }

  notifyChange(changedPath: string): void {
    this.pendingChanges.add(changedPath)
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.flushChanges()
        this.rafId = null
      })
    }
  }

  onDidChange(cb: ChangeCallback): () => void {
    this.changeCallbacks.push(cb)
    return () => {
      this.changeCallbacks = this.changeCallbacks.filter(c => c !== cb)
    }
  }

  getRefsForPath(path: string): EmbedRef[] {
    return [...(this.refs.get(path) || [])]
  }

  private flushChanges(): void {
    for (const path of this.pendingChanges) {
      for (const cb of this.changeCallbacks) {
        cb(path)
      }
    }
    this.pendingChanges.clear()
  }

  clear(): void {
    this.refs.clear()
    this.pendingChanges.clear()
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}

export const embedSyncService = new EmbedSyncServiceImpl()
```

- [ ] **Step 2: Commit**

```bash
git add src/services/embedSyncService.ts
git commit -m "feat: add EmbedSyncService for real-time embed synchronization"
```

---

### Task 13: EmbedWidget

**Files:**
- Create: `src/extensions/embed/embedWidget.ts`

- [ ] **Step 1: 创建 EmbedWidget**

```ts
// src/extensions/embed/embedWidget.ts
import { WidgetType } from '@codemirror/view'
import { resolveEmbed, type EmbedResult } from '@/services/embedResolver'

export class EmbedWidget extends WidgetType {
  private result: EmbedResult | null = null
  private container: HTMLElement | null = null
  private destroyed = false

  constructor(
    private target: string,
    private heading?: string,
    private onNavigate?: (path: string, line?: number) => void
  ) {
    super()
  }

  toDOM(): HTMLElement {
    this.container = document.createElement('div')
    this.container.className = 'embed-widget'
    this.container.innerHTML = '<div class="embed-loading">加载中...</div>'
    this.loadContent()
    return this.container
  }

  private async loadContent(): Promise<void> {
    if (this.destroyed) return

    this.result = await resolveEmbed(this.target, this.heading)
    if (this.destroyed || !this.container) return

    this.render()
  }

  private render(): void {
    if (!this.container || !this.result) return
    this.container.innerHTML = ''

    if (this.result.type === 'not-found') {
      this.container.className = 'embed-widget embed-not-found'
      this.container.innerHTML = `
        <div class="embed-header">
          <span class="embed-path">${this.target}</span>
        </div>
        <div class="embed-error">未找到: ${this.target}</div>
      `
      return
    }

    if (this.result.type === 'image') {
      this.container.className = 'embed-widget embed-image'
      this.container.innerHTML = `
        <div class="embed-header">
          <span class="embed-path">${this.target}</span>
          <button class="embed-navigate" title="跳转">↗</button>
        </div>
        <img src="${this.result.content}" alt="${this.target}" />
      `
    } else {
      this.container.className = 'embed-widget embed-note'
      const headerText = this.heading
        ? `${this.target} > ${this.heading}`
        : this.target
      this.container.innerHTML = `
        <div class="embed-header">
          <span class="embed-path">${headerText}</span>
          <button class="embed-navigate" title="跳转到源文件">↗</button>
        </div>
        <div class="embed-content">${this.result.content || ''}</div>
      `
    }

    const navBtn = this.container.querySelector('.embed-navigate')
    if (navBtn && this.result.filePath) {
      navBtn.addEventListener('click', () => {
        this.onNavigate?.(this.result!.filePath!, this.result?.sourceLine)
      })
    }
  }

  eq(other: EmbedWidget): boolean {
    return other.target === this.target && other.heading === this.heading
  }

  ignoreEvent(): boolean {
    return false
  }

  destroy(): void {
    this.destroyed = true
    this.container = null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/embed/embedWidget.ts
git commit -m "feat: add EmbedWidget for rendering embedded content in editor"
```

---

### Task 14: 安全白名单更新

**Files:**
- Modify: `src/utils/security.ts`

- [ ] **Step 1: 在 sanitizeMarkdown 白名单中添加 embed 相关属性**

在 `security.ts` 的 DOMPurify 配置中：
1. 添加 `div` 的 `embed` class 到允许的 class 列表
2. 添加 `data-target` 和 `data-heading` 到 `ALLOWED_ATTR`

- [ ] **Step 2: Commit**

```bash
git add src/utils/security.ts
git commit -m "feat: add embed attributes to DOMPurify whitelist"
```

---

### Task 15: Preview.vue 渲染嵌入内容

**Files:**
- Modify: `src/components/Preview.vue`

- [ ] **Step 1: 在 Preview.vue 中使用 embedPlugin**

1. 导入 `embedPlugin`：
```ts
import { embedPlugin } from '@/utils/markdown/embedPlugin'
```

2. 在 MarkdownIt 初始化后注册插件：
```ts
md.use(embedPlugin)
```

3. 添加嵌入内容的异步渲染逻辑：在渲染后查找 `.embed` 占位元素，调用 `resolveEmbed()` 替换为实际内容。

- [ ] **Step 2: Commit**

```bash
git add src/components/Preview.vue
git commit -m "feat: render embedded content in Preview with embedPlugin"
```

---

### Task 16: Wiki Link 补全扩展支持 ![[ 前缀

**Files:**
- Modify: `src/composables/useWikiLinkCompletion.ts`

- [ ] **Step 1: 扩展 Wiki Link 补全支持嵌入模式**

在 `useWikiLinkCompletion.ts` 中：
1. 检测 `![[` 前缀（除 `[[` 外）
2. 嵌入模式下，选中后补全为 `![[target]]`
3. 图片文件也纳入补全列表

- [ ] **Step 2: Commit**

```bash
git add src/composables/useWikiLinkCompletion.ts
git commit -m "feat: extend wiki link completion to support ![[ embed prefix"
```

---

### Task 17: 块嵌入 E2E 测试

**Files:**
- Create: `e2e/embed.spec.ts`

- [ ] **Step 1: 创建 E2E 测试**

```ts
// e2e/embed.spec.ts
import { test, expect } from '@playwright/test'
import { resetBrowserState, loadDemoWorkspace, openFirstMarkdownFile, setEditorContent } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page)
  await loadDemoWorkspace(page)
  await openFirstMarkdownFile(page)
})

test('embed syntax is parsed in preview', async ({ page }) => {
  await setEditorContent(page, '![[README]]')
  const preview = page.locator('.preview-content')
  await expect(preview.locator('.embed[data-target="README"]')).toBeVisible({ timeout: 5000 })
})

test('embed with heading is parsed', async ({ page }) => {
  await setEditorContent(page, '![[README#Introduction]]')
  const preview = page.locator('.preview-content')
  await expect(preview.locator('.embed[data-target="README"][data-heading="Introduction"]')).toBeVisible({ timeout: 5000 })
})

test('embed not-found shows error', async ({ page }) => {
  await setEditorContent(page, '![[nonexistent]]')
  const preview = page.locator('.preview-content')
  await expect(preview.locator('.embed-not-found')).toBeVisible({ timeout: 5000 })
})

test('wiki link completion supports ![[ prefix', async ({ page }) => {
  await setEditorContent(page, '')
  const editor = page.locator('.cm-editor')
  await editor.click()
  await editor.pressSequentially('![[')
  await expect(page.locator('.wiki-link-completion')).toBeVisible({ timeout: 3000 })
})
```

- [ ] **Step 2: 运行测试验证**

Run: `cd /Users/tianyi/code/ai-native-markdown && npx playwright test e2e/embed.spec.ts 2>&1`

- [ ] **Step 3: Commit**

```bash
git add e2e/embed.spec.ts
git commit -m "test: add e2e tests for block embed"
```

---

## 阶段 3：AI Agent 工作流

### 文件结构

```
src/
├── services/
│   └── agent/
│       ├── types.ts                    # Agent 类型定义（新建）
│       ├── toolRegistry.ts             # 工具注册表（新建）
│       ├── contextBuilder.ts           # 上下文构建器（新建）
│       ├── agentController.ts          # Agent 控制器（新建）
│       └── tools/
│           ├── searchNotes.ts          # 全文搜索工具（新建）
│           ├── readNote.ts             # 读取笔记工具（新建）
│           ├── writeNote.ts            # 写入笔记工具（新建）
│           ├── listNotes.ts            # 列出笔记工具（新建）
│           ├── getBacklinks.ts         # 获取反链工具（新建）
│           ├── getMentions.ts          # 获取提及工具（新建）
│           ├── getTags.ts              # 获取标签工具（新建）
│           ├── batchUpdate.ts          # 批量更新工具（新建）
│           └── renameNote.ts           # 重命名工具（新建）
├── components/
│   └── ai-panel/
│       └── ChatPanel.vue               # 修改：添加 Agent 模式切换
e2e/
└── agent.spec.ts                       # E2E 测试（新建）
```

---

### Task 18: Agent 类型定义

**Files:**
- Create: `src/services/agent/types.ts`

- [ ] **Step 1: 创建类型定义**

```ts
// src/services/agent/types.ts
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  description: string
  required?: boolean
  enum?: string[]
}

export interface AgentTool {
  name: string
  description: string
  parameters: ToolParameter[]
  riskLevel: 'low' | 'high'
  execute: (params: Record<string, unknown>) => Promise<ToolResult>
}

export interface ToolResult {
  success: boolean
  data?: unknown
  display?: string
  error?: string
}

export interface ToolCallRecord {
  tool: string
  params: Record<string, unknown>
  result: ToolResult
  timestamp: number
}

export interface AgentContext {
  currentFile: {
    path: string
    content: string
    frontmatter?: Record<string, unknown>
    tags: string[]
  } | null
  backlinks: Array<{ path: string; context: string }>
  mentions: Array<{ path: string; context: string }>
  recentFiles: string[]
  ragContext?: string
}

export interface AgentOptions {
  context?: AgentContext
  tools?: string[]
  onToolCall?: (tool: string, params: unknown) => void
  onProgress?: (message: string) => void
  onConfirm?: (tool: string, params: Record<string, unknown>) => Promise<boolean>
  signal?: AbortSignal
}

export interface AgentResult {
  success: boolean
  message: string
  toolCalls: ToolCallRecord[]
  filesModified: string[]
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: ToolCallDef[]
}

export interface ToolCallDef {
  id: string
  name: string
  arguments: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/agent/types.ts
git commit -m "feat: add Agent type definitions"
```

---

### Task 19: 工具注册表

**Files:**
- Create: `src/services/agent/toolRegistry.ts`

- [ ] **Step 1: 创建工具注册表**

```ts
// src/services/agent/toolRegistry.ts
import type { AgentTool } from './types'

class ToolRegistryImpl {
  private tools = new Map<string, AgentTool>()

  register(tool: AgentTool): () => void {
    this.tools.set(tool.name, tool)
    return () => this.tools.delete(tool.name)
  }

  unregister(name: string): void {
    this.tools.delete(name)
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  getAll(toolNames?: string[]): AgentTool[] {
    const all = [...this.tools.values()]
    if (toolNames) return all.filter(t => toolNames.includes(t.name))
    return all
  }

  toOpenAITools(toolNames?: string[]): object[] {
    return this.getAll(toolNames).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            tool.parameters.map(p => [p.name, {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {})
            }])
          ),
          required: tool.parameters.filter(p => p.required).map(p => p.name)
        }
      }
    }))
  }
}

export const toolRegistry = new ToolRegistryImpl()
```

- [ ] **Step 2: Commit**

```bash
git add src/services/agent/toolRegistry.ts
git commit -m "feat: add Agent tool registry with OpenAI format conversion"
```

---

### Task 20: 内置工具实现（9 个工具）

**Files:**
- Create: `src/services/agent/tools/searchNotes.ts`
- Create: `src/services/agent/tools/readNote.ts`
- Create: `src/services/agent/tools/writeNote.ts`
- Create: `src/services/agent/tools/listNotes.ts`
- Create: `src/services/agent/tools/getBacklinks.ts`
- Create: `src/services/agent/tools/getMentions.ts`
- Create: `src/services/agent/tools/getTags.ts`
- Create: `src/services/agent/tools/batchUpdate.ts`
- Create: `src/services/agent/tools/renameNote.ts`

- [ ] **Step 1: 创建 searchNotes**

```ts
// src/services/agent/tools/searchNotes.ts
import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const searchNotesTool: AgentTool = {
  name: 'search_notes',
  description: '全文搜索笔记内容，返回匹配的文件路径和上下文片段',
  parameters: [
    { name: 'query', type: 'string', description: '搜索关键词', required: true },
    { name: 'limit', type: 'number', description: '返回结果数量上限，默认5' }
  ],
  riskLevel: 'low',
  execute: async (params): Promise<ToolResult> => {
    try {
      const query = String(params.query)
      const limit = Number(params.limit) || 5
      const results = await fileSystem.searchFiles(query, limit)
      return {
        success: true,
        data: results,
        display: results.map(r => `${r.path}: ${r.match}`).join('\n')
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 2: 创建 readNote**

```ts
// src/services/agent/tools/readNote.ts
import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const readNoteTool: AgentTool = {
  name: 'read_note',
  description: '读取指定笔记的完整内容',
  parameters: [
    { name: 'path', type: 'string', description: '笔记文件路径', required: true }
  ],
  riskLevel: 'low',
  execute: async (params): Promise<ToolResult> => {
    try {
      const path = String(params.path)
      const content = await fileSystem.readFileOrEmpty(path)
      if (!content) {
        return { success: false, error: `文件不存在: ${path}` }
      }
      return {
        success: true,
        data: { path, content },
        display: content.slice(0, 500) + (content.length > 500 ? '...' : '')
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 3: 创建 writeNote**

```ts
// src/services/agent/tools/writeNote.ts
import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const writeNoteTool: AgentTool = {
  name: 'write_note',
  description: '创建或覆盖笔记文件。高风险操作，需要用户确认。',
  parameters: [
    { name: 'path', type: 'string', description: '笔记文件路径', required: true },
    { name: 'content', type: 'string', description: '文件内容', required: true }
  ],
  riskLevel: 'high',
  execute: async (params): Promise<ToolResult> => {
    try {
      const path = String(params.path)
      const content = String(params.content)
      await fileSystem.writeFile(path, content)
      return {
        success: true,
        data: { path, size: content.length },
        display: `已写入 ${path} (${content.length} 字符)`
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 4: 创建 listNotes**

```ts
// src/services/agent/tools/listNotes.ts
import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const listNotesTool: AgentTool = {
  name: 'list_notes',
  description: '列出指定目录下的所有笔记文件',
  parameters: [
    { name: 'directory', type: 'string', description: '目录路径，默认为根目录' }
  ],
  riskLevel: 'low',
  execute: async (params): Promise<ToolResult> => {
    try {
      const dir = String(params.directory || '/workspace')
      const entries = await fileSystem.readDirectory(dir)
      const files = entries.filter(e => !e.isDirectory && e.name.endsWith('.md'))
      return {
        success: true,
        data: files.map(f => f.path),
        display: files.map(f => f.path).join('\n') || '(空目录)'
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 5: 创建 getBacklinks**

```ts
// src/services/agent/tools/getBacklinks.ts
import type { AgentTool, ToolResult } from '../types'
import { knowledgeIndex } from '@/services/knowledgeIndex'

export const getBacklinksTool: AgentTool = {
  name: 'get_backlinks',
  description: '获取指向指定笔记的所有反向链接',
  parameters: [
    { name: 'path', type: 'string', description: '笔记文件路径', required: true }
  ],
  riskLevel: 'low',
  execute: async (params): Promise<ToolResult> => {
    try {
      const path = String(params.path)
      const backlinks = await knowledgeIndex.getBacklinks(path)
      return {
        success: true,
        data: backlinks,
        display: backlinks.map(b => `${b.sourcePath}: ${b.context}`).join('\n') || '(无反链)'
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 6: 创建 getMentions**

```ts
// src/services/agent/tools/getMentions.ts
import type { AgentTool, ToolResult } from '../types'
import { knowledgeIndex } from '@/services/knowledgeIndex'

export const getMentionsTool: AgentTool = {
  name: 'get_mentions',
  description: '获取文本中提及指定笔记但未链接的位置',
  parameters: [
    { name: 'path', type: 'string', description: '笔记文件路径', required: true }
  ],
  riskLevel: 'low',
  execute: async (params): Promise<ToolResult> => {
    try {
      const path = String(params.path)
      const mentions = await knowledgeIndex.getUnlinkedMentions(path)
      return {
        success: true,
        data: mentions,
        display: mentions.map(m => `${m.sourcePath}: ${m.context}`).join('\n') || '(无提及)'
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 7: 创建 getTags**

```ts
// src/services/agent/tools/getTags.ts
import type { AgentTool, ToolResult } from '../types'
import { knowledgeIndex } from '@/services/knowledgeIndex'

export const getTagsTool: AgentTool = {
  name: 'get_tags',
  description: '获取所有标签及其关联的笔记，或查询指定标签的关联笔记',
  parameters: [
    { name: 'tag', type: 'string', description: '可选，指定标签名查询关联笔记' }
  ],
  riskLevel: 'low',
  execute: async (params): Promise<ToolResult> => {
    try {
      const tag = params.tag ? String(params.tag) : undefined
      const records = await knowledgeIndex.getAllRecords()
      if (tag) {
        const matching = records.filter(r => r.tags?.includes(tag))
        return {
          success: true,
          data: matching.map(r => r.filePath),
          display: matching.map(r => r.filePath).join('\n') || `(无笔记使用标签 ${tag})`
        }
      }
      const tagMap: Record<string, string[]> = {}
      for (const r of records) {
        for (const t of (r.tags || [])) {
          if (!tagMap[t]) tagMap[t] = []
          tagMap[t].push(r.filePath)
        }
      }
      return {
        success: true,
        data: tagMap,
        display: Object.entries(tagMap).map(([t, paths]) => `${t}: ${paths.length} 篇`).join('\n')
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 8: 创建 batchUpdate**

```ts
// src/services/agent/tools/batchUpdate.ts
import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const batchUpdateTool: AgentTool = {
  name: 'batch_update',
  description: '批量更新多个笔记文件。高风险操作，需要用户确认。每个操作可指定查找替换或全文替换。',
  parameters: [
    {
      name: 'operations',
      type: 'array',
      description: '更新操作列表，每项包含 path 和 content（全文替换）或 path、find、replace（查找替换）',
      required: true
    }
  ],
  riskLevel: 'high',
  execute: async (params): Promise<ToolResult> => {
    try {
      const operations = params.operations as Array<{
        path: string
        content?: string
        find?: string
        replace?: string
      }>

      if (operations.length > 10) {
        return { success: false, error: '单次批量操作不能超过 10 个文件' }
      }

      const results: string[] = []
      for (const op of operations) {
        if (op.content !== undefined) {
          await fileSystem.writeFile(op.path, op.content)
          results.push(`${op.path}: 已覆盖`)
        } else if (op.find && op.replace !== undefined) {
          const content = await fileSystem.readFileOrEmpty(op.path)
          const newContent = content.replaceAll(op.find, op.replace)
          await fileSystem.writeFile(op.path, newContent)
          results.push(`${op.path}: 已替换 "${op.find}" → "${op.replace}"`)
        } else {
          results.push(`${op.path}: 无效操作`)
        }
      }

      return {
        success: true,
        data: results,
        display: results.join('\n')
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 9: 创建 renameNote**

```ts
// src/services/agent/tools/renameNote.ts
import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const renameNoteTool: AgentTool = {
  name: 'rename_note',
  description: '重命名笔记并自动更新所有引用该笔记的 Wiki Link。高风险操作，需要用户确认。',
  parameters: [
    { name: 'oldPath', type: 'string', description: '原文件路径', required: true },
    { name: 'newPath', type: 'string', description: '新文件路径', required: true }
  ],
  riskLevel: 'high',
  execute: async (params): Promise<ToolResult> => {
    try {
      const oldPath = String(params.oldPath)
      const newPath = String(params.newPath)
      await fileSystem.renameFile(oldPath, newPath)
      return {
        success: true,
        data: { oldPath, newPath },
        display: `已重命名 ${oldPath} → ${newPath}（已更新所有引用）`
      }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 10: 注册所有工具**

创建 `src/services/agent/tools/index.ts`：

```ts
// src/services/agent/tools/index.ts
import { toolRegistry } from '../toolRegistry'
import { searchNotesTool } from './searchNotes'
import { readNoteTool } from './readNote'
import { writeNoteTool } from './writeNote'
import { listNotesTool } from './listNotes'
import { getBacklinksTool } from './getBacklinks'
import { getMentionsTool } from './getMentions'
import { getTagsTool } from './getTags'
import { batchUpdateTool } from './batchUpdate'
import { renameNoteTool } from './renameNote'

const allTools = [
  searchNotesTool,
  readNoteTool,
  writeNoteTool,
  listNotesTool,
  getBacklinksTool,
  getMentionsTool,
  getTagsTool,
  batchUpdateTool,
  renameNoteTool
]

for (const tool of allTools) {
  toolRegistry.register(tool)
}

export { allTools }
```

- [ ] **Step 11: Commit**

```bash
git add src/services/agent/tools/
git commit -m "feat: add all 9 Agent tools with registry"
```

---

### Task 21: 上下文构建器

**Files:**
- Create: `src/services/agent/contextBuilder.ts`

- [ ] **Step 1: 创建上下文构建器**

```ts
// src/services/agent/contextBuilder.ts
import type { AgentContext } from './types'
import { fileSystem } from '@/services/fileSystem'
import { knowledgeIndex } from '@/services/knowledgeIndex'
import { ragService } from '@/services/rag'

export async function buildAgentContext(
  currentPath: string | undefined,
  userMessage: string
): Promise<AgentContext> {
  const context: AgentContext = {
    currentFile: null,
    backlinks: [],
    mentions: [],
    recentFiles: []
  }

  if (currentPath) {
    try {
      const content = await fileSystem.readFileOrEmpty(currentPath)
      if (content) {
        const record = await knowledgeIndex.getRecord(currentPath)
        context.currentFile = {
          path: currentPath,
          content,
          frontmatter: record?.frontmatter as Record<string, unknown> | undefined,
          tags: record?.tags || []
        }
      }

      const backlinks = await knowledgeIndex.getBacklinks(currentPath)
      context.backlinks = backlinks.slice(0, 5).map(b => ({
        path: b.sourcePath,
        context: b.context
      }))

      const mentions = await knowledgeIndex.getUnlinkedMentions(currentPath)
      context.mentions = mentions.slice(0, 5).map(m => ({
        path: m.sourcePath,
        context: m.context
      }))
    } catch {
      // Context building failure is non-fatal
    }
  }

  // RAG context
  try {
    const ragContext = await ragService.buildContext(userMessage, 3000)
    if (ragContext) {
      context.ragContext = ragContext
    }
  } catch {
    // RAG failure is non-fatal
  }

  return context
}

export function contextToSystemPrompt(context: AgentContext): string {
  const parts: string[] = []

  if (context.currentFile) {
    parts.push(`当前文件: ${context.currentFile.path}`)
    if (context.currentFile.tags.length > 0) {
      parts.push(`标签: ${context.currentFile.tags.join(', ')}`)
    }
    parts.push(`文件内容摘要: ${context.currentFile.content.slice(0, 300)}...`)
  }

  if (context.backlinks.length > 0) {
    parts.push('反向链接:')
    context.backlinks.forEach(b => parts.push(`  - ${b.path}: ${b.context}`))
  }

  if (context.mentions.length > 0) {
    parts.push('提及:')
    context.mentions.forEach(m => parts.push(`  - ${m.path}: ${m.context}`))
  }

  if (context.ragContext) {
    parts.push(`相关知识: ${context.ragContext}`)
  }

  return parts.join('\n')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/agent/contextBuilder.ts
git commit -m "feat: add Agent context builder with knowledge graph integration"
```

---

### Task 22: AgentController

**Files:**
- Create: `src/services/agent/agentController.ts`

- [ ] **Step 1: 创建 AgentController**

```ts
// src/services/agent/agentController.ts
import type { AgentOptions, AgentResult, ChatMessage, ToolCallDef, ToolCallRecord, ToolResult } from './types'
import { toolRegistry } from './toolRegistry'
import { buildAgentContext, contextToSystemPrompt } from './contextBuilder'
import { aiService } from '@/services/ai'
import '@/services/agent/tools'

const MAX_ITERATIONS = 10
const MAX_FILES_MODIFIED = 10

export class AgentController {
  async execute(
    task: string,
    currentPath?: string,
    options?: AgentOptions
  ): Promise<AgentResult> {
    const signal = options?.signal
    const toolCalls: ToolCallRecord[] = []
    const filesModified: string[] = []

    // Build context
    const context = options?.context || await buildAgentContext(currentPath, task)
    const systemPrompt = this.buildSystemPrompt(contextToSystemPrompt(context))

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task }
    ]

    const provider = aiService.getActiveProvider()
    if (!provider) {
      return {
        success: false,
        message: '未配置 AI 服务，请先在设置中配置 AI 提供者。',
        toolCalls,
        filesModified
      }
    }

    const availableTools = toolRegistry.getAll(options?.tools)

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (signal?.aborted) {
        return { success: false, message: '操作已取消', toolCalls, filesModified }
      }

      options?.onProgress?.(`思考中... (第 ${i + 1} 步)`)

      try {
        const response = await this.callLLM(provider, messages, availableTools, signal)
        messages.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls })

        if (!response.toolCalls || response.toolCalls.length === 0) {
          return {
            success: true,
            message: response.content,
            toolCalls,
            filesModified
          }
        }

        // Process tool calls
        for (const tc of response.toolCalls) {
          if (signal?.aborted) break

          const tool = toolRegistry.get(tc.name)
          if (!tool) continue

          let params: Record<string, unknown>
          try {
            params = JSON.parse(tc.arguments)
          } catch {
            params = {}
          }

          // High-risk tool confirmation
          if (tool.riskLevel === 'high' && options?.onConfirm) {
            const confirmed = await options.onConfirm(tc.name, params)
            if (!confirmed) {
              messages.push({
                role: 'tool',
                content: '用户拒绝了此操作',
                toolCallId: tc.id
              })
              continue
            }
          }

          // Check file modification limit
          if (['write_note', 'batch_update', 'rename_note'].includes(tc.name)) {
            if (filesModified.length >= MAX_FILES_MODIFIED) {
              messages.push({
                role: 'tool',
                content: '已达到单次操作最大文件修改数 (10)，请分批操作。',
                toolCallId: tc.id
              })
              continue
            }
          }

          options?.onToolCall?.(tc.name, params)
          options?.onProgress?.(`执行工具: ${tc.name}`)

          const result = await tool.execute(params)
          toolCalls.push({ tool: tc.name, params, result, timestamp: Date.now() })

          // Track modified files
          if (result.success && ['write_note', 'batch_update', 'rename_note'].includes(tc.name)) {
            if (tc.name === 'batch_update') {
              const ops = params.operations as Array<{ path: string }>
              filesModified.push(...ops.map(o => o.path))
            } else if (tc.name === 'rename_note') {
              filesModified.push(String(params.newPath))
            } else {
              filesModified.push(String(params.path))
            }
          }

          messages.push({
            role: 'tool',
            content: result.display || (result.success ? '操作成功' : `错误: ${result.error}`),
            toolCallId: tc.id
          })
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          return { success: false, message: '操作已取消', toolCalls, filesModified }
        }
        return {
          success: false,
          message: `Agent 执行出错: ${(e as Error).message}`,
          toolCalls,
          filesModified
        }
      }
    }

    return {
      success: false,
      message: '达到最大迭代次数，任务可能未完成。',
      toolCalls,
      filesModified
    }
  }

  private buildSystemPrompt(contextInfo: string): string {
    return `你是一个知识管理助手，可以帮助用户搜索、阅读、创建和修改笔记。

当前上下文:
${contextInfo}

你可以使用工具来完成任务。请根据用户的需求选择合适的工具。如果需要修改文件，请先确认操作内容。

重要规则:
- 修改文件前先读取确认当前内容
- 批量操作时逐个确认
- 保持 Markdown 格式规范
- 不要删除用户未要求删除的内容`
  }

  private async callLLM(
    provider: ReturnType<typeof aiService.getActiveProvider>,
    messages: ChatMessage[],
    tools: ReturnType<typeof toolRegistry.getAll>,
    signal?: AbortSignal
  ): Promise<{ content: string; toolCalls?: ToolCallDef[] }> {
    // Try function calling first (OpenAI-compatible)
    const openaiTools = toolRegistry.toOpenAITools(tools.map(t => t.name))

    const apiMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      ...(m.toolCalls ? { tool_calls: m.toolCalls } : {})
    }))

    try {
      const response = await fetch(`${provider!.getConfig().baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider!.getConfig().apiKey}`
        },
        body: JSON.stringify({
          model: provider!.getConfig().model,
          messages: apiMessages,
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          stream: false
        }),
        signal
      })

      const data = await response.json()
      const choice = data.choices?.[0]
      if (!choice) throw new Error('LLM 返回空响应')

      const content = choice.message?.content || ''
      const toolCalls = choice.message?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments
      }))

      return { content, toolCalls }
    } catch (e) {
      // Fallback: use streamChat without function calling
      if ((e as Error).name === 'AbortError') throw e

      let content = ''
      for await (const chunk of provider!.streamChat(
        messages.map(m => ({ role: m.role, content: m.content })),
        { signal }
      )) {
        content += chunk
      }
      return { content }
    }
  }
}

export const agentController = new AgentController()
```

- [ ] **Step 2: 验证类型检查**

Run: `cd /Users/tianyi/code/ai-native-markdown && npx vue-tsc --noEmit 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/services/agent/agentController.ts
git commit -m "feat: add AgentController with tool calling loop"
```

---

### Task 23: 斜杠命令中添加 Agent 命令

**Files:**
- Modify: `src/extensions/slash-command/commands/aiCommands.ts`

- [ ] **Step 1: 添加 `/agent` 斜杠命令**

在 `aiCommands.ts` 中追加：

```ts
{
  id: 'ai-agent',
  label: 'AI Agent',
  description: '启动 AI Agent 执行复杂任务',
  icon: 'bot',
  category: 'ai',
  keywords: ['agent', '代理', '助手', '任务', '批量'],
  priority: 11,
  requireSelection: false,
  execute: async (ctx) => {
    // 获取 /agent 后面的文本作为任务描述
    const taskText = ctx.selectedText || ''
    if (!taskText.trim()) {
      // 如果没有任务描述，插入提示
      const { view, from, to } = ctx
      view.dispatch({
        changes: { from, to, insert: '/agent ' },
        selection: { anchor: from + 7 }
      })
      return
    }

    // 触发 Agent 执行（通过事件通知 ChatPanel 或直接执行）
    const event = new CustomEvent('agent:execute', {
      detail: { task: taskText }
    })
    window.dispatchEvent(event)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/slash-command/commands/aiCommands.ts
git commit -m "feat: add /agent slash command"
```

---

### Task 24: ChatPanel Agent 模式

**Files:**
- Modify: `src/components/ai-panel/ChatPanel.vue`

- [ ] **Step 1: 在 ChatPanel 中添加 Agent 模式切换**

1. 添加模式切换按钮（普通聊天 / Agent 模式）
2. Agent 模式下使用 `agentController.execute()` 替代普通 `streamChat()`
3. 显示工具调用过程和结果
4. 高风险操作弹出确认对话框

具体实现根据 ChatPanel.vue 现有结构调整。

- [ ] **Step 2: Commit**

```bash
git add src/components/ai-panel/ChatPanel.vue
git commit -m "feat: add Agent mode to ChatPanel with tool calling UI"
```

---

### Task 25: Agent E2E 测试

**Files:**
- Create: `e2e/agent.spec.ts`

- [ ] **Step 1: 创建 E2E 测试**

```ts
// e2e/agent.spec.ts
import { test, expect } from '@playwright/test'
import { resetBrowserState, loadDemoWorkspace, openFirstMarkdownFile } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page)
  await loadDemoWorkspace(page)
  await openFirstMarkdownFile(page)
})

test('agent tool registry has all tools', async ({ page }) => {
  const toolNames = await page.evaluate(async () => {
    const { toolRegistry } = await import('/src/services/agent/toolRegistry.ts')
    await import('/src/services/agent/tools/index.ts')
    return toolRegistry.getAll().map(t => t.name)
  })
  expect(toolNames).toContain('search_notes')
  expect(toolNames).toContain('read_note')
  expect(toolNames).toContain('write_note')
  expect(toolNames).toContain('list_notes')
  expect(toolNames).toContain('get_backlinks')
  expect(toolNames).toContain('batch_update')
  expect(toolNames).toContain('rename_note')
})

test('agent read_note tool works', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { toolRegistry } = await import('/src/services/agent/toolRegistry.ts')
    await import('/src/services/agent/tools/index.ts')
    const tool = toolRegistry.get('read_note')!
    return tool.execute({ path: '/workspace/README.md' })
  })
  expect(result.success).toBe(true)
  expect(result.data.content).toContain('AI Native')
})

test('agent list_notes tool works', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { toolRegistry } = await import('/src/services/agent/toolRegistry.ts')
    await import('/src/services/agent/tools/index.ts')
    const tool = toolRegistry.get('list_notes')!
    return tool.execute({ directory: '/workspace' })
  })
  expect(result.success).toBe(true)
  expect(result.data.length).toBeGreaterThan(0)
})

test('agent search_notes tool works', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { toolRegistry } = await import('/src/services/agent/toolRegistry.ts')
    await import('/src/services/agent/tools/index.ts')
    const tool = toolRegistry.get('search_notes')!
    return tool.execute({ query: 'AI', limit: 3 })
  })
  expect(result.success).toBe(true)
})

test('slash command includes agent command', async ({ page }) => {
  const commands = await page.evaluate(async () => {
    const { commandRegistry } = await import('/src/services/commandRegistry.ts')
    await import('/src/extensions/slash-command/commands/blockCommands.ts')
    await import('/src/extensions/slash-command/commands/aiCommands.ts')
    await import('/src/extensions/slash-command/commands/insertCommands.ts')
    return commandRegistry.getFiltered('agent').map(c => c.id)
  })
  expect(commands).toContain('ai-agent')
})
```

- [ ] **Step 2: 运行测试验证**

Run: `cd /Users/tianyi/code/ai-native-markdown && npx playwright test e2e/agent.spec.ts 2>&1`

- [ ] **Step 3: Commit**

```bash
git add e2e/agent.spec.ts
git commit -m "test: add e2e tests for AI Agent tools and integration"
```

---

### Task 26: 全量测试验证

- [ ] **Step 1: 运行全量 E2E 测试**

Run: `cd /Users/tianyi/code/ai-native-markdown && npx playwright test 2>&1`

- [ ] **Step 2: 运行类型检查**

Run: `cd /Users/tianyi/code/ai-native-markdown && npx vue-tsc --noEmit 2>&1`

- [ ] **Step 3: 修复任何问题**

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete P0 implementation - slash commands, block embed, AI Agent"
```
