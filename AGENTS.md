# AGENTS.md

Flutter 应用 `aeromind`（AI Native Markdown 笔记）。界面文案与代码注释均使用**中文**。三层 feature-based 架构 + 插件系统，状态管理用 Riverpod（手写 `NotifierProvider`，无代码生成注解）。

## 常用命令

```bash
dart analyze                  # 全量分析
dart analyze lib/             # CI analyze 步骤实际只跑 lib/
flutter test                  # 全部测试
flutter test test/unit/entity_recognizer_test.dart   # 单个测试文件
dart run build_runner build --delete-conflicting-outputs   # CI 会跑，但当前为 no-op
```

验证顺序：改代码后先 `dart analyze` 再 `flutter test`。**不要只依赖 CI**——CI 的 test 步骤是 `flutter test --coverage || true`，测试失败不会让 CI 变红。

## Riverpod 生命周期红线（最容易踩坑）

- `dispose()` 中**禁用 `ref.read` / `ref.watch`**，会抛 `StateError: Cannot use "ref" after the widget was disposed`。如需在 dispose 写状态，在 `initState` 捕获 notifier 对象（`final n = ref.read(xxxProvider.notifier);`）后调用其方法。
- `initState` 中**禁用 `ref.listen`**：debug 下断言崩溃，release 下监听器在首次 build 时被静默清除。改用 `ref.listenManual`。
- 这两个约束都有对应测试（`test/widget/command_palette_*`、`test/widget/sliding_panes_title_draft_test.dart`），违规会被发现。

## 文件头注释约定

新增文件头 `/// ════` 横幅注释后必须紧跟 `library;`，否则 `dangling_library_doc_comments` 告警。

## CI / 构建陷阱

- `flutter build --release` 默认启用图标字体 tree-shaking，而插件/模板用动态 `IconData(codePoint, fontFamily: 'MaterialIcons')`（`plugin_api_impl.dart`、`plugin_manager_panel.dart`、`template_gallery.dart`）会直接构建失败。CI 三个桌面平台构建命令都加了 `--no-tree-shake-icons`。**`dart analyze` 发现不了此问题**。
- 添加新插件/模板图标时，避免新增动态 `IconData` 的构建期陷阱（改回需要重新加 flag 或改为常量图标）。

## 架构要点（已验证，勿信过时文档）

- **实体类型只有 5 种**：`concept / person / task / quote / reference`（`core/models/note_model.dart`）。本地识别规则 7 条，其中 3 条映射到 concept。`CLAUDE.md` 写「7 种实体类型」是过时的。
- **存储**：Hive 是真实存储（box：`notes/meta/versions/trash/plugin_*`）。Isar 依赖已声明但**未接通**；`NoteRepository.searchBySemantic` 是 Hive 全量遍历 + 子串匹配，非向量检索。
- **AI 对话的 LLM 配置**存在插件存储（`plugin_com.aeromind.ai-chat` box），与设置页 AI 区的全局 LLM 配置（用于远程实体识别）相互独立。
- **面板/编辑器状态已提升到 Provider**（`paneStackProvider`、`editorSessionProvider`、`aiChatProvider`）：标题草稿实时同步到 PaneState，撤销/重做按 noteId 隔离（每笔记上限 100 条）。面板最多 2 个可见，超出自动堆叠。
- **Web 端限制**：远程 LLM 不可用（`llm_client_factory` 回退实现）、Git 备份全部禁用。
- 插件注册在 `app.dart` 的 `_initPlugins()`（5 个内置插件 + `PluginApiImpl`）。
- 最新能力文档见 `docs/`（基于代码核对）；`CLAUDE.md` 部分内容（依赖版本、实体数量）过时，以代码为准。

## 测试

- `test/helpers/test_helpers.dart` 提供 `createTestNote` 等构建工具。
- 插件相关单测用**真实 Hive**（`plugin_registry_test.dart`、`plugin_settings_test.dart`）。
- 覆盖重点：实体识别、编辑器服务、预测链接、插件注册表/存储、命令注册、模糊匹配、搜索正则、sidebar/pane/editor_session 状态。