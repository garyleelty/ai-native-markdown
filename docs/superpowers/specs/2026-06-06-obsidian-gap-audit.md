# Obsidian 对标缺点评估

日期：2026-06-06

## 结论

当前项目已经具备一个 AI 原生 Markdown 工作台的雏形：Vue/Vite/Electron、CodeMirror、真实文件系统 Vault、IndexedDB 演示工作区、Wiki Link、块嵌入、媒体附件嵌入、迁移校验、附件库存报告、缺失笔记/标题/块占位修复、知识图谱、RAG、AI 聊天、Ghost Text、Inline Edit、多模态输入、导出、版本历史和较完整的 E2E 测试。

但如果目标是“比 Obsidian 更好”，当前短板不在单点功能数量，而在核心平台能力：

1. Obsidian 的底层优势是普通文件夹 Vault、长期可迁移性、插件生态、跨设备、Canvas、Properties/Bases 和社区扩展。
2. 本项目当前最可能超过 Obsidian 的方向不是复刻，而是成为“AI 原生、本地优先、可执行知识工作台”。
3. 在此方向下，最关键的 P0 不是继续增加散点功能，而是把已落地的真实 Vault 和块嵌入继续打磨到平台级，同时补齐语义 RAG、Agent 工作流和扩展 API。

## 已验证状态

本次审计基于当前工作树完成：

- `npm run typecheck` 通过。
- `npm run build` 通过。
- `npx playwright test` 通过，164 个测试全绿。
- 当前存在未提交改动，主要集中在真实 Vault、外部文件监听与基础冲突提示、块引用、slash command、embed service、Live Preview embed widget、嵌入依赖同步、媒体附件嵌入、迁移校验、附件库存报告、缺失笔记/标题/块占位修复和文档更新上。

## 关键优势

### AI 默认内置

README 中列出的 AI 对话、续写、润色、摘要、内联编辑、Ghost Text 和 RAG 检索是强差异点。Obsidian 通常依赖插件或第三方工作流实现这些能力。

### 多模态输入开箱可用

图片 OCR、PDF 文字提取、语音输入、智能粘贴等能力已经进入主工作流。这是一个正确方向：资料进入知识库的成本越低，越容易形成产品粘性。

### 测试覆盖明显优于普通早期项目

164 个 Playwright 测试覆盖了文件、编辑器、Wiki Link、块嵌入、`^block-id` 块引用、嵌入依赖同步、媒体附件嵌入、迁移校验、附件库存报告、缺失笔记/标题/块占位修复、知识图谱、导出、安全、AI、多模态、移动端、slash command、真实 Vault fallback、外部文件变更刷新、基础冲突提示和真实 Vault 会话恢复。基础质量不是主要风险。

## 主要缺点

### P0-1：真实 Vault 已落地，但原生文件体验仍弱于 Obsidian

当前桌面端已经通过 Electron 主进程 bridge 持续绑定真实文件夹 Vault；浏览器/演示环境保留 IndexedDB fallback。外部文件变更监听已经接入，能刷新文件树、知识索引和未修改的打开标签。已修改标签遇到同文件磁盘变更时会出现冲突提示，可重新载入磁盘版本或保留本地版本。这个方向已经解决了“只有虚拟工作区”的最大信任问题。

影响：

- 还缺最近原生 Vault 列表、批量同步冲突处理和合并策略。
- 外部同步工具、Git、Finder 写入后的基础刷新和单文件冲突提示已经有了，但批量变更、删除冲突和边界场景还没有 Obsidian 成熟。
- OS keychain、CLI、插件和备份策略仍需要围绕真实 Vault 补齐。

建议：

- 增加原生 Vault recent list，并保留 IndexedDB 作为 demo/workspace fallback。
- 扩展 watcher 语义，覆盖批量重命名、删除、同步工具临时文件和大库变更节流。
- 增加 diff/merge 级冲突处理：打开文档未保存时，外部文件被修改需要能查看差异再决定。

