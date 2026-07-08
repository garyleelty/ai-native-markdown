# Tasks

## 任务总览

本轮 Ralph Loop 分为 3 个互相独立、可并行实现的功能模块。每个模块包含子任务、依赖关系与验证项。

---

## Task 1: Quick Switcher 快速跳转面板

- [x] Task 1.1: 实现模糊匹配器 `lib/features/quick_switcher/services/fuzzy_matcher.dart`
  - 输入：query 字符串 + 候选 NoteModel 列表
  - 输出：按相关度排序的 `List<FuzzyMatchResult>`，每项含 `noteId`、`score`、`matchedRanges`（标题中的匹配区间）
  - 加分规则：连续匹配 +1、首字母匹配 +2、大小写完全匹配 +1、标题命中权重 ×3（高于正文）
  - 上限：返回前 50 条
  - 单元测试 `test/unit/fuzzy_matcher_test.dart`：覆盖空 query、无匹配、大小写敏感、连续匹配加分、超过 50 条截断

- [x] Task 1.2: 实现状态管理 `lib/providers/quick_switcher_provider.dart`
  - State 字段：`isOpen`、`query`、`results`、`selectedIndex`、`recentNoteIds`（最多 10 条）
  - 方法：`open()` / `close()` / `setQuery(q)` / `moveSelection(delta)` / `selectCurrent()` / `addRecent(noteId)`
  - `setQuery` 时调用 FuzzyMatcher 重新计算 results，重置 selectedIndex=0
  - `selectCurrent` 调用 `onNoteSelected` 回调（由 app.dart 注入），关闭面板，记录 recent

- [x] Task 1.3: 实现 UI 覆盖层 `lib/features/quick_switcher/widgets/quick_switcher_overlay.dart`
  - 视觉：与 `CommandPaletteOverlay` 风格一致（VS Code 暗色 + AeroColors）
  - 布局：半透明黑色背景 + 居中 Container（宽 560，高 420，圆角 12）
  - 顶部：搜索框 + 路径提示（当前显示「最近编辑」或「匹配结果 N 条」）
  - 列表：每项展示笔记标题 + folderPath 副标题 + 更新时间
  - 键盘：↑/↓ 移动选择、Enter 选中、Escape 关闭
  - 鼠标：悬停高亮、点击选中
  - 空状态：query 非空但无匹配时显示「未找到匹配的笔记」

- [x] Task 1.4: 集成到 app.dart 与命令注册
  - 在 `lib/app.dart` 的 Stack 顶层添加 `QuickSwitcherOverlay()`
  - 在快捷键监听中添加 `Cmd/Ctrl+O` → 调用 `quickSwitcherProvider.notifier.open()`
  - 注入 `onNoteSelected` 回调：复用现有 `paneProvider` 的打开笔记逻辑
  - 在 `lib/features/command_palette/services/command_registry.dart` 注册「快速跳转」命令（id: `nav.quickSwitcher`, shortcut: `Cmd+O`, category: `CommandCategory.nav`），action 调用 `quickSwitcherProvider.notifier.open()`

## Task 2: 插件设置 UI

- [x] Task 2.1: 扩展插件 Provider 状态 `lib/providers/plugin_provider.dart`
  - `PluginManagerState` 增加 `selectedPluginId` 字段（可空，null 表示列表视图）
  - 增加方法：`openSettings(pluginId)` / `closeSettings()`
  - 修改 `PluginManagerState.copyWith` 接受 `selectedPluginId`

- [x] Task 2.2: 实现设置表单组件 `lib/features/plugins/widgets/plugin_settings_form.dart`
  - 入参：`PluginManifest manifest` + `PluginStorage storage`
  - 根据 `manifest.settings` 渲染对应控件：
    - `string` → TextField（onChanged 即时 putString）
    - `number` → TextField（keyboardType: number, 校验失败显示红边框 + 提示「请输入数字」）
    - `boolean` → Switch（onChanged 即时 putBool）
    - `choice` → DropdownButton<String>（onChanged 即时 putString）
  - 初始值：先读 `storage.getString(key)`，为 null 时用 `defaultValue`
  - 布局：每项一行 label + description 副标题 + 控件，间距 16
  - 无设置项时显示「此插件无可配置项」

- [x] Task 2.3: 集成到插件管理面板 `lib/features/plugins/widgets/plugin_manager_panel.dart`
  - 修改 `_PluginTile`：在开关左侧增加「设置」齿轮 IconButton（仅 `manifest.settings.isNotEmpty` 时显示）
  - 点击齿轮 → `pluginManagerProvider.notifier.openSettings(manifest.id)`
  - `_PluginManagerDialog` 主体改为根据 `state.selectedPluginId` 切换：
    - null → 现有插件列表
    - 非 null → `_PluginSettingsDetail` 子视图
  - `_PluginSettingsDetail`：顶部带「← 返回」按钮 + 插件名 + 版本，主体为 `PluginSettingsForm`
  - 通过 `PluginRegistry.instance.getPlugin(pluginId).manifest` 拿 manifest
  - 通过 `PluginRegistry.instance._storages[pluginId]` 或 `PluginStorage.create(pluginId)` 拿 storage（用 `PluginStorage.create` 保证隔离）

