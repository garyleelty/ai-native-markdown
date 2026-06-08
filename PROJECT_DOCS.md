# AI Native Markdown Editor

> 一个 AI 原生的本地优先 Markdown 知识工作台，基于 Electron + Vue 3 + CodeMirror 6 构建。

---

## 功能特性

### 核心功能

1. **三种编辑模式**
   - 源码模式：纯 Markdown 文本编辑，Obsidian 风格语法高亮
   - 实时预览模式：编辑器内嵌渲染，任务列表可直接勾选
   - 阅读模式：只读渲染视图

2. **AI 辅助写作**
   - AI 聊天面板（底部可折叠，支持流式输出）
   - 支持本地 Ollama 模型和 OpenAI-compatible 云端 API
   - 快捷操作：续写、润色、摘要、修正语法、展开、压缩
   - Agent 模式：AI 可调用工具（创建/读取/写入/搜索笔记等）
   - Ghost Text 智能补全
   - Inline Edit 内联编辑（选中文本后 AI 重写建议）
   - AI Action Menu 编辑器内快捷操作菜单
   - RAG 增强上下文（基于本地文档检索）

3. **文件管理**
   - 本地文件系统集成（Electron 原生文件夹读写）
   - 浏览器内置虚拟文件系统（Dexie/IndexedDB 备选）
   - 文件树浏览、新建/重命名/删除
   - 文件名搜索和全局内容搜索（支持正则表达式 `/pattern/`）
   - 标签页多文档编辑
   - 版本历史
   - 拖放导入 Markdown 文件

4. **知识图谱**
   - 自动构建文档间知识关联（Wiki Link、反链、未链接提及）
   - D3 力导向可视化图谱（全局/当前笔记视图）
   - 图谱搜索与节点跳转
   - 反向链接面板
   - 未链接提及检测与一键链接
   - 知识索引自动刷新

5. **属性面板**
   - YAML Frontmatter 属性编辑
   - 自动推断属性类型（文本、数字、布尔、日期、标签、URL 等）
   - 类型偏好记忆
   - 与编辑器内容实时同步

6. **命令面板**
   - `Cmd/Ctrl + P` 快速打开
   - 文件快速打开、搜索入口、侧边栏切换、视图操作等

7. **RSS 订阅**
   - 内置 RSS 阅读器
   - 文章导入为 Markdown 笔记

### 增强特性

- **实时预览**：Mermaid 图表、KaTeX 数学公式、任务列表、Wiki Link
- **`![[...]]` 嵌入**：笔记、标题段落、`^block-id`、图片/音频/视频/PDF 附件
- **智能粘贴**：自动识别并格式化粘贴内容
- **多模态支持**：图片拖拽、OCR 识别（Tesseract.js）、PDF 拖入
- **语音输入**：语音转文字
- **Slash 命令**：编辑器内 `/` 触发快捷插入
- **导出功能**：Markdown、HTML（含样式/目录选项）、纯文本
- **主题切换**：深色/浅色/跟随系统
- **专注模式**：全屏沉浸写作
- **写作目标**：字数目标设置与进度追踪
- **写作会话**：自动记录写作时长
- **每日笔记**：一键创建/打开今日笔记
- **迁移审计**：检测未解析的 Wiki Link、缺失笔记、附件问题等
- **状态栏**：字数统计、保存状态、视图模式、AI 状态
- **响应式布局**：窄屏自动切换为移动端抽屉式侧边栏

---

## UI 设计

### 整体布局

采用经典的三栏式布局，可灵活调整：

```
┌─────────────────────────────────────────────────────────────┐
│  标题栏 (Header)                                              │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│  侧边栏       │          主编辑区域                        │
│  (Sidebar)    │                                             │
│               │                                             │
│  - 文件管理   │                                             │
│  - 知识图谱   │                                             │
│  - RSS 订阅   │                                             │
│  - AI 配置    │                                             │
│  - 设置       │                                             │
│  - 属性面板   │                                             │
│  - 文档大纲   │                                             │
│               │                                             │
├───────────────┴─────────────────────────────────────────────┤
│  AI 面板 (可折叠)                                             │
├─────────────────────────────────────────────────────────────┤
│  状态栏 (Status Bar)                                         │
└─────────────────────────────────────────────────────────────┘
```

### 详细组件设计

#### 1. 标题栏 (Header)
- **左侧**：侧边栏开关按钮 + 应用品牌标识
- **中间**：当前打开文件名
- **右侧**：
  - AI 面板开关
  - 视图模式切换（源码/实时预览/阅读）
  - 版本历史
  - 导出菜单（导出对话框 / Markdown 语法速查）
  - 专注模式
  - 主题切换按钮

