# AI Native Markdown 可用性测试报告

> **项目**: AI Native Markdown — AI 原生 Markdown 桌面编辑器  
> **测试日期**: 2026-05-16  
> **测试方法**: 基于代码审计的专家评估 + 启发式可用性分析  
> **评估标准**: Nielsen 启发式原则 + ISO 9241-11 可用性标准  

---

## 一、项目概览

| 维度 | 详情 |
|------|------|
| 产品定位 | AI 原生的本地优先 Markdown 桌面编辑器 |
| 技术栈 | Vue 3 + Pinia + CodeMirror 6 + Tauri 2 (Rust) |
| 核心功能 | Markdown 编辑、实时预览、AI 辅助写作、文件管理、知识图谱、语音输入 |
| 目标用户 | 技术写作者、知识管理爱好者、Markdown 重度用户 |
| 平台支持 | macOS / Windows / Linux (Tauri 桌面应用) |

---

## 二、测试计划

### 2.1 测试目标

1. 评估核心功能模块的用户体验和操作效率
2. 识别用户界面交互中的可用性问题
3. 评估响应速度和性能对用户体验的影响
4. 检验错误处理机制的完整性和友好性
5. 评估跨平台/跨浏览器兼容性

### 2.2 测试方法

| 方法 | 说明 |
|------|------|
| 专家评估 | 基于 Nielsen 10 项启发式原则进行代码级审查 |
| 认知走查 | 模拟目标用户完成核心任务流程 |
| 启发式分析 | 识别违反可用性原则的设计模式 |
| 性能审计 | 分析构建配置、运行时性能、内存管理 |
| 兼容性审计 | 评估跨平台 API 使用和 CSS 兼容性 |

### 2.3 用户角色定义

| 角色 | 特征 | 占比 |
|------|------|------|
| Markdown 新手 | 了解基本语法，首次使用专业编辑器 | 20% |
| 日常写作者 | 熟悉 Markdown，需要稳定编辑环境 | 40% |
| 知识管理用户 | 使用双链笔记、标签系统组织知识 | 25% |
| AI 辅助用户 | 依赖 AI 进行写作辅助、内容生成 | 15% |

### 2.4 测试场景与任务流程

#### 场景 1：首次启动与工作区设置

| 步骤 | 用户任务 | 预期结果 | 评估指标 |
|------|----------|----------|----------|
| 1.1 | 启动应用 | 显示主界面 | 启动时间 < 3s |
| 1.2 | 打开工作区文件夹 | 侧边栏显示文件树 | 完成率、任务时间 |
| 1.3 | 浏览文件树 | 展开/折叠目录 | 操作直观性评分 |
| 1.4 | 选择并打开 Markdown 文件 | 编辑器显示内容 | 响应时间 < 500ms |

#### 场景 2：Markdown 编辑与格式化

| 步骤 | 用户任务 | 预期结果 | 评估指标 |
|------|----------|----------|----------|
| 2.1 | 使用工具栏插入标题 | 正确插入 H1-H3 | 完成率、错误率 |
| 2.2 | 选中文本应用粗体/斜体 | 正确包裹标记 | 操作步骤数 |
| 2.3 | 插入链接和图片 | 正确插入模板 | 光标定位准确性 |
| 2.4 | 切换实时预览模式 | 编辑器内渲染 Markdown | 切换响应时间 |
| 2.5 | 切换到预览视图 | 完整渲染预览 | 渲染正确性 |

#### 场景 3：AI 辅助写作

| 步骤 | 用户任务 | 预期结果 | 评估指标 |
|------|----------|----------|----------|
| 3.1 | 配置 AI Provider (Ollama/OpenAI) | 连接测试成功 | 配置完成率 |
| 3.2 | 打开 AI 对话面板 | 面板弹出 | 发现性评分 |
| 3.3 | 发送聊天消息 | 流式返回回复 | 首字响应时间 |
| 3.4 | 将 AI 回复插入编辑器 | 内容插入光标位置 | 操作步骤数 |
| 3.5 | 使用语音输入 | 语音转文字 | 识别准确率 |

#### 场景 4：文件管理

| 步骤 | 用户任务 | 预期结果 | 评估指标 |
|------|----------|----------|----------|
| 4.1 | 新建 Markdown 文件 | 文件出现在树中 | 完成率 |
| 4.2 | 重命名文件 | 文件名更新 | 操作直观性 |
| 4.3 | 删除文件 | 确认后删除 | 安全感评分 |
| 4.4 | 搜索文件内容 | 显示匹配结果 | 搜索响应时间 |
| 4.5 | 多标签页切换 | 内容正确切换 | 状态保持完整性 |

#### 场景 5：知识图谱

| 步骤 | 用户任务 | 预期结果 | 评估指标 |
|------|----------|----------|----------|
| 5.1 | 打开知识图谱 | D3 力导向图渲染 | 加载时间 |
| 5.2 | 拖拽/缩放图谱 | 交互流畅 | FPS ≥ 30 |
| 5.3 | 搜索节点 | 聚焦到目标节点 | 搜索准确性 |
| 5.4 | 点击节点跳转文件 | 打开对应文件 | 操作步骤数 |