### P0-2：块引用、嵌入同步、媒体附件和迁移校验已进入主路径，但迁移修复还不完整

当前存在：

- `src/utils/markdown/embedPlugin.ts`
- `src/services/embedResolver.ts`
- `src/services/embedSyncService.ts`
- `src/services/embedRenderer.ts`
- `src/extensions/embed/embedWidget.ts`

Preview、HTML export 和 Live Preview editor widget 已经接入 `![[...]]` 块嵌入，支持整篇笔记、目标标题片段、当前文件标题片段、`^block-id` 块引用、图片附件、音频、视频和 PDF。块引用也进入了跳转和 Wiki Link 补全路径。嵌入渲染现在会记录源文件依赖；被嵌入源文件或媒体资产外部变更后，受影响宿主的 Preview 和 Live Preview widget 会自动刷新。真实 Vault 媒体通过 `vaultService.readAsset()` 以 data URL 渲染，避免二进制资产被当作 UTF-8 文本读取。命令面板中的“迁移校验”现在会扫描缺失笔记、缺失标题、缺失 `^block-id` 块引用、缺失图片/音频/视频/PDF 附件、未引用附件和不支持附件格式，并跳过 fenced code block 中的 Wiki Link。报告行可以打开来源文件并定位到原始行；缺失笔记问题可以批量创建占位 Markdown 文档；缺失标题和缺失块引用可以在目标笔记末尾批量追加占位内容，创建后报告会自动刷新。

影响：

- Obsidian 批量迁移还缺 guided import、附件搬迁/重命名修复、别名边界处理和大库性能预算。
- Vault 资产管理还缺专门的附件浏览、超大媒体统计和可确认的修复报告。

建议：

- 将迁移修复继续扩展到附件和别名：按问题类型生成可预览 diff，用户确认后批量改链接或搬附件。
- 增加附件资产治理：列出超大媒体、重复附件和可迁移目标。

### P0-3：AI 还只是助手，不是可执行 Agent

当前 AI 命令主要是摘要、翻译、润色、扩写、大纲、续写。它们能提升写作效率，但还没有形成“比 Obsidian 更好”的核心能力。

缺口：

- 没有跨笔记任务计划。
- 没有工具调用审计。
- 没有修改预览和确认。
- 没有批量操作回滚。
- 没有基于反链、标签、frontmatter、RAG 的统一上下文构建。

建议：

- Agent 的第一版只做低风险工具：read/search/list/get_backlinks。
- 写操作必须 dry-run，显示 diff，用户确认后执行。
- 所有 Agent 写操作进入版本历史，支持一键回滚。

### P0-4：RAG 还不是语义检索

当前 RAG 是 chunk 切分加词面打分。它支持中文 token 和路径/标题加权，但没有 embedding、向量索引、语义召回或 rerank。

影响：

- 搜索质量难以稳定超过 Obsidian 插件生态中的 AI/RAG 插件。
- AI 回答容易依赖当前文档或浅层关键词。
- 大库规模增长后召回质量和性能都不稳定。

建议：

- 引入本地 embedding provider 配置。
- 建立文档、段落、标题、frontmatter、反链的混合索引。
- 实现 lexical + vector + graph-neighborhood 的混合召回。

### P1-1：架构职责过度集中

当前大文件：

- `src/App.vue` 约 944 行。
- `src/components/Editor.vue` 约 818 行。
- `src/components/sidebar/FileExplorer.vue` 约 742 行。

影响：

- 新功能容易继续往根组件和编辑器组件里堆。
- 文件、命令、AI、WikiLink、移动端、session、拖拽、布局状态混在一起。
- 后续做插件 API 或 Agent 时，依赖边界会不清晰。

建议：

- 抽出 workspace service、navigation service、command action layer。
- 将 command palette 和 slash command 共享统一 command model。
- 将 editor extension 注册集中到独立 composition root。