#### 2. 侧边栏 (Sidebar)
左侧侧边栏包含七个标签页：

**文件管理**
- 工作区选择（打开本地文件夹 / 试用示例工作区）
- 搜索框（支持文件名搜索和全局内容搜索切换，支持正则表达式）
- 文件树（支持展开/折叠、新建文件/文件夹、重命名、删除）
- 最近打开文件

**知识图谱**
- 索引统计（笔记数、链接数、孤立数）
- 属性标签页：当前文件 Frontmatter、Tags、Outgoing Links
- 反链标签页：反向链接列表
- 提及标签页：未链接提及（支持一键链接）
- 图谱标签页：D3 力导向可视化，全局/当前笔记视图切换，搜索过滤

**RSS 订阅**
- RSS 源管理
- 文章列表与导入

**AI 配置**
- 提供商选择：Ollama / OpenAI-compatible
- 服务地址配置
- API Key 输入（AES-GCM 加密存储）
- 模型选择
- 温度参数调节
- RAG 开关
- AI Actions 开关
- 智能粘贴开关
- Ghost Text 配置
- Inline Edit 开关
- 连接测试按钮

**设置**
- 主题切换（深色/浅色/跟随系统）
- AI 助手开关

**属性面板**
- YAML Frontmatter 属性编辑器
- 自动推断属性类型
- 添加/删除/修改属性
- 类型偏好记忆

**文档大纲**
- 当前文件标题层级导航
- 点击跳转到对应行

#### 3. 主编辑区域
- **标签页栏**：显示所有打开的文档标签，支持关闭
- **编辑器**：
  - CodeMirror 6 编辑器
  - Obsidian 风格 Markdown 语法高亮
  - 工具栏（粗体、斜体、删除线、标题、代码、引用、列表、链接、图片、实时预览切换、自动换行、语音输入、智能补全）
  - 查找替换
  - Slash 命令菜单
  - Wiki Link 自动补全
  - 标签自动补全（`#` 触发）
- **AI 面板**（底部，可折叠，可调整高度）：
  - 聊天对话窗口
  - 快捷操作按钮（续写、润色、摘要等）
  - Agent 模式切换
  - RAG 来源引用与预览
  - 语音输入
  - 对话历史持久化

#### 4. 状态栏 (Status Bar)
- Markdown 标识
- 保存状态提示
- 视图模式指示（可点击切换）
- 字数/字符统计
- 写作时长
- AI 连接状态
- 写作目标

### 设计系统

采用 Obsidian 风格设计系统，CSS 变量驱动主题切换。

#### 颜色方案
- **主色调**：紫色系 (`var(--obsidian-accent)`)
- **背景色**：
  - 主背景 `var(--obsidian-bg-primary)`
  - 次背景 `var(--obsidian-bg-secondary)`
  - 悬停 `var(--obsidian-bg-hover)`
- **文字色**：
  - 正常 `var(--obsidian-text-normal)`
  - 次要 `var(--obsidian-text-muted)`
  - 微弱 `var(--obsidian-text-faint)`
- **边框色**：`var(--obsidian-border)`

#### 字体
- **无衬线**：`var(--font-sans)` - UI 文本
- **等宽**：`var(--font-mono)` - 编辑器和代码
- 字号范围：10px - 15px

---

## 技术栈

### 前端
- **框架**：Vue 3 (Composition API)
- **类型系统**：TypeScript
- **构建工具**：Vite
- **状态管理**：Pinia
- **UI 组件库**：Element Plus
- **编辑器**：CodeMirror 6
- **Markdown 解析**：markdown-it
- **数学公式**：KaTeX
- **图表**：mermaid、d3.js
- **OCR**：Tesseract.js
- **PDF**：pdf.js

### 桌面端
- **框架**：Electron
- **构建打包**：electron-builder
- **文件系统**：Node.js `fs/promises`（主进程）
- **安全桥接**：preload.js 暴露 `window.aiNativeVault` API
- **文件监听**：Electron 主进程监听 Vault 变更，通知渲染进程

### 数据持久化
- **文件存储**：Electron 原生文件系统 / Dexie IndexedDB（浏览器备选）
- **知识索引**：Dexie `ai-markdown-knowledge-index`
- **RAG 数据**：Dexie `ai-markdown-rag`
- **版本历史**：Dexie
- **UI 设置**：localStorage（通过 `safeStorage`）
- **API Key**：AES-GCM 加密存储（Web Crypto API）