#### 场景 6：导出与主题

| 步骤 | 用户任务 | 预期结果 | 评估指标 |
|------|----------|----------|----------|
| 6.1 | 导出为 Markdown | 文件下载 | 完成率 |
| 6.2 | 导出为 HTML | 带样式 HTML 下载 | 渲染保真度 |
| 6.3 | 切换深色/浅色主题 | 全局主题切换 | 切换流畅度 |

### 2.5 评估指标体系

| 指标类别 | 具体指标 | 目标值 | 测量方法 |
|----------|----------|--------|----------|
| 有效性 | 任务完成率 | ≥ 90% | 成功完成任务数 / 总任务数 |
| 有效性 | 错误率 | ≤ 5% | 操作错误次数 / 总操作次数 |
| 效率 | 任务完成时间 | 见各场景 | 计时测量 |
| 效率 | 操作步骤数 | ≤ 最优路径 +2 | 步骤计数 |
| 满意度 | SUS 评分 | ≥ 68 | 系统可用性量表 |
| 满意度 | 任务难度评分 | 1-7 分，≤ 3 | 事后问卷 |
| 性能 | 首次内容渲染 | < 2s | Lighthouse / Performance API |
| 性能 | 交互响应时间 | < 100ms | Performance API |
| 兼容性 | 功能可用率 | ≥ 95% | 各平台功能测试矩阵 |

---

## 三、测试发现

### 3.1 问题总览

| 严重程度 | 数量 | 占比 |
|----------|------|------|
| 🔴 致命 (P0) | 5 | 14% |
| 🟠 严重 (P1) | 10 | 28% |
| 🟡 中等 (P2) | 12 | 33% |
| 🟢 轻微 (P3) | 9 | 25% |
| **合计** | **36** | 100% |

### 3.2 致命问题 (P0)

---

#### P0-1: XSS 安全漏洞 — Preview 组件

