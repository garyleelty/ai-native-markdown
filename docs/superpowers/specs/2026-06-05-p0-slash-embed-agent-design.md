# P0 功能设计：斜杠命令 + 块嵌入 + AI Agent 工作流

日期：2026-06-05

## 概述

本设计涵盖三个 P0 功能子系统，采用渐进式方案（方案 A）分三阶段交付：

1. **阶段 1 — 斜杠命令**：`/` 触发命令面板，支持 Markdown 语法块、AI 操作、插入类命令
2. **阶段 2 — 块嵌入**：`![[...]]` 语法嵌入笔记/章节/图片，支持实时同步
3. **阶段 3 — AI Agent**：工具调用链 + 上下文感知 + 跨笔记操作 + 批量操作

斜杠命令是统一入口，AI Agent 通过斜杠命令和 Chat Panel 触发，块嵌入可作为 Agent 输出载体。

---

## 阶段 1：斜杠命令系统

### 架构

```
用户输入 / → SlashCommandPlugin (CM6 ViewPlugin)
                ↓
         CommandRegistry.getFiltered(query)
                ↓
         SlashCommandMenu (CM6 Widget)
                ↓
         执行命令 → 插入文本 / 触发 AI / 插入模板
```

### 核心组件

#### 1.1 CommandRegistry (`src/services/commandRegistry.ts`)

单例，管理所有命令的注册、查询和注销。

```ts
interface SlashCommand {
  id: string                          // 'heading-1', 'ai-summarize', 'insert-date'
  label: string                       // 显示名
  description: string                 // 描述
  icon: string                        // 图标名
  category: 'block' | 'ai' | 'insert'
  keywords: string[]                  // 搜索关键词（含中文）
  group?: string                      // 分组名，同组命令折叠显示
  priority?: number                   // 排序权重，数字越大越靠前
  requireSelection?: boolean          // 是否需要选中文本才显示
  execute: (ctx: CommandContext) => void | Promise<void>
}

interface CommandContext {
  view: EditorView
  from: number                        // / 符号的位置
  to: number                          // 光标位置
  selectedText: string                // 选中文本（如有）
  services: {
    ai: AIService
    fileSystem: FileSystemService
    knowledgeIndex: KnowledgeIndexService
    rag: RAGService
  }
}

interface CommandHooks {
  beforeExecute?: (ctx: CommandContext) => boolean | Promise<boolean>
  afterExecute?: (ctx: CommandContext, result?: unknown) => void
}

class CommandRegistry {
  private commands = new Map<string, SlashCommand>()
  private disposers = new Map<string, () => void>()

  register(command: SlashCommand, hooks?: CommandHooks): () => void  // 返回注销函数
  unregister(id: string): void
  getFiltered(query: string, category?: string): SlashCommand[]
  getAll(): SlashCommand[]
}
```

**扩展性设计**：
- `register()` 返回 dispose 函数，方便未来插件系统清理
- `services` 字段为未来插件预留，命令通过 context 访问服务而非直接 import
- `CommandHooks` 支持命令执行前后的拦截和审计
- `requireSelection` 控制命令在无选区时的可见性

#### 1.2 SlashCommandPlugin (`src/extensions/slash-command/slashCommandPlugin.ts`)

CM6 ViewPlugin，监听输入并管理命令菜单生命周期。

- 检测 `/` 开头且位于行首或空格后时弹出菜单
- 输入后续字符时实时过滤命令列表
- 键绑定：`Escape` 关闭，`Enter` 执行，`ArrowUp/Down` 导航
- 执行后删除 `/` 及查询文本，替换为命令输出
- 复用现有 Wiki Link 补全的交互模式（`Prec.highest` 优先级）

#### 1.3 SlashCommandMenuWidget (`src/extensions/slash-command/SlashCommandMenuWidget.ts`)

渲染命令列表的 CM6 Widget。

- 分类标题显示（Markdown 语法块 / AI 操作 / 插入）
- 每项显示图标 + 名称 + 描述
- 最多显示 8 项，支持模糊搜索
- 当前选中项高亮