- [x] Task 2.4: 单元测试 `test/unit/plugin_settings_test.dart`
  - 验证 `PluginStorage` 读写各类型值（string/number/boolean/choice）
  - 验证默认值回退逻辑
  - 使用真实 `PluginStorage` 实现（不 mock），符合用户测试偏好

## Task 3: 查询能力增强

- [x] Task 3.1: 扩展 SearchService `lib/core/services/search_service.dart`
  - `ParsedSearchQuery` 增加 `pathFilter` 字段（String?）
  - `parseQuery` 识别 `path:` / `p:` 前缀（与 title/content/tag 同模式）
  - 增加 `isRegex` 标志 + `regexPattern` 字段：当整个 query 完全匹配 `^\/(.+)\/$` 时进入正则模式
  - `searchNotes` 在正则模式下用 `RegExp(pattern)` 匹配（捕获 `FormatException` → 降级为字面量）
  - `searchNotes` 在 `pathFilter` 非空时，先按 `note.folderPath.toLowerCase().contains(pathFilter.toLowerCase())` 过滤候选集

- [x] Task 3.2: 实现搜索结果高亮渲染 `lib/features/sidebar/widgets/sidebar_container.dart`
  - 在 `_SearchView` 中找到结果列表渲染处
  - 将 preview 的 `Text` 改为 `RichText` / `Text.rich`，根据 `SearchResult.matches`（已存在字段）构造 `TextSpan` 列表
  - 匹配区间用 `BackgroundTextSpan`/`TextSpan(style: TextStyle(backgroundColor: AeroColors.accentYellow.withOpacity(0.3)))` 高亮
  - 注意：preview 是已被截断的字符串，matches 中的 start/end 是原始 rawMarkdown 中的位置；需要重新定位到 preview 子串的对应位置（用 `String.indexOf` 找到匹配关键字在 preview 中的索引）

- [x] Task 3.3: 单元测试 `test/unit/search_service_regex_test.dart`
  - `path:projects flu` → 仅匹配 folderPath 含 projects 的笔记
  - `/foo\d+/` → 匹配 "foo123" 不匹配 "foobar"
  - `/[invalid/` → 降级为字面量搜索 "[invalid"
  - 正则模式下 matches 含所有 RegExpMatch 位置
  - 路径过滤与正则可组合

## 修复任务（来自验证阶段）

- [x] Task 4.1: 在 `lib/features/command_palette/services/command_registry.dart` 中注册 `nav.quickSwitcher` 命令
  - 来源 checklist 失败项：「command_registry.dart 中注册了 `nav.quickSwitcher` 命令」
  - 决策：注册新命令（无 shortcut，避免与既有 `note.open` 的 `Ctrl+O` 重复），让命令面板中能搜到「快速跳转」入口
  - 在 `_registerBuiltinCommands` 的 `builtins` 列表中添加：
    - id: `nav.quickSwitcher`
    - name: '快速跳转'
    - icon: Icons.flash_on
    - shortcut: null（不显示，因为 note.open 已有 Ctrl+O）
    - category: CommandCategory.nav
    - description: '模糊搜索并打开笔记 (Ctrl+O)'
  - 在 `app.dart` 的 `_initCommandActions` 的 `bindActions` Map 中添加：
    - `'nav.quickSwitcher': () { ref.read(quickSwitcherProvider.notifier).open(); }`
  - 验证：dart analyze 通过

- [x] Task 4.2: 给 `WordCountPlugin` 的 manifest 添加 settings 声明
  - 来源 checklist 失败项：「插件管理面板中「字数统计」插件（已声明 settings）显示齿轮按钮」
  - 当前 `lib/core/builtin_plugins/word_count_plugin.dart` 的 `PluginManifest` 未声明 settings，齿轮按钮永远不显示
  - 添加 2 个合理的设置项：
    - `includeCodeBlocks` (boolean, default true, label: '包含代码块字数', description: '统计字数时是否包含代码块内容')
    - `minThreshold` (number, default 0, label: '最小显示阈值', description: '字数低于此值时不显示状态栏提示')
  - 注意：实际字数统计逻辑暂不强制读取这些设置（保持现有行为），目的是验证设置 UI 能正确渲染与持久化
  - 验证：dart analyze 通过；插件管理面板中字数统计行显示齿轮按钮

---

# Task Dependencies

- Task 1、Task 2、Task 3 互相独立，可并行实现（三个 sub-agent 同时进行）
- Task 1.1 → Task 1.2 → Task 1.3 → Task 1.4（Quick Switcher 内部串行）
- Task 2.1 → Task 2.3（Provider 改完才能接入 UI）
- Task 2.2 与 Task 2.1 可并行（表单组件无 Provider 依赖）
- Task 3.1 → Task 3.2（先改 Service，再改 UI 渲染）
- Task 3.3 可与 Task 3.2 并行（测试针对 Service 层）

# 并行执行建议

- **Sub-Agent A**：Task 1.1 + 1.2（Quick Switcher 服务层 + Provider）
- **Sub-Agent B**：Task 2.1 + 2.2（插件 Provider 扩展 + 设置表单组件）
- **Sub-Agent C**：Task 3.1 + 3.3（SearchService 扩展 + 测试）

第一轮三 agent 并行后，主 agent 串行完成：
- Task 1.3 + 1.4（Quick Switcher UI + 集成）
- Task 2.3（插件管理面板集成）
- Task 3.2（搜索高亮 UI）
