# AI Markdown 代码审查报告

> 审查日期: 2026-06-13
> 审查范围: 全项目核心组件、布局、功能完整性

---

## 一、布局问题

### 1.1 侧边栏导航图标栏固定 72px 过宽

**文件**: [Sidebar.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue) / [app.css](file:///Users/tianyi/code/ai-native-markdown/src/styles/app.css)

侧边栏左侧图标导航栏固定 72px，在窄屏下占用过多空间。Obsidian 的图标栏仅约 48-52px。当侧边栏内容区较窄时，72px 的图标栏让内容区只剩不到 200px，几乎无法使用。

**建议**: 将 `.sidebar-nav` 宽度从 72px 缩减到 52px，图标从 18px 缩减到 16px，标签文字字号从 10px 缩减到 9px。

### 1.2 右侧面板堆叠过多，屏幕宽度 < 1500px 时体验差

**文件**: [App.vue](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L503-L517)

当前布局允许同时显示：侧边栏(280px) + 编辑器 + AI面板(380px) + 图谱面板(480px) + 右侧工作台(300px)。即使有互斥逻辑，在 1040-1500px 范围内编辑器仍然被挤压到极窄。

**建议**:
- 1040px 以下只允许一个右侧面板
- AI 面板和图谱/工作台互斥显示，不能同时打开
- 添加最小编辑器宽度保护（min-width: 400px）

### 1.3 移动端 AI 面板底部弹出遮挡编辑区

**文件**: [App.vue](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L301-L312)

移动端 AI 面板使用 `ai-panel-section` 从底部弹出，高度固定为 `aiPanelHeight`（默认 260px），但没有拖拽调整的视觉提示，且最大高度 50vh 可能遮挡大部分编辑区。

**建议**: 添加拖拽手柄视觉提示；默认高度改为 40vh；增加最小/最大高度约束。

### 1.4 Header 高度不一致

**文件**: [app.css](file:///Users/tianyi/code/ai-native-markdown/src/styles/app.css)

`app-header` CSS 中 `height: 44px`，但 App.vue 模板中 `height="48px"`。CSS 的 44px 被覆盖，但两处不一致容易造成维护混乱。

**建议**: 统一为 44px，移除模板中的 `height="48px"`。

---

## 二、缺失功能

### 2.1 缺少文件收藏/置顶功能

**文件**: [FileExplorer.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/FileExplorer.vue)

Obsidian 支持文件收藏夹（Bookmarks），当前文件管理器只有文件夹树，没有收藏功能。用户无法快速访问常用文件。

**建议**: 添加收藏夹区域，支持右键收藏/取消收藏，收藏列表持久化到 localStorage。

### 2.2 缺少多会话/对话历史管理

**文件**: [ChatPanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/ai-panel/ChatPanel.vue)

AI 对话面板只有单次对话，关闭后消息丢失（仅靠 `useChatMessages` 的内存存储）。没有对话历史列表、无法切换历史对话、无法搜索历史消息。

**建议**: 添加对话历史列表侧栏，支持创建新对话、切换对话、删除对话，对话持久化到 IndexedDB。

### 2.3 缺少快捷键自定义功能

**文件**: [SettingsPanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/SettingsPanel.vue)

设置面板只提供了有限的快捷键提示，没有快捷键自定义界面。用户无法修改默认快捷键绑定。

**建议**: 在设置中添加快捷键管理页面，允许用户查看和重新绑定快捷键。

### 2.4 缺少文件模板管理

**文件**: [TemplateGallery.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/TemplateGallery.vue)

虽然有模板画廊，但用户无法创建、编辑、删除自定义模板。模板是硬编码的，无法个性化。

**建议**: 允许用户从当前文档保存为模板，支持模板的增删改查，持久化到 localStorage。

### 2.5 缺少批量操作功能

**文件**: [FileExplorer.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/FileExplorer.vue)

文件管理器不支持多选、批量删除、批量移动、批量重命名等操作。

**建议**: 添加 Shift/Ctrl 多选支持，批量操作工具栏。

### 2.6 缺少拼写检查 / 语法检查

编辑器没有拼写检查或 Markdown 语法检查功能。Obsidian 有内置的拼写检查和 lint 提示。

**建议**: 集成 CodeMirror 的 linter 扩展，提供 Markdown 语法检查（如未闭合的链接、重复标题等）。

### 2.7 缺少图片粘贴上传管理

虽然支持拖拽导入文件，但不支持剪贴板图片粘贴。用户截图后需要先保存为文件再拖入。

**建议**: 监听 `paste` 事件，检测剪贴板中的图片，自动保存到工作区 assets 目录并插入 Markdown 图片链接。

---

## 三、UI/UX 问题

### 3.1 编辑器工具栏按钮过多，缺少分组折叠

**文件**: [Editor.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Editor.vue#L3-L157)

工具栏有 17 个按钮 + 7 个分隔符，在窄屏下需要水平滚动。虽然有滚动淡出提示，但体验不佳。

**建议**: 将低频操作（H1-H3、任务列表、自动换行、语音输入、智能补全）折叠到"更多"下拉菜单中，工具栏只保留高频操作（撤销/重做、加粗/斜体、代码、链接、列表）。

### 3.2 知识面板标签页过多（6 个标签）

**文件**: [KnowledgePanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/KnowledgePanel.vue)

知识面板有 6 个标签页（大纲、属性、反链、提及、图谱、洞察），在窄侧边栏中标签页文字被严重压缩，难以辨认。

**建议**: 将"属性"合并到"大纲"标签页中（作为折叠区域），将"洞察"合并到"图谱"标签页中，减少到 4 个标签。

### 3.3 设置面板信息密度过高

**文件**: [SettingsPanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/SettingsPanel.vue)

设置面板在一个长列表中展示了所有设置项，没有分类折叠，滚动距离长。AI 配置通过 slot 嵌入，但与设置面板的其他项混在一起。

**建议**: 将设置分为可折叠的分组（外观、编辑器、AI、高级），每组默认折叠只展示标题，点击展开。

### 3.4 AI 面板输入区布局不合理

**文件**: [ChatPanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/ai-panel/ChatPanel.vue#L178-L249)

输入区使用 `flex` 水平排列 textarea、语音按钮、发送按钮，但 textarea 的 `rows="2"` 在窄面板中过高，导致输入区和消息区争夺空间。QuickActions 在输入框上方，占用额外空间。

**建议**: 将 QuickActions 移到消息区底部（作为浮动工具条），输入区只保留 textarea + 发送按钮，textarea 默认 rows=1 自动扩展。

### 3.5 欢迎页最近文件列表使用 `safeStorage` 但缺少清理机制

**文件**: [WelcomePage.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/WelcomePage.vue#L119-L124)

最近文件列表从 `safeStorage` 读取，但没有清理无效路径的机制。如果文件被删除，列表中仍显示但点击会报错。

**建议**: 在打开最近文件时，先验证文件是否存在，不存在则从列表中移除。

### 3.6 标签栏右键菜单位置不跟随鼠标

**文件**: [App.vue](file:///Users/tianyi/code/ai-native-markdown/src/App.vue#L173-L195)

标签栏的右键菜单使用 `el-dropdown` 的 `trigger="manual"` 实现，但菜单位置不跟随右键点击位置，而是固定在隐藏按钮的位置。

**建议**: 使用原生右键菜单或 `@contextmenu` + 动态定位，让菜单出现在鼠标位置。

---

## 四、代码质量问题

### 4.1 App.vue 过于庞大（1012 行）

**文件**: [App.vue](file:///Users/tianyi/code/ai-native-markdown/src/App.vue)

App.vue 有 1012 行代码，违反了项目规范中"Vue 组件不超过 400 行逻辑"的约束。虽然已提取了大量 composables，但模板和事件处理仍然过多。

**建议**: 将标签栏管理、文件树事件处理、欢迎页事件处理等提取为独立组件或 composables。

### 4.2 Preview.vue 中 MarkdownIt 实例在组件内创建

**文件**: [Preview.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Preview.vue#L57-L100)

Preview.vue 在组件内部通过 `createMarkdownRenderer` 创建了 MarkdownIt 实例并自定义了 wikiLinkRule，这与 Editor 中的 live-preview 插件使用不同的渲染逻辑，可能导致预览与导出不一致。

**建议**: 将 wikiLinkRule 的自定义逻辑统一到 `createMarkdownRenderer` 工厂函数中，确保所有渲染路径使用相同的配置。

### 4.3 ChatPanel 中 `addCopyButtons` 使用 DOM 操作

**文件**: [ChatPanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/ai-panel/ChatPanel.vue#L467-L487)

`addCopyButtons` 方法直接操作 DOM 创建按钮，这在 Vue 中是反模式，且每次消息更新都会重新查询和操作 DOM。

**建议**: 在 `renderMarkdown` 中通过 MarkdownIt 插件直接生成带复制按钮的 HTML，或使用 Vue 指令处理。

### 4.4 settings store 中 sidebarTabs 与 Sidebar.vue 中重复定义

**文件**: [settings.ts](file:///Users/tianyi/code/ai-native-markdown/src/stores/settings.ts#L7) / [Sidebar.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue#L128)

`sidebarTabs` 数组在 settings.ts 和 Sidebar.vue 中各定义了一份，如果新增标签页需要同时修改两处。

**建议**: 将 `sidebarTabs` 定义移到 types 文件或 constants 文件中，两处引用同一来源。

---

## 五、性能问题

### 5.1 知识面板每次切换文件都重建索引

**文件**: [KnowledgePanel.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/sidebar/KnowledgePanel.vue#L541-L546)

`watch(() => props.currentFile)` 触发 `loadCurrentFileKnowledge()`，但 `loadGraphData()` 也在图谱标签可见时被调用。频繁切换文件可能导致图谱数据反复重建。

**建议**: 对 `loadGraphData` 添加防抖，或仅在图谱标签页激活时才响应文件切换。

### 5.2 Preview 组件每次内容变化都重建 lineMap

**文件**: [Preview.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Preview.vue#L134-L148)

`buildLineMap()` 每次渲染后都遍历所有 `[data-line]` 元素，对于长文档（1000+ 行）可能造成卡顿。

**建议**: 使用增量更新策略，仅在文档结构变化时重建，或使用 `requestIdleCallback` 延迟构建。

---

## 六、可访问性问题

### 6.1 侧边栏图标缺少 aria-label

**文件**: [Sidebar.vue](file:///Users/tianyi/code/ai-native-markdown/src/components/Sidebar.vue)

侧边栏导航的 `el-menu-item` 有 `aria-label`，但知识面板内的标签页、按钮等缺少 `aria-label`。

### 6.2 拖拽调整大小缺少键盘操作支持

所有 resize handle（侧边栏、分屏、AI 面板）只支持鼠标拖拽，没有键盘操作方式。

**建议**: 为 resize handle 添加键盘支持（方向键调整大小）。

---

## 修改优先级

| 优先级 | 问题编号 | 描述 |
|--------|---------|------|
| P0 | 1.4 | Header 高度不一致 |
| P0 | 4.4 | sidebarTabs 重复定义 |
| P1 | 1.1 | 侧边栏图标栏过宽 |
| P1 | 3.6 | 标签栏右键菜单位置 |
| P1 | 3.5 | 最近文件缺少清理 |
| P1 | 4.2 | Preview MarkdownIt 实例不一致 |
| P2 | 1.2 | 右侧面板堆叠过多 |
| P2 | 3.1 | 工具栏按钮过多 |
| P2 | 3.4 | AI 面板输入区布局 |
| P2 | 4.1 | App.vue 过于庞大 |
| P2 | 5.1 | 知识面板索引重建 |
| P3 | 2.1-2.7 | 缺失功能 |
| P3 | 3.2-3.3 | UI 优化 |
| P3 | 6.1-6.2 | 可访问性 |
