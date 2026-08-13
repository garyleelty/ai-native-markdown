# AeroMind — AI Native 笔记应用

> Sliding Panes + 实体识别 + 语义上下文 + 插件系统的智能 Markdown 笔记系统

[![Build Desktop Apps](https://github.com/garyleelty/ai-native-markdown/actions/workflows/build.yml/badge.svg)](https://github.com/garyleelty/ai-native-markdown/actions/workflows/build.yml)

---

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [用例图 (Use Case View)](#用例图-use-case-view)
- [4+1 架构视图](#41-架构视图)
  - [逻辑视图 (Logical View)](#逻辑视图-logical-view)
  - [进程视图 (Process View)](#进程视图-process-view)
  - [开发视图 (Development View)](#开发视图-development-view)
  - [物理视图 (Physical View)](#物理视图-physical-view)
  - [场景视图 (Scenarios)](#场景视图-scenarios)
- [快速开始](#快速开始)
- [插件系统](#插件系统)
- [技术栈](#技术栈)
- [常用命令](#常用命令)
- [键盘快捷键](#键盘快捷键)
- [项目结构](#项目结构)

---

## 项目简介

AeroMind 是一款受 Obsidian 启发的 AI Native Markdown 笔记应用，基于 Flutter 构建。核心理念是 **Sliding Panes（横向滑动面板）+ 实体识别 + 语义上下文 + 插件系统**，让笔记不仅是文本容器，而是可被 AI 理解、可被插件扩展、可被知识图谱连接的智能知识网络。

---

## 核心特性

| 特性 | 说明 |
|---|---|
| **Sliding Panes** | Andy Matuschak 风格横向滑动面板，支持多笔记并排浏览与编辑 |
| **三模式编辑器** | Source（源码）/ Live Preview（实时预览）/ Preview（只读）三种模式 |
| **AI 实体识别** | 自动识别 wiki links、blockquote、@人物、#标签、任务、数学公式、时间戳 7 类实体 |
| **Quick Switcher** | Obsidian 风格快速切换器，模糊匹配笔记标题，`Cmd/Ctrl + O` 唤起 |
| **全文搜索** | 支持正则表达式（`/pattern/` 格式）、路径过滤、标签过滤 |
| **知识图谱** | 力导向布局可视化笔记间的 wiki link 关系 |
| **模板系统** | 6 个内置模板（日记/会议/读书笔记等）+ 自定义模板 |
| **日记系统** | 按日创建笔记 + 日历视图导航 |
| **版本历史** | 笔记快照版本管理，可回溯历史版本 |
| **插件系统** | 10 类扩展点（命令/实体识别/内容处理/搜索增强/导出/导入/AI/主题等）|
| **内置插件** | 字数统计、Markdown 格式化增强、多格式导出（TXT/HTML/JSON）|
| **Mermaid 图表** | 内置 Mermaid 语法渲染 |
| **Wiki Link 补全** | 输入 `[[` 时自动补全笔记名，支持上下键选择 |
| **Local-First** | 数据本地优先，Hive KV + 文件系统存储，离线可用 |

---

## 用例图 (Use Case View)

```
                              ┌─────────────────────────────────────────┐
                              │              AeroMind 系统               │
                              │                                         │
   ┌────────┐   创建/编辑笔记  ┌─────────────┐  搜索笔记   ┌────────────┐ │
   │        │────────────────→│  笔记编辑    │←───────────│  全文搜索   │ │
   │        │   切换编辑模式   │  (三模式)    │            └────────────┘ │
   │        │────────────────→└─────────────┘                            │
   │        │                                                             │
   │  知识  │   快速切换笔记  ┌─────────────┐  应用模板   ┌────────────┐ │
   │  工作者 │────────────────→│ Quick Switcher│←───────────│  模板系统   │ │
   │        │                 └─────────────┘            └────────────┘ │
   │        │                                                             │
   │        │   创建日记    ┌─────────────┐  查看图谱   ┌────────────┐  │
   │        │──────────────→│  日记系统    │            │  知识图谱   │  │
   │        │               └─────────────┘            └────────────┘  │
   │        │←─────────────────────────────────────────────────────────→│
   │        │                     查看反向链接 / 大纲                      │
   │        │                                                             │
   │        │   安装/管理插件  ┌─────────────┐  配置插件   ┌────────────┐ │
   │        │────────────────→│  插件管理    │←───────────│  插件设置   │ │
   │        │                 └─────────────┘            └────────────┘ │
   │        │                                                             │
   │        │   命令面板    ┌─────────────┐                               │
   │        │──────────────→│ 命令面板     │                               │
   │        │               └─────────────┘                               │
   └────────┘                                                             │
                              │  版本历史    ┌─────────────┐               │
                              │──────────────→│  版本管理    │               │
                              │              └─────────────┘               │
                              │  导入/导出   ┌─────────────┐               │
                              │──────────────→│ 导入/导出    │               │
                              │              └─────────────┘               │
                              └─────────────────────────────────────────────┘

   ┌────────┐
   │ 插件   │   开发插件        ┌─────────────┐
   │ 开发者  │─────────────────→│  插件 SDK    │ (BasePlugin + PluginApi + PluginRegistry)
   │        │                   └─────────────┘
   └────────┘   注册扩展点      ┌─────────────┐
                ───────────────→│  10 类扩展点  │
                                └─────────────┘
```

### 用例清单

| Actor | 用例 | 说明 |
|---|---|---|
| 知识工作者 | 创建/编辑笔记 | 三模式编辑器，实时预览 Markdown |
| 知识工作者 | 切换编辑模式 | Source / Live Preview / Preview 三种模式 |
| 知识工作者 | 快速切换笔记 | Quick Switcher 模糊匹配，`Cmd+O` 唤起 |
| 知识工作者 | 全文搜索 | 支持正则、路径过滤、标签过滤 |
| 知识工作者 | 应用模板 | 从模板画廊选择模板创建笔记 |
| 知识工作者 | 创建日记 | 按日创建，`Cmd+D` 打开今日日记 |
| 知识工作者 | 查看知识图谱 | 力导向布局可视化笔记关联 |
| 知识工作者 | 查看反向链接 | 显示引用当前笔记的所有笔记 |
| 知识工作者 | 查看大纲 | 自动提取笔记标题层级大纲 |
| 知识工作者 | 版本历史 | 查看历史快照，回溯笔记变更 |
| 知识工作者 | 导入/导出 | 支持 TXT / HTML / JSON 格式 |
| 知识工作者 | 命令面板 | `Cmd+K` 唤起，执行所有命令 |
| 知识工作者 | 管理/配置插件 | 启用/禁用插件，配置插件设置 |
| 知识工作者 | Wiki Link 补全 | 输入 `[[` 自动补全笔记名 |
| 插件开发者 | 开发插件 | 继承 `BasePlugin`，实现扩展点接口 |
| 插件开发者 | 注册扩展点 | 通过 `PluginManifest` 声明扩展类型 |

---

## 4+1 架构视图

### 逻辑视图 (Logical View)

逻辑视图描述系统的功能分解与模块职责。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          AeroMind 逻辑架构                              │
│                                                                         │
│  ┌─────────────────── Presentation Layer ──────────────────────────┐   │
│  │                                                                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │  App Shell │  │ Sidebar  │  │  Editor  │  │  Panes   │       │   │
│  │  │ (app.dart)│  │Container │  │ NotePanel│  │Container │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │   │
│  │                                                                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │ Quick    │  │ Command  │  │ Template │  │  Graph   │       │   │
│  │  │ Switcher │  │ Palette  │  │ Gallery  │  │  Canvas  │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │   │
│  │                                                                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │ Plugin   │  │ Settings │  │ Import/  │  │ Daily    │       │   │
│  │  │ Manager  │  │  Page    │  │ Export   │  │ Notes    │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────── Business Logic Layer ────────────────────────┐   │
│  │                                                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │   │
│  │  │  AI Engine   │  │ Editor       │  │ Template     │         │   │
│  │  │  Entity      │  │ Service      │  │ Service      │         │   │
│  │  │  Recognizer  │  │ (自动保存/    │  │ (6 模板)     │         │   │
│  │  │ (local/      │  │  Markdown)   │  │              │         │   │
│  │  │  remote/     │  └──────────────┘  └──────────────┘         │   │
│  │  │  hybrid)     │                                              │   │
│  │  └──────────────┘  ┌──────────────┐  ┌──────────────┐         │   │
│  │                    │ Search       │  │ Predictive   │         │   │
│  │  ┌──────────────┐  │ Service      │  │ Link Service │         │   │
│  │  │ Graph Layout │  │ (正则/路径/  │  │ (TF-IDF)     │         │   │
│  │  │ (力导向)      │  │  标签过滤)   │  │              │         │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────── Plugin System ──────────────────────────────┐   │
│  │                                                                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │  Base    │  │ Plugin   │  │ Plugin   │  │ Plugin   │       │   │
│  │  │  Plugin  │  │ Manifest │  │ API      │  │ Registry │       │   │
│  │  │ (抽象类)  │  │ (清单)    │  │ (宿主API) │  │ (生命周期)  │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │   │
│  │                                                                 │   │
│  │  10 类扩展点: command, entityRecognizer, contentProcessor,     │   │
│  │  searchEnhancer, sidebarPanel, statusBarItem, exporter,        │   │
│  │  importer, aiProvider, themeExtension                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────── Data Layer ─────────────────────────────────┐   │
│  │                                                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │   │
│  │  │ Note         │  │ HiveService  │  │ FileService  │         │   │
│  │  │ Repository   │  │ (KV 存储)     │  │ (文件系统)    │         │   │
│  │  │ (Hive)       │  │              │  │              │         │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘         │   │
│  │                                                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐                          │   │
│  │  │ Plugin       │  │ Version      │                          │   │
│  │  │ Storage      │  │ Service      │                          │   │
│  │  │ (每插件隔离)  │  │ (版本快照)    │                          │   │
│  │  └──────────────┘  └──────────────┘                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 进程视图 (Process View)

进程视图描述系统的并发结构、进程/线程模型与通信机制。

```
┌─────────────────────────────────────────────────────────────────┐
│                    Flutter 单进程多线程模型                       │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Main Isolate (UI 线程)                                   │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │  Widget Tree │  │  Riverpod   │  │  Event Loop │       │ │
│  │  │  渲染管线    │  │  Providers  │  │  (Microtask │       │ │
│  │  │  (60fps)    │  │  (响应式状态) │  │   + Timer)  │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  Debounce Timers (防抖)                              │ │ │
│  │  │  • 实体识别: 500ms                                    │ │ │
│  │  │  • 自动保存: 2000ms                                   │ │ │
│  │  │  • Wiki Link 补全: 200ms                              │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  Hardware Keyboard Handler (全局快捷键)               │ │ │
│  │  │  • Cmd+O: Quick Switcher                              │ │ │
│  │  │  • Cmd+K: 命令面板                                    │ │ │
│  │  │  • Cmd+T: 模板画廊                                    │ │ │
│  │  │  • Cmd+D: 今日日记                                    │ │ │
│  │  │  • Cmd+B: 切换侧边栏                                  │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Async I/O (Future-based, 非阻塞)                         │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │ Hive        │  │ File I/O    │  │ HTTP        │       │ │
│  │  │ LazyBox     │  │ (笔记文件)   │  │ (远程 LLM)  │       │ │
│  │  │ 读写         │  │              │  │              │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  事件流 (Stream / Listener)                               │ │
│  │                                                           │ │
│  │  Plugin Events ──→ PluginRegistry ──→ 插件钩子             │ │
│  │  Note Events ────→ PluginApi ──────→ onNoteSaved 等       │ │
│  │  Pane Events ────→ PluginApi ──────→ onPaneStackChanged   │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**关键并发策略**：
- **单 Isolate 模型**：所有 UI 和业务逻辑运行在 Main Isolate，避免跨 Isolate 通信开销
- **非阻塞 I/O**：Hive / File / HTTP 均使用 Future，不阻塞 UI 线程
- **Debounce 防抖**：实体识别（500ms）、自动保存（2000ms）、Wiki Link 补全（200ms）
- **事件驱动**：插件系统通过事件监听器（`onNoteOpened`/`onNoteSaved`/`onPaneStackChanged`）解耦

### 开发视图 (Development View)

开发视图描述代码组织、模块分层与依赖关系。

```
ai-native-markdown/
├── lib/
│   ├── main.dart                         # 入口 (Hive 初始化 + 插件注册)
│   ├── app.dart                          # App Shell
│   │
│   ├── core/                             # 共享层 (无业务依赖)
│   │   ├── models/                       # NoteModel, PredictiveLink, EntityType
│   │   ├── services/                     # FileService, HiveService, SearchService
│   │   ├── plugin/                       # 插件系统核心
│   │   │   ├── plugin_manifest.dart      # 插件清单
│   │   │   ├── base_plugin.dart          # 抽象基类 + 生命周期钩子
│   │   │   ├── plugin_api.dart           # 宿主 API 接口
│   │   │   ├── plugin_registry.dart      # 注册表 + 生命周期管理
│   │   │   └── plugin_storage.dart       # 隔离 KV 存储
│   │   ├── builtin_plugins/              # 内置插件
│   │   │   ├── word_count_plugin.dart
│   │   │   ├── markdown_enhance_plugin.dart
│   │   │   └── export_plugin.dart
│   │   └── theme/                        # AeroColors + AeroTheme
│   │
│   ├── features/                         # 功能模块 (feature-based)
│   │   ├── sliding_panes/                # Sliding Panes 容器
│   │   ├── editor/                       # 编辑器 (三模式 + 实体高亮)
│   │   │   ├── widgets/
│   │   │   │   ├── note_panel.dart       # 主编辑面板
│   │   │   │   ├── entity_text_editor.dart
│   │   │   │   ├── live_markdown_editor.dart
│   │   │   │   ├── wiki_link_completer.dart   # [[ 补全
│   │   │   │   ├── wiki_link_preview.dart     # 悬浮预览
│   │   │   │   └── version_history_panel.dart
│   │   │   └── services/
│   │   │       ├── editor_service.dart   # 字数统计/Markdown操作/自动保存
│   │   │       └── syntax_highlighter.dart
│   │   ├── ai_engine/                    # 实体识别引擎
│   │   │   └── services/
│   │   │       ├── entity_recognizer.dart     # local/remote/hybrid 策略
│   │   │       ├── llm_client_factory.dart
│   │   │       └── llm_client_{io,web}.dart   # 平台适配
│   │   ├── knowledge_graph/              # 知识图谱 (力导向布局)
│   │   ├── quick_switcher/               # Quick Switcher (模糊匹配)
│   │   ├── command_palette/              # VS Code 风格命令面板
│   │   ├── templates/                    # 模板引擎 (6 内置 + 自定义)
│   │   ├── daily_notes/                  # 日记系统 (按日 + 日历)
│   │   ├── sidebar/                      # 侧边栏 (树/搜索/标签/最近/插件/回收站)
│   │   ├── plugins/                      # 插件管理面板 + 设置表单
│   │   ├── backlinks/                    # 反向链接面板
│   │   ├── outline/                      # 大纲面板
│   │   ├── mermaid/                      # Mermaid 图表渲染
│   │   ├── import_export/                # 导入/导出
│   │   ├── settings/                     # 设置页
│   │   ├── calendar/                     # 日历视图
│   │   └── help/                         # 欢迎页 + 快捷键速查
│   │
│   ├── providers/                        # Riverpod 状态管理
│   │   ├── note_provider.dart            # NoteRepository + LocalNoteRepository
│   │   ├── pane_provider.dart            # PaneStackNotifier 面板栈
│   │   ├── ai_provider.dart              # 实体缓存 + AI 上下文 + 预测链接
│   │   ├── graph_provider.dart           # 知识图谱状态
│   │   ├── command_provider.dart         # 命令面板状态
│   │   ├── template_provider.dart        # 模板画廊 + 日记服务
│   │   ├── sidebar_provider.dart         # 侧边栏状态
│   │   ├── plugin_provider.dart          # 插件管理状态
│   │   ├── quick_switcher_provider.dart  # Quick Switcher 状态
│   │   └── settings_provider.dart        # 设置状态
│   │
│   └── examples/
│       └── hello_plugin.dart             # 插件开发示例
│
├── test/
│   ├── helpers/
│   │   └── test_helpers.dart
│   └── unit/
│       ├── entity_recognizer_test.dart
│       ├── editor_service_test.dart
│       ├── predictive_link_test.dart
│       ├── plugin_registry_test.dart
│       └── sidebar_state_test.dart
│
├── macos/                                # macOS 原生配置
├── windows/                              # Windows 原生配置
├── linux/                                # Linux 原生配置
├── web/                                  # Web 配置
├── .github/workflows/build.yml           # CI: 分析 + 测试 + 三平台构建
└── pubspec.yaml
```

**分层依赖规则**：
```
Presentation (features/*/widgets)
        │
        ▼
Business Logic (features/*/services + providers)
        │
        ▼
Core (core/models + core/services + core/plugin)
        │
        ▼
Data (Hive + File System + Isar)
```

- `core/` 不依赖 `features/` 和 `providers/`
- `features/` 不直接依赖彼此（通过 `providers/` 通信）
- `providers/` 依赖 `core/`，被 `features/` 消费

### 物理视图 (Physical View)

物理视图描述部署拓扑与数据存储分布。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户设备 (本地优先)                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Flutter App (编译产物)                                      │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │  跨平台部署                                            │ │   │
│  │  │                                                       │ │   │
│  │  │  • macOS:   .app bundle (ad-hoc 签名)                  │ │   │
│  │  │  • Windows: .exe + DLL bundle                          │ │   │
│  │  │  • Linux:   bundle (tar.gz)                            │ │   │
│  │  │  • Web:     SPA (PWA 可选)                             │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────── 本地存储 ─────────────────────────────┐  │
│  │                                                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │  │
│  │  │  Hive KV     │  │  文件系统     │  │  Isar (待接通) │      │  │
│  │  │              │  │              │  │              │      │  │
│  │  │  • 笔记元数据 │  │  • .md 文件  │  │  • 向量索引   │      │  │
│  │  │  • 插件存储   │  │  • 原始内容   │  │  • 语义搜索   │      │  │
│  │  │  • 版本快照   │  │              │  │              │      │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (可选, hybrid 策略)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    远程 AI 服务 (可选)                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  OpenAI 兼容 API                                              │   │
│  │  • 远程实体识别 (LLM)                                         │   │
│  │  • 混合策略: local + remote 结果合并去重                      │   │
│  │  • 仅在用户配置 remote 策略时启用                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

CI/CD 部署:
┌─────────────────────────────────────────────────────────────────────┐
│  GitHub Actions                                                      │
│  • push → main/master/empty-branch → 触发构建                        │
│  • analyze (ubuntu) → build macOS/Windows/Linux                      │
│  • 产物: zip/tar.gz → Artifacts (30 天保留)                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 场景视图 (Scenarios)

选取 4 个关键场景串联所有视图。

#### 场景 1: 用户编辑笔记并自动保存

```
用户输入文本
    │
    ▼
TextField.onChanged / _onControllerTextChanged
    │
    ▼
_onTextChanged(text)
    │
    ├──→ _addToHistory()          [撤销/重做栈]
    ├──→ _triggerEntityRecognition()  [AI 引擎, 500ms debounce]
    ├──→ _autoSave(text)          [2s debounce Timer]
    ├──→ updateOutline()          [侧边栏大纲]
    └──→ _checkWikiLinkTrigger()  [Wiki Link 补全]

用户切换笔记 (2s 内)
    │
    ▼
NotePanel.dispose()
    │
    ▼
_hasUnsavedChanges == true?
    │
    ├── Yes → _doSave(text)       [fire-and-forget 保存]
    │            │
    │            ▼
    │           repo.saveNote()   [Hive KV]
    │            │
    │            ▼
    │           VersionService.saveSnapshot()  [版本快照]
    │
    └── No  → _autoSaveTimer.cancel()
```

**涉及视图**: 逻辑视图（EditorService）、进程视图（Debounce Timer）、开发视图（note_panel.dart）、物理视图（Hive 本地存储）

#### 场景 2: 用户通过 Quick Switcher 打开笔记

```
用户按 Cmd+O
    │
    ▼
HardwareKeyboard.addHandler 捕获
    │
    ▼
quickSwitcherProvider.notifier.open()
    │
    ▼
QuickSwitcherOverlay 显示
    │
    ▼
用户输入关键词
    │
    ▼
FuzzyMatcher 匹配笔记标题
    │
    ▼
用户选择笔记 → Enter
    │
    ▼
paneStackProvider.notifier.openNote(noteId)
    │
    ▼
SlidingPanesContainer 新增面板
    │
    ▼
NotePanel(noteId) 创建 + _loadNote()
    │
    ▼
repo.getNote(id) → Hive LazyBox
    │
    ▼
渲染笔记内容 + 触发实体识别
```

#### 场景 3: 插件响应笔记保存事件

```
NotePanel._doSave(text)
    │
    ▼
repo.saveNote(note)
    │
    ▼
PluginApiImpl 触发 onNoteSaved 事件
    │
    ▼
PluginRegistry 遍历已激活插件
    │
    ▼
插件 A (contentProcessor): processContent(markdown, noteId)
    │   └── 返回处理后的内容 (或 null 不修改)
    │
插件 B (word_count): onNoteSaved 回调
    │   └── 更新状态栏字数显示
    │
插件 C (exporter): 记录保存时间
        └── 可选导出备份
```

#### 场景 4: AI 实体识别 (混合策略)

```
用户停止输入 500ms
    │
    ▼
EntityRecognizer.debounceRecognize(text)
    │
    ▼
策略选择:
    │
    ├── local (默认)
    │   └── Regex 识别 7 类实体
    │       [[wiki]] / > quote / @person / #tag / - [ ] task / $math$ / date
    │
    ├── remote (用户配置 API)
    │   └── HTTP POST → OpenAI 兼容 API
    │       └── LLM 返回结构化实体
    │
    └── hybrid (本地 + 远程)
        └── 本地结果 ∪ 远程结果 → 去重
            │
            ▼
        entityCacheProvider.updateEntities()
            │
            ▼
        UI 高亮实体 + 触发插件 onEntitiesRecognized
```

---

## 快速开始

### 环境要求

- Flutter SDK >= 3.2.0 (推荐 stable channel)
- Dart SDK >= 3.2.0 < 4.0.0

### 安装与运行

```bash
# 安装依赖
flutter pub get

# 代码生成 (Riverpod/Hive/Isar 注解处理)
dart run build_runner build --delete-conflicting-outputs

# 运行应用
flutter run

# 指定平台
flutter run -d macos    # macOS
flutter run -d chrome    # Web
```

---

## 插件系统

### 架构

```
BasePlugin (抽象基类)
    ├── PluginManifest (清单描述)
    ├── PluginApi (宿主 API 接口)
    ├── PluginStorage (隔离 KV 存储)
    └── PluginRegistry (生命周期管理)
```

### 生命周期

```
registered → initializing → active → paused → disposed
                               ↑         |
                               └─────────┘ (resume)
```

### 扩展点

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

### 开发插件

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

参考示例: [hello_plugin.dart](lib/examples/hello_plugin.dart)

---

## 技术栈

### 运行时依赖

| 依赖 | 版本 | 用途 |
|---|---|---|
| `flutter_riverpod` | ^2.5.1 | 状态管理 |
| `hive_flutter` | ^1.1.0 | 轻量 KV 存储 |
| `isar` | ^3.1.0+1 | 高性能本地 DB (向量索引，待接通) |
| `flutter_markdown` | ^0.7.3 | Markdown 渲染 |
| `file_picker` | ^8.0.3 | 文件选取 |
| `uuid` / `intl` / `collection` | — | 工具库 |

### 开发依赖

| 依赖 | 用途 |
|---|---|
| `build_runner` + `riverpod_generator` | Provider 代码生成 |
| `hive_generator` / `isar_generator` | 模型代码生成 |
| `flutter_lints` | 代码规范 |

---

## 常用命令

```bash
# 运行应用
flutter run

# 代码生成
dart run build_runner build --delete-conflicting-outputs

# 代码分析
dart analyze lib/

# 运行测试
flutter test

# 运行指定测试
flutter test test/unit/entity_recognizer_test.dart

# 构建 release
flutter build macos --release
flutter build windows --release
flutter build linux --release
```

---

## 键盘快捷键

| 快捷键 | 功能 |
|---|---|
| `Cmd/Ctrl + O` | Quick Switcher 快速切换笔记 |
| `Cmd/Ctrl + K` | 命令面板 |
| `Cmd/Ctrl + T` | 模板画廊 |
| `Cmd/Ctrl + D` | 打开今天的日记 |
| `Cmd/Ctrl + B` | 切换侧边栏 |
| `Cmd/Ctrl + Option/Alt + P` | 插件管理 |
| `Cmd/Ctrl + F` | 搜索 |
| `Cmd/Ctrl + B` (编辑器内) | 加粗 |
| `Cmd/Ctrl + I` (编辑器内) | 斜体 |
| `Cmd/Ctrl + Shift + K` (编辑器内) | 插入链接 |
| `Cmd/Ctrl + Z` / `Cmd/Ctrl + Y` | 撤销 / 重做 |
| `Escape` | 关闭所有覆盖层 |

---

## 项目结构

详见 [开发视图](#开发视图-development-view) 章节。

## UI 语言

界面文案和代码注释均使用**中文**。

## License

MIT
