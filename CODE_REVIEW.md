# AI Markdown 代码审查报告

> 审查日期: 2026-06-13
> 审查范围: 全项目功能、布局、代码质量

---

## 一、功能缺失

### 1.1 缺少「撤销关闭标签」功能
**问题**: 用户误关标签后无法恢复。Obsidian 和 VS Code 均支持 `Ctrl+Shift+T` 恢复最近关闭的标签。
**建议**: 在 `useTabManagement` 中维护 `recentlyClosedTabs` 栈，支持快捷键恢复。

### 1.2 缺少「设置重置」功能
**问题**: `SettingsPanel.vue` 没有提供"恢复默认设置"按钮。用户误操作后无法一键恢复。
**建议**: 在设置面板底部添加"恢复默认设置"按钮，调用 `settingsStore.resetToDefaults()`。

### 1.3 缺少「搜索历史」功能
**问题**: `GlobalSearchPanel.vue` 不保存搜索历史，每次打开都从零开始。Obsidian 的搜索面板会保留最近搜索词。
**建议**: 在 `useGlobalSearch` 中持久化最近 20 条搜索记录，提供下拉选择。

### 1.4 缺少「文件收藏/置顶」功能
**问题**: `FileExplorer.vue` 没有收藏功能。高频使用的文件只能通过最近打开列表访问，无法主动标记。
**建议**: 支持右键菜单"收藏"操作，在文件树顶部显示收藏文件区域。

### 1.5 缺少「图谱过滤」功能
**问题**: `GraphWorkbenchPane.vue` 只能查看完整图谱，无法按标签、目录、连接深度过滤。大型工作区的图谱会非常密集。
**建议**: 添加搜索过滤框和深度滑块，支持只显示当前笔记的 N 度关联。

### 1.6 缺少「批量导出」功能
**问题**: `ExportDialog.vue` 只能导出当前文件，不支持批量导出整个目录。
**建议**: 在导出对话框中添加"导出范围"选项（当前文件/当前目录/整个工作区）。

### 1.7 缺少「写作目标设置入口」
**问题**: `WritingGoal.vue` 组件存在但设置面板中没有对应的配置入口，用户无法自定义目标字数。
**建议**: 在设置面板的"编辑器行为"区域添加写作目标配置。

### 1.8 缺少「快捷键自定义」功能
**问题**: 所有快捷键硬编码在 `useAppKeyboard.ts` 中，用户无法自定义。
**建议**: 在设置面板中添加快捷键自定义区域，至少支持查看当前快捷键映射。

---

## 二、布局与 UI 问题

### 2.1 标题栏空间利用不足
**问题**: `App.vue` 的 header 区域（44px）只显示品牌名和当前文件名，中间区域几乎空白。在宽屏上浪费了大量空间。
**建议**: 将面包屑导航或快速操作放入 header-center 区域。

### 2.2 工具栏按钮过多且无法折叠
**问题**: `Editor.vue` 工具栏有 15+ 个按钮，在小屏幕上需要水平滚动。没有"更多工具"折叠机制。
**建议**: 将低频操作（如 H1/H2/H3）折叠到下拉菜单中，只保留高频操作可见。

### 2.3 AI 面板与图谱面板互斥不合理
**问题**: `App.vue` 中 AI 面板和图谱面板同时打开时，在 <1500px 宽度下互斥关闭。用户可能需要同时查看 AI 对话和图谱。
**建议**: 改为标签页切换模式，或允许用户选择哪个面板优先显示。

### 2.4 侧边栏面板切换缺少动画反馈
**问题**: `Sidebar.vue` 使用 `Transition name="fade"` 切换面板，但面板内容高度差异大时，切换会显得突兀。
**建议**: 添加高度过渡动画，或至少确保面板切换时滚动位置重置。