### 命令清单

#### Markdown 语法块（category: 'block'）

| ID | 标签 | 插入内容 |
|----|------|----------|
| heading-1 | 一级标题 | `# ` |
| heading-2 | 二级标题 | `## ` |
| heading-3 | 三级标题 | `### ` |
| code-block | 代码块 | ` ```\n\n``` ` |
| ordered-list | 有序列表 | `1. ` |
| unordered-list | 无序列表 | `- ` |
| task-list | 任务列表 | `- [ ] ` |
| blockquote | 引用 | `> ` |
| table | 表格 | `| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| | | |` |
| horizontal-rule | 分割线 | `---` |
| callout | 标注 | `> [!note]\n> ` |

#### AI 操作（category: 'ai'）

| ID | 标签 | 行为 |
|----|------|------|
| ai-summarize | AI 摘要 | 选中文本 → AI 生成摘要 |
| ai-translate-zh | AI 译中 | 选中文本 → AI 翻译为中文 |
| ai-translate-en | AI 译英 | 选中文本 → AI 翻译为英文 |
| ai-polish | AI 润色 | 选中文本 → AI 润色 |
| ai-expand | AI 扩写 | 选中文本 → AI 扩写 |
| ai-outline | AI 大纲 | AI 生成当前文档大纲 |
| ai-continue | AI 续写 | AI 续写光标后内容 |

所有 AI 命令 `requireSelection: true`（`ai-outline` 和 `ai-continue` 除外）。

#### 插入类（category: 'insert'）

| ID | 标签 | 插入内容 |
|----|------|----------|
| insert-date | 当前日期 | `YYYY-MM-DD` |
| insert-time | 当前时间 | `HH:mm` |
| insert-timestamp | 日期时间 | `YYYY-MM-DD HH:mm` |
| insert-template | 模板片段 | 从模板列表选择 |

### 与现有系统的关系

- AI 命令复用 `AIService.streamChat()`，与现有 AI Actions 共享执行逻辑
- 斜杠命令触发时，先删除 `/query` 文本，再执行命令
- Wiki Link 补全（`[[`）和斜杠命令（`/`）互不冲突，由不同 Plugin 处理

---

## 阶段 2：块嵌入系统

### 语法

```
![[note]]           → 嵌入整个笔记
![[note#章节名]]     → 嵌入笔记的某个章节
![[image.png]]       → 嵌入图片
```

### 架构

```
编辑器输入 ![[ → Wiki Link 补全（扩展支持 ! 前缀）
                ↓
    MarkdownIt 解析 embed 语法 → 生成 <embed> 占位标签
                ↓
    Preview.vue 渲染时 → EmbedResolver → 内联渲染嵌入内容
                ↓
    编辑器 Live Preview → EmbedWidget 渲染只读预览块
                ↓
    源文件变更 → EmbedSyncService → 重新渲染引用该文件的嵌入块
```

### 核心组件

#### 2.1 MarkdownIt embed 插件 (`src/utils/markdown/embedPlugin.ts`)

解析 `![[target]]` 和 `![[target#heading]]` 语法。

- 在 `md.inline.ruler` 中注册，位于 `wiki_link` 规则之前
- 输出 `<div class="embed" data-target="..." data-heading="..."></div>` 占位标签
- 在 `sanitizeMarkdown` 白名单中添加 `div.embed` 及 `data-target`、`data-heading` 属性

#### 2.2 EmbedResolver (`src/services/embedResolver.ts`)

解析嵌入目标，返回渲染内容。

```ts
interface EmbedResult {
  type: 'note' | 'image' | 'not-found'
  filePath?: string
  content?: string          // 渲染后的 HTML（note）或 base64 URL（image）
  rawContent?: string       // 原始 Markdown（用于编辑器预览）
  heading?: string
  sourceLine?: number       // 源文件行号（用于跳转）
}

async function resolveEmbed(target: string, heading?: string): Promise<EmbedResult>
```