### AI 服务
- **本地**：Ollama
- **云端**：OpenAI-compatible API
- **流式输出**：SSE (Server-Sent Events)
- **Agent**：内置工具（创建/读取/写入/搜索/删除/移动笔记等）

---

## 项目结构

```
ai-native-markdown/
├── electron/                    # Electron 主进程
│   ├── main.js                  # 主进程入口
│   ├── preload.js               # 安全桥接
│   ├── vaultHandlers.js         # 文件系统操作
│   └── menu.js                  # 应用菜单
├── src/
│   ├── components/
│   │   ├── ai-panel/            # AI 聊天面板
│   │   │   ├── ChatPanel.vue    # 对话主组件
│   │   │   └── QuickActions.vue # 快捷操作
│   │   ├── editor/              # 编辑器相关组件
│   │   │   ├── OutlinePanel.vue # 文档大纲
│   │   │   ├── FindReplace.vue  # 查找替换
│   │   │   ├── FocusMode.vue    # 专注模式
│   │   │   ├── VersionHistoryPanel.vue
│   │   │   ├── DocumentStats.vue
│   │   │   ├── WritingGoal.vue
│   │   │   └── StatusBar.vue
│   │   ├── knowledge/           # 知识图谱组件
│   │   │   ├── KnowledgeGraph.vue
│   │   │   ├── WikiLink.vue
│   │   │   └── TagBadge.vue
│   │   ├── preview/             # 预览组件
│   │   ├── properties/          # 属性编辑器
│   │   │   └── PropertyEditor.vue
│   │   ├── sidebar/             # 侧边栏面板
│   │   │   ├── FileExplorer.vue
│   │   │   ├── KnowledgePanel.vue
│   │   │   ├── PropertiesPanel.vue
│   │   │   ├── AIConfigPanel.vue
│   │   │   ├── SettingsPanel.vue
│   │   │   ├── RSSPanel.vue
│   │   │   └── ReferenceList.vue
│   │   ├── ui/                  # 通用 UI 组件
│   │   ├── CommandPalette.vue   # 命令面板
│   │   ├── Editor.vue           # 编辑器主组件
│   │   ├── Preview.vue          # 预览主组件
│   │   ├── Sidebar.vue          # 侧边栏主组件
│   │   ├── ExportDialog.vue     # 导出对话框
│   │   ├── WelcomePage.vue      # 欢迎页
│   │   └── TemplateGallery.vue  # 模板库
│   ├── composables/             # Vue 组合式函数
│   │   ├── useAgentChat.ts      # Agent 对话
│   │   ├── useChatStream.ts     # 流式聊天
│   │   ├── useRAG.ts            # RAG 检索
│   │   ├── useKnowledgeGraph.ts # 知识图谱
│   │   ├── useGlobalSearch.ts   # 全局搜索
│   │   ├── useWikiLinkCompletion.ts
│   │   ├── useTagCompletion.ts
│   │   ├── useBacklinks.ts
│   │   ├── useProperties.ts     # 属性面板
│   │   ├── useFileOperations.ts
│   │   ├── useExport.ts
│   │   ├── useFindReplace.ts
│   │   ├── useTheme.ts
│   │   ├── useResponsive.ts
│   │   ├── useVoiceInput.ts
│   │   └── useDebounce.ts
│   ├── extensions/              # CodeMirror 扩展
│   │   ├── ai-actions/          # AI 动作插件
│   │   ├── ghost-text/          # 幽灵文本补全
│   │   ├── inline-edit/         # 内联编辑
│   │   ├── live-preview/        # 实时预览
│   │   ├── multimodal/          # 多模态支持
│   │   ├── slash-command/       # Slash 命令
│   │   ├── smart-paste/         # 智能粘贴
│   │   ├── embed/               # 嵌入装饰
│   │   └── obsidianTheme.ts     # Obsidian 风格主题
│   ├── services/                # 服务层
│   │   ├── ai.ts                # AI 服务
│   │   ├── fileSystem.ts        # 文件系统（IndexedDB）
│   │   ├── knowledgeIndex.ts    # 知识索引
│   │   ├── rag.ts               # RAG 检索
│   │   ├── rss.ts               # RSS 服务
│   │   ├── versionHistory.ts    # 版本历史
│   │   ├── frontmatterService.ts # Frontmatter 解析
│   │   ├── migrationAudit.ts    # 迁移审计
│   │   ├── embedResolver.ts     # 嵌入解析
│   │   ├── embedRenderer.ts     # 嵌入渲染
│   │   ├── embedSyncService.ts  # 嵌入同步
│   │   ├── commandRegistry.ts   # 命令注册
│   │   ├── agent/               # Agent 服务
│   │   │   ├── agentController.ts
│   │   │   ├── contextBuilder.ts
│   │   │   ├── toolRegistry.ts
│   │   │   └── tools/           # Agent 工具集
│   │   └── vault/               # Vault 抽象层
│   │       ├── vaultService.ts
│   │       ├── electronVault.ts
│   │       └── indexedDbVault.ts
│   ├── stores/                  # Pinia 状态管理
│   │   ├── editor.ts            # 编辑器状态
│   │   ├── file.ts              # 文件状态
│   │   └── settings.ts          # 设置状态
│   ├── types/                   # TypeScript 类型定义
│   ├── utils/                   # 工具函数
│   │   ├── security.ts          # 安全（加密、消毒）
│   │   ├── wikiLinks.ts         # Wiki Link 工具
│   │   ├── exportHtml.ts        # HTML 导出
│   │   ├── errorHandler.ts      # 错误处理
│   │   ├── pathHelpers.ts       # 路径工具
│   │   ├── knowledge.ts         # 知识工具
│   │   ├── metadata.ts          # 元数据工具
│   │   ├── notification.ts      # 通知
│   │   ├── performance.ts       # 性能监控
│   │   ├── shortcuts.ts         # 快捷键
│   │   ├── writingSession.ts    # 写作会话
│   │   └── markdown/            # Markdown 插件
│   │       └── embedPlugin.ts
│   ├── styles/
│   │   └── app.css              # 全局样式
│   ├── App.vue                  # 应用根组件
│   └── main.ts                  # 应用入口
├── e2e/                         # Playwright E2E 测试
├── docs/                        # 项目文档
│   ├── current-architecture.md  # 当前架构文档
│   └── superpowers/             # 功能计划与设计文档
├── design-system/               # 设计系统文档
└── package.json
```