### P1-2：文档与真实架构不一致

`README.md` 说 Electron + IndexedDB，`PROJECT_DOCS.md` 仍然写 Tauri、本地文件系统和 `src-tauri`。`docs/usability-test-report.md` 也保留了大量旧 Tauri 语境和已修复问题。

影响：

- 新贡献者会误判技术栈。
- 产品路线会被旧文档干扰。
- “缺点清单”会混入已经修复或已经废弃的问题。

建议：

- 将旧 Tauri 文档标记为 archived 或迁移到 history。
- README、PROJECT_DOCS、release hardening、当前路线图保持同一事实源。
- 增加 `docs/current-architecture.md`。

### P1-3：安全存储不足

API key 使用 Web Crypto 加密，但 key material 和 salt 都硬编码在前端。它避免明文显示，但不是系统级 secret storage。

影响：

- 对云端 API key 用户，信任等级不足。
- Electron 打包后仍可被逆向恢复。

建议：

- 使用 Electron 主进程集成 OS keychain。
- 前端只接收 provider id 和连接状态。
- 导出/日志/错误消息中永不包含 key。

### P1-4：性能预算还没建立

生产构建已通过，但 chunk 较大：

- `element-plus` 约 1,035 KB。
- `codemirror` 约 609 KB。
- `index` 约 569 KB。
- `markdown` 约 536 KB。
- `mermaid` 约 559 KB。

建议：

- 增加 bundle budget。
- 默认延迟加载 AI 配置、图谱、PDF/OCR、Mermaid、模板、导出。
- 给启动时间、首次编辑器可交互时间、打开 1k/10k notes 的索引时间设门槛。

### P2-1：缺少 Obsidian 生态级能力

README 中列为未来愿景的同步、插件与主题市场、数据库视图、Canvas、移动端，正是 Obsidian 的核心护城河。

建议：

- 不要一次做全。
- 先做可执行知识工作台最依赖的能力：真实 Vault、块嵌入、Properties/Bases-lite、Agent。
- 插件系统先从内部 command/renderer/provider extension points 开始，不急于市场。

## 推荐路线

### 阶段 1：先补平台底座

目标：让用户信任这个应用能长期承载真实知识库。

- 真实文件系统 Vault polish。
- 文档事实源统一。
- API key 系统存储。
- Obsidian 迁移修复闭环。
- 性能预算和启动指标。

### 阶段 2：建立 AI 原生护城河

目标：让产品不是“带 AI 的 Markdown 编辑器”，而是能执行知识工作的 Agent。

- 语义 RAG。
- Graph-aware context builder。
- Agent dry-run + diff + confirm。
- 批量跨笔记整理、摘要、链接建议、孤立笔记处理。
- 所有写操作进版本历史。

### 阶段 3：补 Obsidian 关键体验

目标：减少用户迁移阻力。

- Properties/Bases-lite。
- Canvas 或 whiteboard-lite。
- 插件 API v0。
- 主题 token 和自定义 CSS。
- 同步策略：先兼容外部文件夹同步，再考虑自有 sync。

## 不建议的路线

### 不建议直接复制 Obsidian

Obsidian 的生态和社区不是短期能复制的。直接复刻会落入“功能永远少一点”的竞争。

### 不建议继续散点加功能

如果继续加零散按钮、模板、面板，短期 demo 会更丰富，但核心差距不会缩小。

### 不建议过早做插件市场

没有稳定 extension points、权限模型、打包规范和 API 文档时，插件市场会放大维护负担。

## 下一步问题

需要先选择主攻方向：

1. 真实 Vault polish + 冲突处理。
2. AI Agent 工作流。
3. Obsidian 迁移体验。

推荐优先级是 1 -> 3 -> 2。理由是文件主权决定用户是否敢把长期知识库放进来；迁移校验和修复决定 Obsidian 用户迁移成本；Agent 则是最终超过 Obsidian 的差异化。
