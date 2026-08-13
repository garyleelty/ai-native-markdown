# 架构

## 总览

AeroMind 采用**三层 feature-based 架构 + 插件系统**，状态管理统一使用 Riverpod `Notifier` + 不可变状态类。

```
lib/
├── main.dart                         # 入口：Hive 初始化 + 全局错误处理 + 启动引导
├── app.dart                          # App Shell：布局 + 全局快捷键 + 插件注册 + 命令绑定
├── core/                             # 共享层
│   ├── models/                       # NoteModel / PaneState / PredictiveLink / Backlink / 图模型
│   ├── plugin/                       # 插件系统核心
│   ├── builtin_plugins/              # 5 个内置插件
│   ├── services/                     # 文件/Hive/搜索/任务/回收站/版本/Git 备份/插件 API 实现
│   ├── theme/                        # AeroColors + AeroTheme（VS Code 暗色风格）
│   └── widgets/                      # 通用组件库
├── features/                         # 功能模块（按功能划分，见 features.md）
├── providers/                        # Riverpod 状态管理（13 个 provider）
└── examples/                         # hello_plugin.dart 插件开发示例
```

## 分层职责

| 层 | 职责 | 典型示例 |
|---|---|---|
| `providers/` | 全局状态 + 业务逻辑 | `PaneStackNotifier`、`EditorSessionNotifier` |
| `core/services/` | 无状态基础设施 | `FileService`、`SearchService`、`TrashService` |
| `core/models/` | 纯数据模型（不可变） | `NoteModel`、`EntityHighlight` |
| `features/*/widgets/` | 界面 + 局部状态 | `NotePanel`、`AiChatPanel` |
| `core/plugin/` | 插件系统骨架 | `PluginRegistry`、`PluginApi` |

## 关键设计模式

| 模式 | 说明 |
|---|---|
| **Riverpod Notifier** | 所有共享状态使用 `Notifier` + 不可变状态类 + `copyWith` |
| **Repository** | `NoteRepository` 抽象 + `LocalNoteRepository`（Hive 实现） |
| **Strategy** | 实体识别：`local` / `remote` / `hybrid` 三种策略 |
| **Plugin** | `BasePlugin` + `PluginRegistry` + `PluginApi` 受控沙箱 |
| **Debounce** | 实体识别 500ms、自动保存 2s、滚动偏移写回 300ms |
| **Immutable + copyWith** | 状态类均不可变，变更产生新实例 |
| **条件导入** | `_io.dart` / `_web.dart` 平台差异化实现（LLM、Git、日记存储） |

## 状态提升（跨重建持久化）

最近一次重构将原本属于 Widget 的本地状态提升到 Provider，使面板被堆叠/恢复、笔记被重开时状态不丢失：

| 状态 | Provider | 说明 |
|---|---|---|
| 撤销/重做栈 | `editorSessionProvider` | 每笔记最多 100 条，重做栈上限相同 |
| 搜索/替换栏状态 | `editorSessionProvider` | 显示状态 + 关键词按 noteId 隔离 |
| 编辑器模式 | `paneStackProvider` | source / livePreview / preview |
| 标题编辑草稿 | `paneStackProvider` | 面板被移出栈时保留未完成编辑 |
| 面板滚动偏移 | `paneStackProvider` | 300ms 防抖写回，按 noteId 定位 |
| AI 输入草稿 | `aiChatProvider` | 输入框内容跨重建恢复 |

## 响应式布局

- AI 面板断点 1200px（`_kCompactWidthBreakpoint`），窄屏折叠为 28px 把手条。
- 面板布局移动端断点 600 / 900。

## 线程与生命周期约定

- `dispose()` 阶段不可再使用 `ref.read` / `ref.watch`（会抛 `StateError`）；如需在 dispose 写状态，请在 `initState` 中捕获 notifier 对象后调用其方法。
- `initState` 中不可使用 `ref.listen`（仅限 build），应使用 `ref.listenManual`。