---

## 核心模块说明

### AI 服务 (src/services/ai.ts)
- 支持多种 AI 提供商：Ollama、OpenAI-compatible
- 统一的 Provider 接口
- 连接状态管理
- 流式和非流式对话支持
- API Key AES-GCM 加密存储

### Agent 系统 (src/services/agent/)
- `agentController.ts`：Agent 执行控制器
- `contextBuilder.ts`：上下文构建（当前文档、RAG 检索结果）
- `toolRegistry.ts`：工具注册表
- 内置工具：创建/读取/写入/追加/删除/移动/搜索笔记、获取反链/标签等

### RAG 系统 (src/composables/useRAG.ts + src/services/rag.ts)
- 文档分块与索引（Dexie 存储）
- 词汇检索（非语义向量）
- 上下文构建
- 与 AI 对话集成

### 知识索引 (src/services/knowledgeIndex.ts)
- Markdown 文件元数据提取（标题、别名、标签、链接、Frontmatter）
- Wiki Link 规范化与索引
- 反向链接查询
- 未链接提及检测
- 图谱数据生成
- 增量更新与订阅通知

### 编辑器扩展
- **Ghost Text**：AI 智能补全，灰色提示文本
- **Inline Edit**：选中文本后 AI 重写建议（Diff 预览）
- **AI Actions**：编辑器内快捷 AI 操作菜单
- **Live Preview**：实时 Markdown 渲染装饰
- **Smart Paste**：智能格式化粘贴内容
- **Multimodal**：图片拖拽、OCR 识别
- **Slash Command**：`/` 触发快捷命令菜单
- **Embed Widget**：`![[...]]` 嵌入装饰

### Vault 抽象层 (src/services/vault/)
- `vaultService.ts`：统一接口，自动选择后端
- `electronVault.ts`：Electron 原生文件系统（通过 IPC）
- `indexedDbVault.ts`：Dexie IndexedDB 备选后端
- 文件变更监听与通知

### 安全 (src/utils/security.ts)
- API Key 使用 Web Crypto API (AES-GCM + PBKDF2) 加密
- Markdown 渲染使用 DOMPurify 消毒
- `safeStorage` 封装 localStorage 读写
- 安全剪贴板操作

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + S` | 保存文件 |
| `Cmd/Ctrl + B` | 粗体 |
| `Cmd/Ctrl + I` | 斜体 |
| `Cmd/Ctrl + K` | 插入链接 |
| `Cmd/Ctrl + P` | 命令面板 |
| `Cmd/Ctrl + Shift + H` | 版本历史 |
| `Cmd/Ctrl + \` | 专注模式 |
| `F11` | 专注模式 |

---

## 开发验证

```bash
npm run typecheck    # TypeScript 类型检查
npm run build        # 生产构建
npx vitest run       # 单元测试
npx playwright test  # E2E 测试
```
