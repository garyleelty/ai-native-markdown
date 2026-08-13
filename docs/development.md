# 开发指南

## 技术栈

### 运行时依赖
- `flutter_riverpod` ^2.6.1 — 状态管理
- `hive_flutter` ^1.1.0 — 轻量 KV 存储
- `isar` ^3.1.0+1 — 本地 DB（已声明，未接通）
- `flutter_markdown` — Markdown 渲染
- `file_picker` — 文件选取
- `uuid` / `intl` / `collection` — 工具库

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

## 测试覆盖

```
test/
├── helpers/
│   └── test_helpers.dart          # 测试辅助（数据构建、Provider override）
├── unit/
│   ├── entity_recognizer_test.dart       # 实体识别（本地规则/混合/偏移/防抖/回退，14 tests）
│   ├── editor_service_test.dart          # 统计/10 种 Markdown 操作/链接提取/AutoSave（28 tests）
│   ├── predictive_link_test.dart         # 相似度评分/标签加分/排除自身/上限
│   ├── plugin_registry_test.dart         # 生命周期/去重/依赖/事件/聚合（10 tests，真实 Hive）
│   ├── plugin_settings_test.dart         # 插件存储读写/隔离/默认值（7 tests，真实 Hive）
│   ├── pane_provider_test.dart           # 编辑器模式持久化（5 tests）
│   ├── editor_session_provider_test.dart # 撤销/重做/会话隔离 + 日历月份（8 tests）
│   ├── command_palette_notifier_test.dart  # 命令去重
│   ├── command_registry_test.dart        # 内置命令无重名
│   ├── fuzzy_matcher_test.dart           # 模糊匹配（6 tests）
│   ├── search_service_regex_test.dart    # 搜索前缀/正则/兼容性（12 tests）
│   ├── sidebar_notifier_test.dart        # 大纲自动加载（2 tests）
│   └── sidebar_state_test.dart           # 默认状态/copyWith/树节点（8 tests）
└── widget/
    ├── command_palette_duplicate_test.dart  # 命令面板无重复命令
    └── command_palette_render_test.dart     # 命令面板渲染
```

## 代码约定

- 界面文案与代码注释均使用**中文**。
- 状态类不可变，通过 `copyWith` 更新。
- **生命周期红线**：
  - `dispose()` 中不可使用 `ref.read`/`ref.watch`（抛 `StateError`）；如需在 dispose 写状态，在 `initState` 捕获 notifier。
  - `initState` 中不可使用 `ref.listen`（仅限 build）；应使用 `ref.listenManual`。
- 修改代码后运行 `dart analyze` 确认无警告，并运行 `flutter test` 确认测试通过。