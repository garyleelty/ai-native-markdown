# AeroMind — AI Native 笔记应用

> Sliding Panes + 实体识别 + 语义上下文 + 插件系统的智能 Markdown 笔记系统

## 项目概况

- **项目名**: aeromind
- **框架**: Flutter (Dart SDK >=3.2.0 <4.0.0)
- **状态**: 核心架构完成，插件系统已实现，数据层已接通

## 架构

三层 feature-based 架构 + 插件系统：

```
lib/
├── main.dart                         # 入口 (Hive 初始化 + 插件注册)
├── app.dart                          # App Shell: 侧栏 + Sliding Panes + AI 面板 + 覆盖层
├── core/                             # 共享层
│   ├── models/                       # NoteModel, PredictiveLink, EntityType
│   ├── services/                     # FileService, HiveService, PluginApiImpl
│   ├── plugin/                       # ★ 插件系统核心
│   │   ├── plugin_manifest.dart      # 插件清单 (id, name, version, settings)
│   │   ├── base_plugin.dart          # 插件抽象基类 + 生命周期钩子
│   │   ├── plugin_api.dart           # 插件可访问的 API 接口
│   │   ├── plugin_registry.dart      # 插件注册表 + 生命周期管理
│   │   └── plugin_storage.dart       # 每插件隔离的 KV 存储
│   ├── builtin_plugins/              # 内置插件
│   │   ├── word_count_plugin.dart    # 字数统计插件
│   │   ├── markdown_enhance_plugin.dart # Markdown 格式化增强
│   │   └── export_plugin.dart        # 多格式导出 (TXT/HTML/JSON)
│   └── theme/                        # AeroColors + AeroTheme (VS Code 暗色风格)
├── features/                         # 功能模块
│   ├── sliding_panes/                # Andy Matuschak 风格横向滑动面板
│   ├── editor/                       # 双模式编辑器 + AI 实体高亮
│   │   ├── widgets/                  # NotePanel, EntityTextEditor
│   │   └── services/                 # EditorService (字数统计/Markdown快捷操作/自动保存)
│   ├── ai_engine/                    # 实体识别引擎
│   │   └── services/                 # EntityRecognizer (local/remote/hybrid 三种策略)
│   ├── knowledge_graph/              # 知识图谱可视化 (力导向布局)
│   ├── command_palette/              # VS Code 风格命令面板
│   ├── templates/                    # 模板引擎 (6 内置模板 + 自定义)
│   ├── daily_notes/                  # 日记系统 (按日创建 + 日历视图)
│   ├── sidebar/                      # ★ 侧边栏 (笔记树/搜索/标签/最近/插件)
│   │   ├── models/                   # SidebarState, NoteTreeNode
│   │   └── widgets/                  # SidebarContainer
│   └── plugins/                      # ★ 插件管理面板
│       ├── models/                   # ExtensionType 枚举
│       └── widgets/                  # PluginManagerOverlay
├── providers/                        # Riverpod 状态管理
│   ├── note_provider.dart            # NoteRepository + LocalNoteRepository (Hive)
│   ├── pane_provider.dart            # PaneStackNotifier 面板栈
│   ├── ai_provider.dart              # 实体缓存 + AI 上下文 + 预测链接
│   ├── graph_provider.dart           # 知识图谱状态
│   ├── command_provider.dart         # 命令面板状态
│   ├── template_provider.dart        # 模板画廊 + 日记服务
│   ├── sidebar_provider.dart         # ★ 侧边栏状态
│   └── plugin_provider.dart          # ★ 插件管理面板状态
└── examples/
    └── hello_plugin.dart             # 插件开发示例模板
```

## 插件系统

### 架构概览

```
BasePlugin (抽象基类)
    ├── PluginManifest (清单描述)
    ├── PluginApi (宿主 API 接口)
    ├── PluginStorage (隔离 KV 存储)
    └── PluginRegistry (生命周期管理)
```

### 扩展点类型

| ExtensionType | 说明 | 钩子方法 |
|---|---|---|
| `command` | 命令面板操作 | `getCommands()` |
| `entityRecognizer` | 自定义实体识别 | `recognizeEntities(markdown)` |
| `contentProcessor` | 笔记保存前处理 | `processContent(markdown, noteId)` |
| `searchEnhancer` | 搜索结果增强 | `enhanceSearchResults(results, query)` |
| `sidebarPanel` | 侧边栏自定义面板 | — |
| `statusBarItem` | 状态栏信息显示 | — |
| `exporter` | 自定义导出格式 | — |
| `importer` | 自定义导入格式 | — |
| `aiProvider` | 自定义 AI 后端 | — |
| `themeExtension` | 主题扩展 | — |

### 插件生命周期

```
registered → initializing → active → paused → disposed
                               ↑         |
                               └─────────┘ (resume)
```

### 开发一个插件

```dart
class MyPlugin extends BasePlugin {
  @override
  PluginManifest get manifest => PluginManifest(
    id: 'com.example.my-plugin',
    name: '我的插件',
    version: '1.0.0',
    description: '描述',
    extensionTypes: ['command', 'contentProcessor'],
  );

  @override
  Future<void> onActivate(PluginContext ctx) async {
    ctx.api.onNoteOpened((noteId) { /* ... */ });
  }

  @override
  List<PluginCommand> getCommands() => [/* ... */];

  @override
  Future<String?> processContent(String markdown, String noteId) async {
    return null; // 不修改则返回 null
  }
}
```