- **图片**：从 `fileSystem.readFile()` 读取，转 base64 data URL
- **笔记**：从 `fileSystem.readFileOrEmpty()` 读取原文，MarkdownIt 渲染
- **章节嵌入**：解析原文，提取目标标题到下一个同级/更高级标题之间的内容
- **不存在**：返回 `type: 'not-found'`

#### 2.3 编辑器 EmbedWidget (`src/extensions/embed/embedWidget.ts`)

CM6 WidgetType，在编辑器 Live Preview 模式下渲染嵌入块。

- 只读渲染，带"跳转到源文件"按钮
- 显示嵌入来源路径
- 源文件不存在时显示红色错误状态
- 点击跳转到源文件对应位置

#### 2.4 EmbedSyncService (`src/services/embedSyncService.ts`)

维护嵌入引用关系，实现实时同步。

```ts
class EmbedSyncService {
  // 文件路径 → 引用该文件的嵌入块集合
  private refs = new Map<string, Set<EmbedRef>>()

  registerRef(sourcePath: string, ref: EmbedRef): void
  unregisterRef(sourcePath: string, ref: EmbedRef): void
  notifyChange(changedPath: string): void  // 触发重新渲染
}
```

- 文件保存时，查找所有引用该文件的嵌入块，触发重新渲染
- 使用 `requestAnimationFrame` 去重，避免频繁更新

### 与现有 Wiki Link 的关系

- Wiki Link 补全扩展：`![[` 也触发补全，选中后自动补全为 `![[target]]`
- 补全触发时判断前缀：`![[` → 嵌入模式，`[[` → 链接模式
- `resolveWikiLinkTarget()` 复用于嵌入目标的存在性检查

### 安全约束

- 嵌入内容经过 `sanitizeMarkdown` 消毒
- 循环检测：禁止嵌入自身，A→B→A 循环时 B 中 A 的嵌入显示为"循环引用"提示
- 嵌入深度限制：最多 3 层嵌套

---

## 阶段 3：AI Agent 工作流

### 架构

```
用户触发（斜杠命令 / Chat Panel / 快捷键）
                ↓
    AgentController → ContextBuilder 构建上下文 → 调用 LLM
                ↓
    LLM 返回 tool_call → AgentToolRegistry 查找工具 → 执行
                ↓
    工具结果 → 反馈给 LLM → 继续推理或返回最终结果
                ↓
    结果呈现（编辑器内联 / Chat Panel / 嵌入块）
```

### 核心组件

#### 3.1 AgentTool 接口 (`src/services/agent/types.ts`)

```ts
interface AgentTool {
  name: string
  description: string                     // LLM 理解的工具描述
  parameters: ToolParameter[]             // JSON Schema 风格参数定义
  execute: (params: Record<string, unknown>) => Promise<ToolResult>
}

interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  description: string
  required?: boolean
  enum?: string[]
}

interface ToolResult {
  success: boolean
  data?: unknown                          // 结构化数据
  display?: string                        // 给用户看的摘要
  error?: string
}
```

#### 3.2 内置工具集 (`src/services/agent/tools/`)

| 工具名 | 功能 | 参数 | 风险 |
|--------|------|------|------|
| `search_notes` | 全文搜索 | `query: string, limit?: number` | 低 |
| `read_note` | 读取笔记内容 | `path: string` | 低 |
| `write_note` | 写入/创建笔记 | `path: string, content: string` | 高 |
| `list_notes` | 列出所有笔记 | `directory?: string` | 低 |
| `get_backlinks` | 获取反链 | `path: string` | 低 |
| `get_mentions` | 获取提及 | `path: string` | 低 |
| `get_tags` | 获取标签及关联笔记 | `tag?: string` | 低 |
| `batch_update` | 批量更新笔记 | `operations: Array<{path, find?, replace?}>` | 高 |
| `rename_note` | 重命名并更新引用 | `oldPath: string, newPath: string` | 高 |

#### 3.3 上下文构建器 (`src/services/agent/contextBuilder.ts`)

