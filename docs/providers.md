# Provider 状态管理

全部使用 Riverpod `Notifier` + 不可变状态类，位于 `lib/providers/`（13 个文件）。

## 笔记

| Provider | 状态 | 关键方法 |
|---|---|---|
| `noteRepositoryProvider` | `NoteRepository`（抽象）→ `LocalNoteRepository`（Hive LazyBox） | CRUD + `changes` 流 + `searchBySemantic` |
| `noteByIdProvider` / `allNotesProvider` / `noteSearchProvider` / `noteNotifierProvider` | FutureProvider | 笔记订阅 |

## 面板

| Provider | 状态 | 关键方法 |
|---|---|---|
| `paneStackProvider` | `PaneStackState` + `PaneStackNotifier` | open/close/activate/stack（最多 2 个可见面板）、scrollOffset、splitRatio、editorMode、titleEditingDraft |

## AI

| Provider | 状态 | 关键方法 |
|---|---|---|
| `entityCacheProvider` | `EntityCacheState`（最多 200 条） | 按 noteId 缓存实体 |
| `entityRecognizerProvider` | `EntityRecognizer` | 500ms 防抖识别，策略来自设置 |
| `aiContextProvider` / `aiContextPromptProvider` | `AIContext` / `AIContextPrompt` | 可见面板聚合 → AI prompt + token 估算 |
| `predictiveLinksProvider` | `FutureProvider.family` | 预测链接（最多 5 条） |
| `aiChatProvider` | `AiChatState` + `AiChatNotifier` | 对话历史 + isLoading + inputDraft |

## 编辑器会话

| Provider | 状态 | 关键方法 |
|---|---|---|
| `editorSessionProvider` | `EditorSessionCollection` + `EditorSessionNotifier` | 撤销/重做（每笔记最多 100 条，新增清空重做栈）+ 搜索替换栏状态，按 noteId 隔离 |

## 设置与 Git 备份

| Provider | 状态 | 关键方法 |
|---|---|---|
| `settingsProvider` | `AppSettings` | autoSave(2s)、recognitionDelay(500ms)、strategy、fontSize、themeMode、llm 配置、aiChatPanelVisible、mermaidEnabled、clearAllData |
| `gitBackupProvider` | `GitBackupState` + `GitBackupNotifier` | initRepo / backup / restore / updateConfig / loadHistory |

## 界面状态

| Provider | 状态 | 关键方法 |
|---|---|---|
| `sidebarProvider` | `SidebarState` + `SidebarNotifier` | 10 视图切换 + 搜索 + 标签管理 + 大纲 + 反向链接 + 任务 + 笔记树 + 删除(进回收站) + 重命名 |
| `commandPaletteProvider` | `CommandPaletteState` + `CommandPaletteNotifier` | 命令面板开关/搜索/绑定 actions |
| `templateGalleryProvider` | `TemplateGalleryState` | 模板画廊 |
| `pluginManagerProvider` | `PluginManagerState` | 插件管理面板 |
| `quickSwitcherProvider` | `QuickSwitcherState`（最近最多 10） | Quick Switcher |
| `graphProvider` | `GraphState` + `GraphNotifier` | 图谱构建（最多 50 节点） |
| `calendarDisplayMonthProvider` | 月份状态 | 日历视图当前显示月份 |

## 约定

- 状态类均为不可变，变更通过 `copyWith` 产生新实例。
- Provider 之间通过 `ref.read` / `ref.watch` 组合，不在 Widget 中直接改状态。
- 命令面板的 action 通过 `commandPaletteProvider.notifier.bindActions({...})` 注入（解耦 Widget 层，见 `app.dart`）。