参考: `lib/examples/hello_plugin.dart`

### PluginApi 能力

插件通过 `PluginApi` 访问宿主服务（受控沙箱）:
- `getNote / getAllNotes / saveNote / searchNotes` — 笔记 CRUD
- `activeNoteId / openNoteIds` — 当前面板状态
- `registerCommand / unregisterCommand` — 命令注册
- `showStatusMessage / showNotification` — UI 反馈
- `getStorage(pluginId)` — 隔离 KV 存储
- `onNoteOpened / onNoteSaved / onEntitiesRecognized / onPaneStackChanged` — 事件监听
- `aiContextPrompt / recognizeEntities` — AI 能力

## 关键设计模式

| 模式 | 说明 |
|---|---|
| **Riverpod Notifier** | 所有状态管理统一使用 `Notifier` + 不可变状态类 |
| **Repository** | `NoteRepository` 抽象 + `LocalNoteRepository` (Hive) |
| **Strategy** | 实体识别: `local` / `remote` / `hybrid` 三种策略 |
| **Plugin** | 插件系统: `BasePlugin` + `PluginRegistry` + `PluginApi` |
| **Debounce** | 实体识别 500ms，自动保存 2s |
| **Immutable + copyWith** | 所有状态类均为不可变 |

## 实体识别类型

本地 regex 识别 7 种实体:
- `[[wiki links]]` → reference (笔记链接)
- `> blockquotes` → quote (引用块)
- `@person mentions` → person (人物提及)
- `#tags` → concept (标签)
- `- [ ] tasks` → task (待办任务)
- `$math$` → concept (数学公式)
- `2024-01-01` → concept (时间戳)

远程 LLM 策略支持 OpenAI 兼容 API，混合模式下本地+远程结果合并去重。

## 预测链接推荐

`PredictiveLinkService` 基于 TF-IDF 简化版计算笔记相似度:
1. **关键词相似度** (权重 0.6) — 中英文关键词交集
2. **标签相似度** (权重 0.3) — 共同标签匹配
3. **标题包含性** (权重 0.1) — 标题词出现在正文中

## 存储策略（Local-First）

| 层 | 存储 | 用途 |
|---|---|---|
| 文件系统 | `.md` 文件 | 原始 Markdown 内容 |
| Hive | KV 存储 | 笔记元数据 + 插件存储 |
| Isar | 本地 DB | 向量索引，语义搜索 (待接通) |

## 技术栈

### 运行时依赖
- `flutter_riverpod` ^2.5.1 — 状态管理
- `hive_flutter` ^1.1.0 — 轻量 KV 存储
- `isar` ^3.1.0+1 — 高性能本地 DB
- `flutter_markdown` ^0.7.3 — Markdown 渲染
- `file_picker` ^8.0.3 — 文件选取
- `uuid` ^4.3.3 / `intl` ^0.19.0 / `collection` ^1.18.0 — 工具库

### 开发依赖
- `build_runner` + `riverpod_generator` — Provider 代码生成
- `hive_generator` / `isar_generator` — 模型代码生成
- `flutter_lints` — 代码规范

## 常用命令

```bash
# 运行应用
flutter run

# 代码生成（Riverpod/Hive/Isar 注解处理）
dart run build_runner build --delete-conflicting-outputs

# 代码分析
dart analyze

# 运行测试
flutter test

# 运行指定测试
flutter test test/unit/entity_recognizer_test.dart
```

## 键盘快捷键

| 快捷键 | 功能 |
|---|---|
| `Cmd/Ctrl + K` | 命令面板 |
| `Cmd/Ctrl + T` | 模板画廊 |
| `Cmd/Ctrl + D` | 打开今天的日记 |
| `Cmd/Ctrl + B` | 切换侧边栏 |
| `Cmd/Ctrl + Shift + P` | 插件管理 |
| `Escape` | 关闭所有覆盖层 |

## 测试覆盖

```
test/
├── helpers/
│   └── test_helpers.dart         # 测试辅助 (NoteModel 构建、Widget 包裹)
└── unit/
    ├── entity_recognizer_test.dart  # 实体识别 (本地策略、混合内容、边界条件)
    ├── editor_service_test.dart     # 编辑器服务 (字数统计、Markdown 操作、链接提取)
    ├── predictive_link_test.dart    # 预测链接 (相似度计算、标签匹配、边界条件)
    ├── plugin_registry_test.dart    # 插件注册表 (生命周期、事件、聚合)
    └── sidebar_state_test.dart      # 侧边栏状态 (视图切换、树节点、copyWith)
```

## 待完善

- [ ] Isar 向量索引接通 (语义搜索)
- [ ] 远程 LLM 实体识别实际 API 调试
- [ ] 更多内置插件 (日历、Pomodoro、Mermaid 图表)
- [ ] Widget 测试覆盖
- [ ] 国际化 (i18n) 支持
- [ ] Web 端适配优化

## UI 语言

界面文案和代码注释均使用**中文**。