```ts
interface AgentContext {
  currentFile: {
    path: string
    content: string
    frontmatter?: Record<string, unknown>
    tags: string[]
  }
  backlinks: Array<{ path: string, context: string }>
  mentions: Array<{ path: string, context: string }>
  recentFiles: string[]
  ragContext?: string
}

async function buildAgentContext(currentPath: string, userMessage: string): Promise<AgentContext>
```

- 自动聚合当前文档的反链、提及、标签
- RAG 检索与用户消息相关的其他笔记片段
- 上下文总量控制在 ~4000 token，超出时按相关性裁剪

#### 3.4 AgentController (`src/services/agent/agentController.ts`)

```ts
class AgentController {
  private toolRegistry: AgentToolRegistry
  private maxIterations = 10

  async execute(task: string, options?: AgentOptions): Promise<AgentResult>
  private async runLoop(messages: ChatMessage[]): Promise<AgentResult>
}

interface AgentOptions {
  context?: AgentContext
  tools?: string[]
  onToolCall?: (tool: string, params: unknown) => void
  onProgress?: (message: string) => void
  signal?: AbortSignal
}

interface AgentResult {
  success: boolean
  message: string
  toolCalls: ToolCallRecord[]
  filesModified: string[]
}
```

#### 3.5 LLM Function Calling 集成

- 将 `AgentTool` 定义转换为 OpenAI function calling 格式
- 支持 Ollama 的 tool calling（`qwen2.5` 系列支持）
- 不支持 function calling 的模型降级为 prompt 模式（system prompt 中描述工具，解析文本输出）

### 触发方式

1. **斜杠命令**：`/agent 整理所有笔记的摘要` → AgentController 执行
2. **Chat Panel**：新增 Agent 模式切换（普通聊天 / Agent 模式）
3. **快捷键**：`Cmd+Shift+K` → 打开 Agent 输入框

### 安全约束

- 高风险工具（`write_note`、`batch_update`、`rename_note`）执行前需用户确认
- 确认 UI 展示操作预览（diff 或摘要）
- 用户可配置"信任列表"跳过确认
- 单次 Agent 执行最多修改 10 个文件
- 所有修改记录到版本历史，支持一键回滚

### 结果呈现

- Chat Panel 中流式显示 Agent 的推理过程和工具调用
- 修改的文件在编辑器中高亮显示变更
- Agent 生成的摘要/大纲可通过斜杠命令插入为嵌入块

---

## 文件结构

```
src/
├── services/
│   ├── commandRegistry.ts              # 命令注册表
│   ├── embedResolver.ts                # 嵌入解析器
│   ├── embedSyncService.ts             # 嵌入同步服务
│   └── agent/
│       ├── types.ts                    # Agent 类型定义
│       ├── agentController.ts          # Agent 控制器
│       ├── contextBuilder.ts           # 上下文构建器
│       ├── toolRegistry.ts             # 工具注册表
│       └── tools/
│           ├── searchNotes.ts
│           ├── readNote.ts
│           ├── writeNote.ts
│           ├── listNotes.ts
│           ├── getBacklinks.ts
│           ├── getMentions.ts
│           ├── getTags.ts
│           ├── batchUpdate.ts
│           └── renameNote.ts
├── extensions/
│   ├── slash-command/
│   │   ├── slashCommandPlugin.ts
│   │   └── SlashCommandMenuWidget.ts
│   └── embed/
│       └── embedWidget.ts
├── utils/
│   └── markdown/
│       └── embedPlugin.ts              # MarkdownIt embed 插件
└── composables/
    └── useSlashCommand.ts              # 斜杠命令 composable（如需）
```

---

## 交付顺序

| 阶段 | 功能 | 依赖 |
|------|------|------|
| 1 | 斜杠命令系统 | 无 |
| 2 | 块嵌入系统 | 阶段 1（嵌入命令通过斜杠触发） |
| 3 | AI Agent 工作流 | 阶段 1（Agent 通过斜杠命令触发），阶段 2（Agent 结果可嵌入） |