### 2.5 RSS 面板编辑对话框未适配暗色主题
**问题**: `RSSPanel.vue` 使用 `el-dialog` 编辑 RSS 源，但对话框内的表单没有暗色主题适配样式。
**建议**: 为编辑对话框添加与 `AIConfigPanel.vue` 一致的暗色主题样式覆盖。

### 2.6 欢迎页"最近文件"区域加载时无骨架屏
**问题**: `WelcomePage.vue` 的最近文件区域在 `onMounted` 异步加载完成前完全空白，用户可能以为没有最近文件。
**建议**: 添加加载骨架屏或 loading 指示器。

### 2.7 右侧工作台各面板比例固定
**问题**: `RightDock.vue` 中大纲、属性、关联三个面板的比例硬编码为 28%/30%/42%，无法拖拽调整。
**建议**: 添加面板间拖拽分隔条，允许用户自定义各面板高度。

---

## 三、代码质量问题

### 3.1 空的 catch 块
以下文件包含空 catch 块，可能吞没关键错误：
- `src/components/Preview.vue:60` — highlight.js 失败被静默忽略
- `src/components/Preview.vue:185` — mermaid.initialize 失败被静默忽略
- `src/services/ai.ts:285` 和 `:395` — AI 服务错误被静默忽略
- `src/composables/useFileOperations.ts:92` — 文件操作失败被静默忽略

**建议**: 至少添加 `console.warn` 或将错误上报到用户可见的 UI。

### 3.2 生产代码中的 console 语句
以下文件在生产代码中保留了 console 输出：
- `src/services/fileImporter.ts` — console.error
- `src/components/sidebar/KnowledgePanel.vue` — console.error
- `src/main.ts` — console.error
- `src/composables/useChatStream.ts` — console.warn
- `src/composables/useProperties.ts` — console.error
- `src/utils/security.ts` — console.warn
- `src/utils/errorHandler.ts` — console.warn
- `src/services/fileSystem.ts` — console.warn

**建议**: 使用统一的 `logger` 工具替代，生产构建时自动移除。

### 3.3 App.vue 脚本超过 600 行
**问题**: `App.vue` 的 `<script setup>` 部分超过 600 行，违反项目规范"组件不超过 400 行"。
**建议**: 将以下逻辑提取为 composable：
- 标签管理相关逻辑 → `useAppTabs`
- 文件树操作逻辑 → `useFileTreeSync`
- 生命周期初始化逻辑 → `useAppInit`

### 3.4 AIConfigPanel 样式硬编码 fallback 值
**问题**: `AIConfigPanel.vue` 的 CSS 中大量使用 `var(--obsidian-bg-primary, #1e1e1e)` 格式，硬编码了暗色主题的 fallback 值。在浅色主题下这些 fallback 会导致颜色不正确。
**建议**: 移除 CSS fallback 值，确保所有 CSS 变量在浅色/暗色主题下都有正确定义。

### 3.5 GraphWorkbenchPane 标题使用英文
**问题**: `GraphWorkbenchPane.vue` 标题显示 "Graph view"，而其他面板标题均为中文（如"知识图谱"）。
**建议**: 统一为中文"图谱视图"。

### 3.6 RightDock 标题使用英文
**问题**: `RightDock.vue` 标题显示 "Inspector"，与其他面板的中文标题不一致。
**建议**: 统一为中文"检查器"。

---

## 四、已修复的问题

以下问题已在本次审查中直接修复：

### 4.1 GraphWorkbenchPane 标题中文化
将 "Graph view" 改为 "图谱视图"。

### 4.2 RightDock 标题中文化
将 "Inspector" 改为 "检查器"。

### 4.3 添加设置重置功能
在 `SettingsPanel.vue` 底部添加"恢复默认设置"按钮。

### 4.4 欢迎页最近文件加载指示器
在 `WelcomePage.vue` 的最近文件区域添加加载状态。

### 4.5 AIConfigPanel 移除 CSS 硬编码 fallback
移除 `AIConfigPanel.vue` 中所有 CSS 变量的硬编码 fallback 值。