- **位置**: [Preview.vue:7](file:///Users/tianyi/code/ai-native-markdown/src/components/Preview.vue#L7), [Preview.vue:35](file:///Users/tianyi/code/ai-native-markdown/src/components/Preview.vue#L35)
- **问题描述**: Preview 组件使用 `v-html="renderedContent"` 直接渲染 HTML，且 markdown-it 配置了 `html: true`，允许原始 HTML 通过。`security.ts` 中已定义 `sanitizeMarkdown()` 函数但从未被调用。
- **影响**: 恶意 Markdown 文件可注入 `<script>` 标签或事件处理器，执行任意代码。在 Tauri 桌面环境中，XSS 可直接访问文件系统 API。
- **违反原则**: Nielsen #5 — 错误预防
- **修复建议**: 在 `v-html` 渲染前调用 `sanitizeMarkdown()`，或引入 DOMPurify 库进行净化。同时将 `html: true` 改为 `html: false`（除非有明确需求）。

---

#### P0-2: XSS 安全漏洞 — AI ChatPanel

- **位置**: [ChatPanel.vue:25](file:///Users/tianyi/code/ai-native-markdown/src/components/ai-panel/ChatPanel.vue#L25), [ChatPanel.vue:110-120](file:///Users/tianyi/code/ai-native-markdown/src/components/ai-panel/ChatPanel.vue#L110-L120)
- **问题描述**: ChatPanel 使用 `v-html="renderMarkdown(msg.content)"` 渲染 AI 回复，`renderMarkdown` 仅做基本 HTML 转义 + 正则替换，覆盖不完整。AI 返回内容可包含恶意 HTML。
- **影响**: AI 模型可能返回包含 `<script>` 或 `onerror` 的内容，导致代码执行。
- **违反原则**: Nielsen #5 — 错误预防
- **修复建议**: 使用 DOMPurify 或项目已有的 `sanitizeMarkdown()` 净化 AI 输出后再渲染。

---

#### P0-3: 路径遍历安全风险

- **位置**: [Sidebar.vue:609-673](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L609-L673), [security.ts:14-38](file:///Users/tianyi/code/ai-native-markdown/src/utils/security.ts#L14-L38)
- **问题描述**: `security.ts` 中已定义 `sanitizeFilePath()` 和 `isValidFileName()` 两个安全验证函数，但从未被任何代码调用。文件创建、重命名操作直接将用户输入传给 Tauri invoke。
- **影响**: 恶意用户可通过输入 `../../etc/passwd` 等路径访问系统任意文件。
- **违反原则**: Nielsen #5 — 错误预防
- **修复建议**: 在所有文件操作（创建、重命名、删除）中调用 `sanitizeFilePath()` 和 `isValidFileName()` 进行输入验证。

---

#### P0-4: 无全局错误边界 — 白屏崩溃风险

- **位置**: [App.vue](file:///Users/tianyi/code/ai-native-markdown/src/App.vue) (根组件)
- **问题描述**: 整个项目没有 Vue ErrorBoundary 或 `onErrorCaptured` 钩子。任何组件的未捕获渲染错误将导致整个应用白屏崩溃，没有兜底 UI。
- **影响**: 用户遇到渲染错误时完全无法操作，只能强制关闭应用。
- **违反原则**: Nielsen #9 — 帮助用户识别、诊断和从错误中恢复
- **修复建议**: 在 App.vue 添加 `onErrorCaptured` 钩子，渲染友好的错误页面，提供"重新加载"按钮。

---

#### P0-5: AI 请求无超时机制

- **位置**: [ai.ts:73-187](file:///Users/tianyi/code/ai-native-markdown/src/services/ai.ts#L73-L187)
- **问题描述**: `testConnection()`、`chat()`、`streamChat()` 三个 AI 请求方法均无超时设置。如果 AI 服务端无响应，请求将永远挂起，用户无法取消或恢复。
- **影响**: 用户发送 AI 请求后界面永久卡在"加载中"状态，无法继续操作。
- **违反原则**: Nielsen #1 — 系统状态可见性
- **修复建议**: 为所有 AI 请求添加 30-60 秒超时，超时后显示友好提示并提供重试选项。

---

### 3.3 严重问题 (P1)

---

#### P1-1: 使用原生 `confirm()` 弹窗

- **位置**: [App.vue:273](file:///Users/tianyi/code/ai-native-markdown/src/components/../App.vue#L273), [FileTreeNode.vue:271](file:///Users/tianyi/code/ai-native-markdown/src/components/FileTreeNode.vue#L271)
- **问题描述**: 关闭未保存标签页和删除文件使用浏览器原生 `confirm()` 弹窗，无法自定义样式，与整体设计语言不一致，且在 Tauri 中可能表现异常。
- **影响**: 用户体验断裂，无法识别为应用内对话框；屏幕阅读器无法正确识别。
- **违反原则**: Nielsen #4 — 一致性与标准
- **修复建议**: 实现自定义确认对话框组件，保持设计一致性。

---

#### P1-2: 使用原生 `alert()` 提示错误

- **位置**: [FileTree.vue:111](file:///Users/tianyi/code/ai-native-markdown/src/components/FileTree.vue#L111), [Sidebar.vue:688](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L688), [Sidebar.vue:703](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L703), [App.vue:252](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L252)
- **问题描述**: 文件保存失败、重命名失败、删除失败、导出失败均使用 `alert()` 提示，阻塞主线程，体验差。
- **影响**: 弹窗期间应用完全冻结；样式与应用不一致。
- **违反原则**: Nielsen #4 — 一致性与标准；Nielsen #9 — 错误恢复
- **修复建议**: 实现 Toast/Notification 组件替代 `alert()`。

---

#### P1-3: 大量静默失败 — 用户无感知

- **位置**: [file.ts:42](file:///Users/tianyi/code/ai-native-markdown/src/stores/file.ts#L42), [file.ts:62](file:///Users/tianyi/code/ai-native-markdown/src/stores/file.ts#L62), [Sidebar.vue:355](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L355), [Sidebar.vue:386](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L386), [Sidebar.vue:819](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L819)
- **问题描述**: 文件加载失败、目录加载失败、搜索失败、图谱加载失败等操作仅 `console.error`，用户完全无感知。特别是 `readFile` 失败时返回空字符串，用户可能误以为文件本身就是空的。
- **影响**: 用户无法知道操作是否成功，可能导致数据误判。
- **违反原则**: Nielsen #1 — 系统状态可见性
- **修复建议**: 所有异步操作失败时显示用户可见的错误提示（Toast 或行内消息）。

---

#### P1-4: 文件状态管理重复

- **位置**: [file.ts](file:///Users/tianyi/code/ai-native-markdown/src/stores/file.ts) vs [Sidebar.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue)
- **问题描述**: `file.ts` Store 定义了 rootPath、files 等状态，但 Sidebar.vue 完全自管文件状态（组件内 ref），file Store 实际未被使用。两套状态可能不一致。
- **影响**: 其他组件无法访问文件状态；状态同步困难。
- **违反原则**: Nielsen #4 — 一致性与标准
- **修复建议**: 将 Sidebar 中的文件状态迁移到 file Store，消除重复。

---

#### P1-5: AI 配置双写持久化

- **位置**: [settings.ts:53-63](file:///Users/tianyi/code/ai-native-markdown/src/stores/settings.ts#L53-L63) vs [Sidebar.vue:786-796](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L786-L796)
- **问题描述**: `settings.ts` 通过 `persistSet` (Tauri Store + localStorage) 持久化 AI 配置，但 Sidebar.vue 又单独用 `localStorage.setItem` 保存，两套持久化逻辑可能不一致。
- **影响**: 配置丢失或不一致，用户困惑。
- **违反原则**: Nielsen #4 — 一致性与标准
- **修复建议**: 统一使用 settings Store 的 `persistSet` 方法。

---

#### P1-6: 自动保存竞态条件

- **位置**: [App.vue:310-313](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L310-L313)
- **问题描述**: 自动保存使用 `watch` + `setTimeout(2000)` 实现，但快速连续修改时可能在前一次保存未完成时触发新保存。保存失败后无重试机制。
- **影响**: 快速切换文件时可能保存内容到错误文件；持续失败时用户数据丢失。
- **违反原则**: Nielsen #5 — 错误预防
- **修复建议**: 使用 `AbortController` 或保存锁防止并发保存；保存失败后添加重试逻辑。

---

#### P1-7: 初始 bundle 体积过大 — 无代码分割

- **位置**: [vite.config.ts](file:///Users/tianyi/code/ai-native-markdown/vite.config.ts)
- **问题描述**: Vite 配置完全没有代码分割。mermaid (~800KB)、d3 (~250KB)、highlight.js (~300KB)、katex (~200KB) 全部同步引入，打入同一 chunk。预估初始 bundle 1.5MB-2MB+。
- **影响**: 应用启动缓慢，用户等待时间长。
- **违反原则**: Nielsen #1 — 系统状态可见性（响应速度）
- **修复建议**: 将 mermaid、d3、highlight.js、katex 改为动态 `import()`，按需加载。

---

#### P1-8: Rust 后端同步文件操作阻塞 UI

- **位置**: [lib.rs:317-441](file:///Users/tianyi/code/ai-native-markdown/src-tauri/src/lib.rs#L317-L441)
- **问题描述**: `read_file`、`write_file`、`search_files` 使用 `std::fs` 同步 API，在 Tauri 异步命令中会阻塞线程池。`search_files` 遍历整个目录树并逐文件全量读取，无结果数量限制。
- **影响**: 大文件或大目录操作时 UI 卡顿甚至冻结。
- **违反原则**: Nielsen #1 — 系统状态可见性
- **修复建议**: 改用 `tokio::fs` 异步操作；为 `search_files` 添加结果数量限制。

---

#### P1-9: Windows 路径分隔符问题

- **位置**: [FileTreeNode.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/FileTreeNode.vue), [Sidebar.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue)
- **问题描述**: 前端代码中硬编码 `/` 作为路径分隔符（如 `path.substring(0, path.lastIndexOf('/'))`），Windows 上 Tauri 返回的路径使用 `\`，可能导致路径解析错误。
- **影响**: Windows 用户文件操作失败。
- **违反原则**: Nielsen #4 — 平台一致性
- **修复建议**: 使用 Tauri 的路径 API 或统一处理路径分隔符。

---

#### P1-10: CSP 完全禁用

- **位置**: [tauri.conf.json](file:///Users/tianyi/code/ai-native-markdown/src-tauri/tauri.conf.json)
- **问题描述**: `"csp": null` 完全禁用了内容安全策略，与 XSS 漏洞组合使用时风险极高。
- **影响**: 即使修复了 XSS 漏洞，缺乏 CSP 作为纵深防御，仍可能被绕过。
- **违反原则**: Nielsen #5 — 错误预防
- **修复建议**: 配置合理的 CSP 策略，限制 script-src 和 style-src。

---

### 3.4 中等问题 (P2)

---

#### P2-1: 首次启动无引导

- **位置**: [App.vue](file:///Users/tianyi/code/ai-native-markdown/src/App.vue)
- **问题描述**: 首次启动仅显示空侧边栏 + 空编辑器 + "打开文件夹"按钮，无示例内容、无功能介绍、无引导流程。
- **影响**: 新用户不知道应用能做什么，上手门槛高。
- **违反原则**: Nielsen #10 — 帮助与文档
- **修复建议**: 添加欢迎页/引导流程，提供示例工作区。

---

#### P2-2: 响应式适配极其简陋

- **位置**: 全局 CSS
- **问题描述**: 仅调整了标题栏和状态栏的响应式样式，核心编辑区、侧边栏、AI 面板在移动端无任何适配。`useResponsive` composable 已定义但未被任何组件使用。
- **影响**: 小屏/移动端设备上体验极差。
- **违反原则**: Nielsen #4 — 一致性与标准
- **修复建议**: 移动端侧边栏改为 overlay 模式，AI 面板改为全屏模态，工具栏折叠。

---

#### P2-3: 无分屏预览模式

- **位置**: [App.vue](file:///Users/tianyi/code/ai-native-markdown/src/App.vue)
- **问题描述**: 仅支持"源码模式"和"预览模式"切换，无法同时查看源码和预览。用户需要频繁切换。
- **影响**: 编辑效率降低，特别是排版调整时。
- **违反原则**: Nielsen #3 — 用户控制与自由
- **修复建议**: 在 `viewMode` 中增加 `'split'` 选项，左右同时显示源码和预览。

---

#### P2-4: 标签页管理简陋

- **位置**: [App.vue:91-102](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L91-L102)
- **问题描述**: 无拖拽排序、无右键菜单（关闭其他/关闭所有）、标签过多时仅横向滚动。关闭按钮使用纯文本 `x`，无 `aria-label`。
- **影响**: 多文件管理不便，效率低。
- **违反原则**: Nielsen #3 — 用户控制与自由
- **修复建议**: 添加右键菜单、拖拽排序、标签页溢出下拉菜单。

---

#### P2-5: Live Preview 全量解析性能问题

- **位置**: [decorations.ts](file:///Users/tianyi/code/ai-native-markdown/src/plugins/live-preview/decorations.ts)
- **问题描述**: 每次文档变更/选区变更/视口变更都全量重新计算装饰，大文档下可能造成输入延迟。
- **影响**: 大文件（>1000行）编辑时输入卡顿。
- **违反原则**: Nielsen #1 — 系统状态可见性（响应速度）
- **修复建议**: 引入增量装饰计算，仅重算变更行附近。

---

#### P2-6: 多处异步操作缺少 loading 状态

- **位置**: 文件树加载、文件读取、搜索、导出操作
- **问题描述**: 文件树加载、文件读取、内容搜索、导出操作均无加载指示器，用户点击后无视觉反馈直到结果出现。
- **影响**: 用户不确定操作是否生效，可能重复点击。
- **违反原则**: Nielsen #1 — 系统状态可见性
- **修复建议**: 为所有异步操作添加 loading 状态指示器。

---

#### P2-7: 工具栏按钮不满足触摸目标

- **位置**: [Editor.vue:352](file:///Users/tianyi/code/ai-native-markdown/src/components/Editor.vue#L352)
- **问题描述**: 工具栏按钮仅 30x30px，不满足 44px 最小触摸目标（WCAG 2.5.8）。虽然全局定义了 `.touch-target` 类但未在此处使用。
- **影响**: 触摸屏设备上操作困难。
- **违反原则**: Nielsen #4 — 可访问性
- **修复建议**: 增大按钮点击区域至 44x44px。

---

#### P2-8: 右键菜单无边界检测

- **位置**: [FileTreeNode.vue:249-253](file:///Users/tianyi/code/ai-native-markdown/src/components/FileTreeNode.vue#L249-L253)
- **问题描述**: 右键菜单位置未做视口边界检测，靠近屏幕边缘时菜单可能超出视口不可见。
- **影响**: 部分菜单选项无法点击。
- **违反原则**: Nielsen #1 — 系统状态可见性
- **修复建议**: 添加边界检测逻辑，自动调整菜单位置。

---

#### P2-9: AI 配置发现性差

- **位置**: [AIPanel.vue:85](file:///Users/tianyi/code/ai-native-markdown/src/components/AIPanel.vue#L85), [Sidebar.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue)
- **问题描述**: AI 面板在未配置 Provider 时仅显示"未配置 AI 服务"提示，但配置入口在侧边栏 AI CONFIG Tab 中，用户需自行发现。两个 AI 面板实现（AIPanel + ChatPanel）共存，功能重叠。
- **影响**: 用户不知道如何配置 AI，放弃使用。
- **违反原则**: Nielsen #6 — 识别而非回忆
- **修复建议**: 在 AI 面板中添加"去配置"按钮直接跳转；合并两个 AI 面板。

---

#### P2-10: 颜色对比度不达标

- **位置**: [style.css](file:///Users/tianyi/code/ai-native-markdown/src/style.css)
- **问题描述**: `--text-muted: #6B7280` 在 `--bg-base: #0A0A0C` 上对比度约 4.1:1（WCAG AA 需 4.5:1）；`--text-disabled: #4B5563` 对比度仅约 2.5:1，远低于标准。
- **影响**: 视力不佳用户阅读困难。
- **违反原则**: Nielsen #4 — 可访问性
- **修复建议**: 提高文字颜色亮度，确保满足 WCAG AA 标准。

---

#### P2-11: 知识图谱 D3 渲染无错误处理

- **位置**: [useKnowledgeGraph.ts](file:///Users/tianyi/code/ai-native-markdown/src/composables/useKnowledgeGraph.ts)
- **问题描述**: `initGraph()` 没有 try-catch，D3 渲染失败时整个图谱区域空白。`mousemove` 监听器未在 `onUnmounted` 中移除，存在内存泄漏。
- **影响**: 图谱功能不可用时无任何提示；反复切换导致内存泄漏。
- **违反原则**: Nielsen #9 — 错误恢复
- **修复建议**: 添加 try-catch 和错误提示；在 `destroyGraph` 中移除所有事件监听器。

---

#### P2-12: `window.open` 在 Tauri 中行为异常

- **位置**: [widgets.ts:22](file:///Users/tianyi/code/ai-native-markdown/src/plugins/live-preview/widgets.ts#L22)
- **问题描述**: 实时预览中点击链接使用 `window.open(this.url, '_blank')`，在 Tauri 中可能打开新的 Tauri 窗口而非系统浏览器。
- **影响**: 用户期望在浏览器中打开链接，但打开了新的应用窗口。
- **违反原则**: Nielsen #4 — 平台一致性
- **修复建议**: 使用 `@tauri-apps/plugin-shell` 的 `open()` API。

---

### 3.5 轻微问题 (P3)

---

#### P3-1: 旧版 CSS 兼容变量冗余

- **位置**: [style.css:80-118](file:///Users/tianyi/code/ai-native-markdown/src/style.css#L80-L118)
- **问题描述**: 约 40 行旧版兼容变量（如 `--bg-primary` 映射到 `--bg-base`），增加维护负担。
- **修复建议**: 逐步淘汰旧版变量，统一使用新 Token。

---

#### P3-2: `useResponsive` 未被使用

- **位置**: [useResponsive.ts](file:///Users/tianyi/code/ai-native-markdown/src/composables/useResponsive.ts)
- **问题描述**: composable 已定义但未被任何组件引入，属于死代码。
- **修复建议**: 在需要响应式适配的组件中引入使用，或移除。

---

#### P3-3: `useTheme` 无附加价值

- **位置**: [useTheme.ts](file:///Users/tianyi/code/ai-native-markdown/src/composables/useTheme.ts)
- **问题描述**: 仅是 `useSettingsStore` 的薄包装，无额外逻辑，增加了不必要的间接层。
- **修复建议**: 直接使用 `useSettingsStore` 或在 composable 中添加实际逻辑。

---

#### P3-4: TaskScheduler 占位组件

- **位置**: [TaskScheduler.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/task-scheduler/TaskScheduler.vue)
- **问题描述**: 显示"即将上线"，侧边栏有入口但功能完全缺失。
- **修复建议**: 隐藏入口直到功能就绪。

---

#### P3-5: 搜索结果限制无提示

- **位置**: [Sidebar.vue:75](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L75)
- **问题描述**: 搜索结果每文件最多显示 3 个匹配行（`slice(0, 3)`），但无"查看更多"入口或提示。
- **修复建议**: 添加"显示更多匹配"按钮或提示文字。

---

#### P3-6: Checkbox 不可交互

- **位置**: [widgets.ts](file:///Users/tianyi/code/ai-native-markdown/src/plugins/live-preview/widgets.ts)
- **问题描述**: Live Preview 中的 CheckboxWidget `ignoreEvent()` 返回 `true`，用户无法在编辑器中直接勾选任务列表。
- **修复建议**: 实现点击切换 checkbox 状态的功能。

---

#### P3-7: Mermaid 渲染失败降级简陋

- **位置**: [Preview.vue:112-114](file:///Users/tianyi/code/ai-native-markdown/src/components/Preview.vue#L112-L114)
- **问题描述**: Mermaid 渲染失败仅显示 "Mermaid diagram error"，无原始代码查看或重试选项。
- **修复建议**: 显示错误信息 + 原始代码块 + 重试按钮。

---

#### P3-8: API Key 明文存储

- **位置**: [Sidebar.vue:786-796](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L786-L796)
- **问题描述**: AI 服务的 API Key 明文存储在 localStorage 中，无加密保护。
- **修复建议**: 使用 Tauri 的安全存储 API 或加密后存储。

---

#### P3-9: 知识图谱搜索只匹配第一个结果

- **位置**: [useKnowledgeGraph.ts:89-95](file:///Users/tianyi/code/ai-native-markdown/src/composables/useKnowledgeGraph.ts#L89-L95)
- **问题描述**: 图谱搜索只聚焦到第一个匹配节点，无多结果导航。
- **修复建议**: 支持多结果高亮和导航（上一个/下一个）。

---

## 四、各模块可用性评分

| 模块 | 有效性 | 效率 | 满意度 | 可访问性 | 综合评分 |
|------|--------|------|--------|----------|----------|
| Markdown 编辑器 | 8/10 | 7/10 | 7/10 | 6/10 | **7.0** |
| 实时预览 | 7/10 | 6/10 | 7/10 | 5/10 | **6.3** |
| AI 辅助写作 | 6/10 | 5/10 | 6/10 | 4/10 | **5.3** |
| 文件管理 | 7/10 | 6/10 | 5/10 | 5/10 | **5.8** |
| 知识图谱 | 6/10 | 5/10 | 6/10 | 3/10 | **5.0** |
| 语音输入 | 5/10 | 4/10 | 5/10 | 3/10 | **4.3** |
| 主题系统 | 9/10 | 9/10 | 8/10 | 6/10 | **8.0** |
| 导出功能 | 7/10 | 7/10 | 6/10 | 5/10 | **6.3** |
| **整体** | **6.9** | **6.1** | **6.3** | **4.6** | **6.0** |

---

## 五、性能评估

### 5.1 性能指标评估

| 指标 | 当前状态 | 目标值 | 达标 |
|------|----------|--------|------|
| 初始 bundle 大小 | ~1.5-2MB (无代码分割) | < 500KB | ❌ |
| 首次内容渲染 (FCP) | 预估 > 2s | < 1.5s | ❌ |
| 交互响应时间 (编辑) | < 50ms (小文件) | < 100ms | ✅ |
| 交互响应时间 (大文件) | 可能 > 200ms | < 100ms | ❌ |
| AI 首字响应时间 | 取决于后端 | < 2s | ⚠️ |
| 知识图谱加载 | 无进度反馈 | < 3s | ⚠️ |
| 文件搜索响应 | 大目录可能 > 5s | < 2s | ❌ |
| 内存占用 | 多 Tab 翻倍 | < 200MB | ⚠️ |

### 5.2 性能评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 初始加载性能 | 3/10 | 无代码分割，1.5MB+ 初始 bundle |
| 运行时性能 | 6/10 | CodeMirror 6 本身性能好，但 Live Preview 全量解析拖后腿 |
| 内存管理 | 5/10 | 主要组件有清理，但存在若干泄漏点 |
| 大文件处理 | 3/10 | 前后端均无流式/分块处理 |

---

## 六、兼容性评估

### 6.1 跨平台兼容性

| 平台 | 兼容性 | 关键问题 |
|------|--------|----------|
| macOS | ✅ 良好 | 主要开发和测试平台 |
| Windows | ⚠️ 有问题 | 路径分隔符硬编码 `/`；缺少麦克风权限声明 |
| Linux | ⚠️ 有问题 | WebKitGTK 不支持 Web Speech API；`performance.memory` 不可用 |

### 6.2 Web API 兼容性

| API | 兼容性 | 影响 |
|-----|--------|------|
| Web Speech API | ⚠️ 仅 Chrome/Edge/Safari | Linux Tauri 完全不可用 |
| `performance.memory` | ❌ Chrome 独有 | Firefox/Safari/Linux 不可用 |
| `PerformanceObserver (longtask)` | ⚠️ 仅 Chrome/Edge | Safari 部分支持 |
| `navigator.clipboard` | ✅ 安全上下文可用 | Tauri 环境正常 |
| `IntersectionObserver` | ✅ 兼容性良好 | 无问题 |
| `window.open` | ❌ Tauri 行为异常 | 应使用 Shell API |

### 6.3 CSS 兼容性

| 特性 | 兼容性 | 影响 |
|------|--------|------|
| CSS 变量 | ✅ Tauri 内置 Chromium | 无问题 |
| `::-webkit-scrollbar` | ⚠️ 仅 WebKit/Blink | Firefox 使用标准属性 |
| `backdrop-filter` | ⚠️ 缺少 `-webkit-` 前缀 | Safari 旧版本需要 |
| `:focus-visible` | ✅ 现代浏览器 | 无问题 |
| `-webkit-app-region` | ⚠️ 仅 WebKit/Blink | Firefox 不支持 |

### 6.4 兼容性评分

| 维度 | 评分 |
|------|------|
| CSS 兼容性 | 7/10 |
| API 兼容性 | 6/10 |
| 跨平台支持 | 5/10 |
| **综合** | **6/10** |

---

## 七、错误处理覆盖率评估

| 类别 | 已覆盖 | 未覆盖 | 覆盖率 |
|------|--------|--------|--------|
| Try-Catch 块 | 21 处 | ~15 处应有但缺失 | ~58% |
| ErrorBoundary | 0 | 1 (全局) | 0% |
| 用户可见错误消息 | 12 处 | ~10 处仅 console.error | ~55% |
| 验证逻辑 | 3 处定义 | 3 处未使用 + ~8 处缺失 | ~27% |
| Loading 状态 | 6 处 | ~5 处缺失 | ~55% |
| 降级 UI | 4 处 | ~5 处缺失 | ~44% |
| 网络错误处理 | 3 处 | 超时/重试/离线检测缺失 | ~40% |
| 文件操作错误 | 6 处 | ~6 处缺失 | ~50% |
| 输入验证 | 5 处 | ~8 处缺失 | ~38% |
| **整体错误处理覆盖率** | | | **~40%** |

---

## 八、改进建议优先级路线图

### 第一阶段：安全与稳定性 (P0 — 必须立即修复)

| # | 改进项 | 预期效果 |
|---|--------|----------|
| 1 | 在 Preview 和 ChatPanel 中引入 `sanitizeMarkdown()` 或 DOMPurify | 消除 XSS 漏洞 |
| 2 | 在文件操作中调用 `sanitizeFilePath()` 和 `isValidFileName()` | 防止路径遍历攻击 |
| 3 | 在 App.vue 添加 `onErrorCaptured` 全局错误边界 | 防止白屏崩溃 |
| 4 | 为 AI 请求添加 30-60 秒超时 | 防止请求永远挂起 |
| 5 | 配置合理的 CSP 策略 | 纵深防御 XSS |

### 第二阶段：用户体验核心 (P1 — 2 周内修复)

| # | 改进项 | 预期效果 |
|---|--------|----------|
| 6 | 实现自定义确认对话框替代 `confirm()` | 体验一致性 |
| 7 | 实现 Toast/Notification 组件替代 `alert()` | 非阻塞提示 |
| 8 | 为静默失败操作添加用户可见错误提示 | 操作可感知 |
| 9 | 统一文件状态管理到 file Store | 状态一致性 |
| 10 | 统一 AI 配置持久化逻辑 | 配置可靠性 |
| 11 | 修复自动保存竞态条件 | 数据安全 |
| 12 | 配置 Vite 代码分割 | 启动速度提升 50%+ |
| 13 | Rust 后端改用 `tokio::fs` | UI 流畅度 |
| 14 | 修复 Windows 路径分隔符 | 跨平台兼容 |

### 第三阶段：体验优化 (P2 — 1 月内改进)

| # | 改进项 | 预期效果 |
|---|--------|----------|
| 15 | 添加首次启动引导/欢迎页 | 新用户上手 |
| 16 | 增强响应式适配 | 移动端可用 |
| 17 | 添加分屏预览模式 | 编辑效率 |
| 18 | 增强标签页管理 | 多文件效率 |
| 19 | 优化 Live Preview 增量解析 | 大文件性能 |
| 20 | 为异步操作添加 loading 状态 | 操作可感知 |
| 21 | 增大工具栏触摸目标 | 触摸可用性 |
| 22 | 右键菜单边界检测 | 交互完整性 |
| 23 | AI 配置发现性优化 | AI 功能可用性 |
| 24 | 提升颜色对比度 | 可访问性 |
| 25 | 知识图谱错误处理 + 内存泄漏修复 | 稳定性 |
| 26 | 替换 `window.open` 为 Tauri Shell API | 链接行为正确 |

### 第四阶段：打磨完善 (P3 — 持续优化)

| # | 改进项 | 预期效果 |
|---|--------|----------|
| 27 | 清理旧版 CSS 兼容变量 | 代码整洁 |
| 28 | 清理/使用 `useResponsive` | 消除死代码 |
| 29 | 隐藏 TaskScheduler 入口 | 避免用户困惑 |
| 30 | 搜索结果"查看更多" | 搜索完整性 |
| 31 | Checkbox 交互支持 | 任务列表可用性 |
| 32 | Mermaid 渲染失败增强降级 | 错误恢复 |
| 33 | API Key 加密存储 | 安全性 |
| 34 | 知识图谱多结果搜索导航 | 搜索效率 |

---

## 九、用户测试招募建议

### 9.1 目标用户群体

| 群体 | 人数 | 筛选标准 |
|------|------|----------|
| Markdown 新手 | 3-5 人 | 了解基本语法，未使用过专业编辑器 |
| 日常写作者 | 5-8 人 | 每周使用 Markdown 3+ 次，使用过 Typora/Obsidian 等 |
| 知识管理用户 | 3-5 人 | 使用双链笔记（Obsidian/Logseq），有 Wiki Links 经验 |
| AI 辅助用户 | 3-5 人 | 使用过 ChatGPT/Claude 辅助写作，了解 Ollama |

### 9.2 测试环境矩阵

| 操作系统 | 版本 | 人数 |
|----------|------|------|
| macOS | 14+ (Sonoma) | 8-10 |
| Windows | 11 | 5-8 |
| Linux | Ubuntu 22.04+ | 3-5 |

### 9.3 测试流程

1. **前置问卷** (5 分钟)：收集用户背景、Markdown 经验、工具使用历史
2. **任务执行** (30-45 分钟)：按场景 1-6 顺序执行，记录操作行为
3. **事后访谈** (15 分钟)：收集定性反馈、痛点、改进建议
4. **SUS 问卷** (5 分钟)：系统可用性量表评分

### 9.4 数据收集方法

| 数据类型 | 收集方式 |
|----------|----------|
| 任务完成率 | 观察记录 |
| 任务时间 | 屏幕录制 + 时间戳 |
| 错误率 | 操作日志 |
| 操作路径 | 屏幕录制 |
| 用户满意度 | SUS 量表 + 事后访谈 |
| 定性反馈 | 半结构化访谈 |

---

## 十、总结

### 10.1 整体可用性评估

**综合可用性评分: 6.0 / 10**

AI Native Markdown 作为一个 AI 原生 Markdown 编辑器，在以下方面表现良好：
- **设计系统完善**：完整的 CSS Token 体系，深色/浅色双主题，动画流畅
- **编辑器核心扎实**：CodeMirror 6 提供了良好的编辑体验
- **AI 集成有特色**：流式输出、上下文感知、语音输入等功能有差异化价值

但在以下方面需要重点改进：
- **安全性**：XSS 漏洞和路径遍历风险是致命问题，必须立即修复
- **错误处理**：40% 的覆盖率意味着超过一半的错误场景用户无感知
- **性能**：无代码分割和全量解析策略导致大文件和启动体验差
- **可访问性**：颜色对比度、键盘操作、屏幕阅读器支持不足
- **跨平台**：Windows 路径问题和 Linux API 缺失影响兼容性

### 10.2 关键数据

| 维度 | 评分 | 状态 |
|------|------|------|
| 功能完整性 | 7/10 | 核心功能齐全，TaskScheduler 占位 |
| 交互设计 | 6/10 | 基本可用，细节粗糙 |
| 视觉设计 | 8/10 | 设计系统完善，执行到位 |
| 错误处理 | 4/10 | 覆盖率 40%，大量静默失败 |
| 性能 | 4/10 | 无代码分割，大文件卡顿 |
| 安全性 | 3/10 | XSS + 路径遍历 + CSP 缺失 |
| 可访问性 | 5/10 | 基础有，深度不足 |
| 跨平台兼容 | 5/10 | macOS 良好，Windows/Linux 有问题 |
| **综合** | **6.0/10** | **有潜力，需重点修复安全和性能问题** |

---

> **报告生成时间**: 2026-05-16  
> **评估方法**: 基于代码审计的专家评估 + 启发式可用性分析  
> **建议**: 优先修复 P0 安全问题，然后按路线图逐步改进用户体验
