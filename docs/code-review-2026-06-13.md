# AI Markdown 代码审查报告

> 审查日期：2026-06-13
> 审查范围：功能完整性、布局合理性、缺失功能、代码质量
> 审查人：AI Code Reviewer

---

## 一、功能缺失（按优先级排序）

### P0 — 严重影响可用性

1. **聊天记录不持久化**
   - `ChatPanel.vue` 的消息仅存在内存中（`useChatMessages`），刷新页面后对话全部丢失。
   - Obsidian 等工具都会保留对话历史，用户期望关闭再打开后能继续上次的对话。
   - 建议：将消息持久化到 IndexedDB，按文件/会话分组存储。

2. **缺少撤销/重做（Undo/Redo）的 UI 入口** — **已修复**
   - 工具栏已添加撤销/重做按钮。

3. **缺少「保存」按钮**
   - 虽然有自动保存，但用户无法手动触发保存（除了 Ctrl+S），工具栏没有保存按钮。
   - 状态栏的「未保存」/「已保存」文字太小且不醒目，用户容易忽略。

4. **`regenerate` 函数边界条件 Bug** — **已修复**
   - 当 index <= 0 时，应禁用重新生成按钮或给出提示。

5. **`loadEncryptedConfig` 中 v2 加密密钥无法同步解密**
   - [settings.ts:43-45](file:///Users/tianyi/code/ai-native-markdown/src/stores/settings.ts#L43) v2 加密的 apiKey 返回原值（`enc:v2:...`），在同步初始化时无法解密。
   - 需要异步解密流程，但当前没有触发异步解密的机制，导致 v2 加密的 API Key 在页面刷新后可能无法使用。
   - 修复：在 store 初始化后增加异步解密步骤。

6. **StatusBar 组件未被使用**
   - [StatusBar.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/editor/StatusBar.vue) 是一个独立的编辑器状态栏组件，包含字符数、行数、阅读时间、光标位置、AI 连接状态等信息。
   - 但 App.vue 的状态栏是直接内联实现的，StatusBar.vue 完全没有被引用。
   - StatusBar.vue 使用了不同的 CSS 变量（`--bg-elevated`、`--text-muted` 等），与 app.css 中的 Obsidian 主题变量不一致，说明它是一个遗留组件。
   - 建议：删除未使用的 StatusBar.vue，避免代码混淆。

7. **Editor.vue 超过 400 行限制**
   - [Editor.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Editor.vue) 的 `<script setup>` 部分超过 400 行，违反项目规范 §6.1。
   - 编辑器工具栏逻辑应提取为 `useEditorToolbar` composable（已存在但未完全使用）。

### P1 — 影响用户体验

8. **查找替换缺少「全词匹配」选项**
   - [FindReplace.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/editor/FindReplace.vue) 有「区分大小写」和「正则表达式」，但缺少「全词匹配」选项。
   - 这是 Obsidian 和 VS Code 的标准功能。

9. **导出缺少 DOCX 格式**
   - [ExportDialog.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/ExportDialog.vue) 支持 Markdown/HTML/PDF/纯文本，但不支持 Word (.docx) 格式。
   - 学术写作用户常需要导出为 Word。

10. **PDF 导出使用浏览器打印，体验差**
    - PDF 导出只是 `window.print()`，没有页边距、页眉页脚、分页控制。
    - 用户期望的是真正的 PDF 导出，而非浏览器打印对话框。

11. **缺少多标签拖拽排序视觉反馈**
    - 标签栏有 `dragstart` 和 `drop` 事件处理，但拖拽视觉反馈缺失，用户不知道可以拖拽。
    - 建议添加拖拽时的占位符和视觉指示。

12. **WelcomePage 最近文件与 FileExplorer 不同步**
    - FileExplorer 的 `addRecentFile` 写入 `recent_files` 键。
    - WelcomePage 的 `loadRecentFiles` 也读取 `recent_files` 键。
    - 但 WelcomePage 在 `onMounted` 时读取后不再更新，如果用户关闭所有标签回到欢迎页，最近文件列表不会反映最新状态。

13. **`SettingsPanel` 中 `ghostTextConfig` 和 `wordWrap` 直接赋值** — **已修复**
    - 已通过 store setter 方法修改。

14. **`testProviderConnection` 时序问题** — **已修复**
    - 已使用 `useAIStatus` 提供的 `setProviderStatus` 方法。

15. **侧边栏知识面板与右侧工作台功能重叠**
    - 侧边栏的「知识图谱」面板（KnowledgePanel）包含大纲、属性、反链、提及、图谱洞察。
    - 右侧工作台（RightDock）也包含大纲、属性、关联。
    - 两个位置展示相同信息，用户困惑该看哪里。
    - 建议：侧边栏知识面板侧重图谱可视化，右侧工作台侧重文档属性和关联，明确分工。

16. **RSS 面板文章列表无分页**
    - [RSSPanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/RSSPanel.vue) 的 `filteredArticles` 一次性加载所有文章，无分页或虚拟滚动。
    - 订阅源多时，文章列表可能很长，影响性能和体验。

17. **文件树不支持拖拽移动**
    - [FileExplorer.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/FileExplorer.vue) 只支持右键菜单操作（重命名、删除），不支持拖拽文件到其他文件夹。
    - Obsidian 和 VS Code 都支持拖拽移动文件。

### P2 — 功能增强

18. **缺少书签/收藏功能**
    - 无法将常用文件标记为收藏，快速访问。
    - Obsidian 的星标功能是高频使用的功能。

19. **缺少文件内链接预览（Hover Preview）**
    - 鼠标悬停在 `[[wiki-link]]` 上时，没有弹窗预览目标文件内容。
    - Obsidian 的悬停预览是其核心体验之一。

20. **缺少批量操作**
    - 文件管理器不支持多选、批量删除、批量移动。
    - 命令面板不支持批量执行。

21. **缺少拼写检查**
    - 编辑器没有拼写检查功能，中英文拼写错误无法自动检测。

22. **缺少图片上传/管理**
    - 只能通过拖拽或手动输入插入图片，没有图片浏览器或上传功能。
    - 没有图片缩放/对齐控制。

23. **缺少自定义 CSS 片段（Snippets）**
    - Obsidian 允许用户添加自定义 CSS 片段来微调界面。
    - 当前设置面板没有此功能。

24. **QuickActions 不可自定义**
    - AI 面板的快捷操作是硬编码的，用户无法添加自定义快捷操作。
    - 设置面板有 `quickActions` 存储，但没有 UI 入口来编辑。

25. **缺少每日笔记快捷入口**
    - `useDailyNote` composable 已实现每日笔记功能，但 UI 上没有明显的入口。
    - 建议在侧边栏文件面板顶部添加「今日笔记」按钮。

26. **缺少模板管理功能**
    - TemplateGallery 组件已存在，但模板是硬编码的。
    - 用户无法创建、编辑或删除自定义模板。

27. **版本历史缺少差异对比**
    - [VersionHistoryPanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/editor/VersionHistoryPanel.vue) 只显示版本列表和恢复功能，没有差异对比视图。
    - 用户无法直观看到两个版本之间的变化。

---

## 二、布局问题

### 2.1 面板空间竞争

1. **AI 面板 + 图谱 + 右侧工作台同时打开时编辑区过窄**
   - [App.vue:503-517](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L503) 中 `showDesktopRightDock` 的条件要求 `viewportWidth >= 1500`，但 AI 面板 + 图谱同时打开时，1500px 也不够。
   - 建议在 AI 面板打开时自动收起图谱，或提供「聚焦编辑器」一键收起所有面板。

2. **移动端 AI 面板遮挡编辑区**
   - [App.vue:300-312](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L300) 移动端 AI 面板是底部弹出（`ai-panel-section`），但默认高度 260px 占了屏幕近一半。
   - 用户无法同时看到编辑内容和 AI 回复，需要频繁切换。

3. **侧边栏没有 CSS 层面的最小宽度保护**
   - [useResize.ts](file:///Users/tianyi/code/ai-native-markdown/src/composables/useResize.ts) 侧边栏宽度已限制在 240-400px 范围内。
   - 但 CSS 层面没有 `min-width` 保护，如果通过其他方式修改宽度（如直接修改 localStorage），可能导致异常。

### 2.2 Header 布局

4. **Header 按钮过多，小屏幕溢出**
   - [App.vue:29-101](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L29) Header 有 5 个圆形按钮（侧边栏、AI、视图、更多、主题），加上中间的文件名标签。
   - 在 768px-1024px 窗口下，按钮间距过小，容易误触。
   - 建议将主题切换按钮合并到「更多」菜单中（设置面板已有暗色/亮色切换入口）。

5. **文件名标签信息不足**
   - Header 中间只显示文件名，不显示文件夹路径。
   - 当有同名文件在不同目录时，无法区分。
   - 建议：hover 时显示完整路径 tooltip。

### 2.3 编辑器布局

6. **工具栏在窄屏下无法完整显示**
   - [Editor.vue:4-157](file:///Users/tianyi/code/ai-native-markdown/src/components/Editor.vue#L4) 工具栏按钮过多（撤销/重做、粗体、斜体、删除线、H1-H3、代码、引用、链接、图片、列表、实时预览、换行、语音、智能补全），水平滚动体验差。
   - 建议将低频按钮（语音输入、智能补全）折叠到「更多」菜单，或使用二级工具栏。

7. **分屏模式分割线不明显**
   - 分屏模式的拖拽手柄 `split-divider-handle` 视觉上不够明显，用户不知道可以拖拽调整比例。
   - 建议：hover 时增加分割线高度和颜色对比度。

8. **编辑器最小宽度 400px 在多面板时不够**
   - [app.css:267](file:///Users/tianyi/code/ai-native-markdown/src/styles/app.css#L267) `.editor-container-main` 设置 `min-width: 400px`。
   - 当侧边栏 + AI 面板 + 右侧工作台同时打开时，400px 的最小宽度可能导致其他面板被挤出视口。

### 2.4 侧边栏布局

9. **侧边栏导航缺少 RSS 快捷键**
   - [useAppKeyboard.ts](file:///Users/tianyi/code/ai-native-markdown/src/composables/useAppKeyboard.ts) 有 Ctrl+1/2/3/4 对应 files/search/knowledge/settings，但 RSS 面板没有快捷键。
   - RSS 作为侧边栏一级导航，应该有对应的快捷键（Ctrl+5）。

10. **侧边栏面板切换没有动画方向**
    - [Sidebar.vue:31](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L31) 使用 `Transition name="fade"`，所有面板切换都是淡入淡出。
    - 建议使用滑动动画，给用户方向感。

11. **侧边栏导航图标和标签文字间距不协调**
    - 导航菜单项使用 `flex-direction: column`，图标和文字垂直排列。
    - 但 `nav-label` 字号 9px 过小，在非 Retina 屏幕上几乎不可读。
    - 建议：增大字号至 10px，或在小屏幕下只显示图标。

### 2.5 右侧工作台布局

12. **右侧工作台三个面板比例固定，不可调整**
    - [RightDock.vue:179-189](file:///Users/tianyi/code/ai-native-markdown/src/components/workbench/RightDock.vue#L179) 大纲 28%、属性 30%、关联 42% 的比例是硬编码的。
    - 用户无法拖拽调整各面板高度。
    - 长文档需要更大的大纲区域，短文档需要更大的关联区域。

13. **右侧工作台标题「检查器」语义不明确**
    - RightDock 的标题是「检查器」，但面板内容是大纲、属性、关联。
    - 「检查器」这个名称来自 VS Code，但对 Markdown 用户来说不够直观。
    - 建议：改为「文档信息」或「文档面板」。

---

## 三、代码质量问题

### 3.1 违反项目规范

1. **~~`searchNotes` 工具使用 `getAll()` 全量加载~~** — 已修复

2. **`SettingsPanel` 中直接赋值 store 属性** — **已修复**

3. **StatusBar.vue 使用不一致的 CSS 变量**
   - [StatusBar.vue:74-161](file:///Users/tianyi/code/ai-native-markdown/src/components/editor/StatusBar.vue#L74) 使用 `--bg-elevated`、`--text-muted`、`--border-subtle` 等变量。
   - 这些变量与 app.css 中定义的 Obsidian 主题变量（`--obsidian-bg-*`、`--obsidian-text-*`、`--obsidian-border`）不一致。
   - 说明 StatusBar.vue 是旧版遗留代码，未被当前主题系统覆盖。

4. **App.vue 超过 1000 行**
   - [App.vue](file:///Users/tianyi/code/ai-native-markdown/src/App.vue) 的 `<script setup>` 部分超过 600 行，加上模板和样式总计超过 1000 行。
   - 虽然已提取了多个 composable，但仍有大量内联逻辑（如 `handleFileTreeRename`、`syncOpenTabWikiLinksForRename` 等）。
   - 建议：将文件树操作逻辑提取到 `useFileTreeOperations` composable。

### 3.2 潜在 Bug

5. **`addCopyButtons` 使用 DOM 操作而非 Vue 响应式**
   - [ChatPanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/ai-panel/ChatPanel.vue) 通过 `document.createElement` 手动添加复制按钮。
   - 虽然有防重复检查，但在消息更新时仍可能出现时序问题。
   - 建议在消息渲染模板中直接添加复制按钮。

6. **`regenerate` 函数边界条件** — **已修复**

7. **`watch(messages, ..., { deep: true })` 性能问题**
   - 当前已改为监听 `messages.value.length` 和最后一条消息的 `content`，性能问题已部分缓解。
   - 但 `addCopyButtons` 仍在每次消息数量变化时调用，可能对 DOM 进行不必要的操作。

8. **`loadEncryptedConfig` v2 加密密钥同步解密缺失**
   - [settings.ts:43-45](file:///Users/tianyi/code/ai-native-markdown/src/stores/settings.ts#L43) v2 加密的 apiKey 在同步加载时返回原值 `enc:v2:...`。
   - 页面刷新后，`aiConfig.value.apiKey` 包含加密前缀而非明文，导致 API 调用失败。
   - 需要在 store 初始化后增加异步解密步骤。

9. **RSS 文章描述使用 `v-html` 存在 XSS 风险**
   - [RSSPanel.vue:108](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/RSSPanel.vue#L108) `v-html="sanitizeArticleDescription(article.description)"`。
   - 虽然使用了 `sanitizeMarkdown`，但 RSS 源的 HTML 内容可能包含恶意脚本。
   - 建议：确认 `sanitizeMarkdown` 的白名单足够严格，或使用纯文本显示。

### 3.3 性能问题

10. **`refreshMarkdownPaths` 在多处频繁调用**
    - [App.vue:633-639](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L633) 每次文件选择、重命名、删除都调用 `refreshMarkdownPaths`，全量获取所有 Markdown 文件路径。
    - 对于大型工作区，这可能导致性能问题。建议增量更新或防抖。

11. **知识图谱 D3 渲染性能**
    - `useKnowledgeGraph` 使用 D3.js 力导向图，节点数量超过 100 时可能出现卡顿。
    - 建议添加虚拟渲染或节点数量限制。

12. **RSS 文章列表无虚拟滚动**
    - RSSPanel 的文章列表使用普通 `v-for` 渲染，文章多时 DOM 节点过多。
    - 建议使用虚拟滚动或分页。

---

## 四、交互体验问题

1. **AI 面板状态切换不够直观**
   - AI 面板有 4 种状态（unconfigured/connecting/connected/error），Header 上的 AI 按钮已有状态小圆点（`ai-status-dot`），但颜色区分不够明显。
   - 建议增强状态指示器的视觉效果。

2. **命令面板缺少最近使用记录**
   - [CommandPalette.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/CommandPalette.vue) 打开后默认显示所有命令，没有按使用频率排序。
   - 应记录最近使用的命令并优先展示。

3. **标签栏右键菜单缺少「固定标签」选项**
   - [App.vue:185-192](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L185) 标签右键菜单只有保存/关闭/关闭其他/关闭所有。
   - 缺少「固定标签」（Pin Tab）功能，固定后不会被「关闭其他」关闭。

4. **缺少键盘快捷键提示系统**
   - 工具栏按钮有 tooltip 显示快捷键，但没有全局的快捷键参考面板。
   - 欢迎页有部分快捷键，但不完整（缺少 Ctrl+F、Ctrl+H、Ctrl+1-4 等）。

5. **拖拽文件到编辑区时缺少文件类型提示**
   - [App.vue:378-385](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L378) 拖拽覆盖层只提示「拖放 Markdown 文件」，但实际也支持图片和 PDF。
   - 应根据拖拽的文件类型显示不同的提示。

6. **文件树只显示 Markdown 文件**
   - [FileExplorer.vue:231](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/FileExplorer.vue#L231) `buildTree` 过滤条件只保留 `.md` 和 `.markdown` 文件，其他文件类型（如图片、PDF）在树中不可见。
   - 用户无法通过文件树浏览和管理附件。

7. **侧边栏面板切换无快捷键提示**
   - 侧边栏导航菜单项没有显示快捷键（如 Ctrl+1 对应文件），用户不知道有快捷键。
   - 建议在 tooltip 或 hover 状态下显示快捷键。

8. **AI 面板输入框占位符不够引导**
   - [ChatPanel.vue:185](file:///Users/tianyi/code/ai-native-markdown/src/components/ai-panel/ChatPanel.vue#L185) 输入框占位符只是「输入问题...」。
   - 建议：根据当前上下文动态提示，如「关于 [文件名] 的问题...」或「让 AI 帮你...」。

---

## 五、建议修改清单

| # | 问题 | 优先级 | 修改方案 | 状态 |
|---|------|--------|---------|------|
| 1 | 聊天记录不持久化 | P0 | 将消息存入 IndexedDB，按文件分组 | 待修复 |
| 2 | regenerate 边界 Bug | P0 | index<=0 时禁用或提示 | **已修复** |
| 3 | v2 加密密钥无法解密 | P0 | store 初始化后异步解密 | 待修复 |
| 4 | 缺少保存按钮 | P0 | 工具栏添加保存按钮 | 待修复 |
| 5 | StatusBar.vue 未使用 | P0 | 删除未使用的组件 | 待修复 |
| 6 | SettingsPanel 直接赋值 | P1 | 通过 store setter 方法修改 | **已修复** |
| 7 | 查找替换缺少全词匹配 | P1 | FindReplace 添加 wholeWord 选项 | 待修复 |
| 8 | AI 按钮状态指示不明显 | P1 | 增强状态圆点视觉效果 | 待修复 |
| 9 | 工具栏按钮过多 | P1 | 折叠低频按钮到更多菜单 | 待修复 |
| 10 | 侧边栏无最小宽度 | P1 | resize 时限制最小 200px | 待修复 |
| 11 | 知识面板与右侧工作台功能重叠 | P1 | 明确分工，避免重复 | 待修复 |
| 12 | RSS 文章列表无分页 | P1 | 添加分页或虚拟滚动 | 待修复 |
| 13 | 文件树不支持拖拽移动 | P1 | 添加拖拽移动支持 | 待修复 |
| 14 | Header 主题按钮冗余 | P1 | 合并到更多菜单 | 待修复 |
| 15 | 右侧工作台面板比例不可调 | P2 | 添加拖拽调整 | 待修复 |
| 16 | addCopyButtons 用 DOM 操作 | P2 | 改为 Vue 模板渲染 | 待修复 |
| 17 | 命令面板无最近使用 | P2 | 记录并优先展示最近命令 | 待修复 |
| 18 | 缺少悬停预览 | P2 | wiki-link hover preview | 待修复 |
| 19 | 缺少书签功能 | P2 | 添加收藏标记和快速访问 | 待修复 |
| 20 | 文件树只显示 MD | P2 | 显示所有文件类型 | 待修复 |
| 21 | RSS 缺少快捷键 | P2 | 添加 Ctrl+5 快捷键 | 待修复 |
| 22 | 版本历史缺少差异对比 | P2 | 添加 diff 视图 | 待修复 |
| 23 | 每日笔记缺少 UI 入口 | P2 | 侧边栏添加入口 | 待修复 |
| 24 | 拖拽提示不区分文件类型 | P2 | 根据类型显示不同提示 | 待修复 |
| 25 | AI 输入框占位符不引导 | P2 | 动态提示 | 待修复 |
