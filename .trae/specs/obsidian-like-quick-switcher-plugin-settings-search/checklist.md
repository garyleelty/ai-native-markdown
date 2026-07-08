# Checklist

每条验收项必须可机器或人工核验，pass/fail 二元判定。

## Quick Switcher

- [x] `lib/features/quick_switcher/services/fuzzy_matcher.dart` 存在，导出 `FuzzyMatcher` 类与 `FuzzyMatchResult` 数据类
- [x] `FuzzyMatcher.match(query, notes)` 返回按 score 降序的 `List<FuzzyMatchResult>`，长度 ≤ 50
- [x] 空查询返回空列表（不抛异常）
- [x] 无匹配时返回空列表
- [x] 大小写完全匹配的得分高于仅大小写不敏感匹配
- [x] 连续字符匹配的得分高于非连续匹配
- [x] 标题匹配权重 ≥ 3 × 正文匹配权重
- [x] `test/unit/fuzzy_matcher_test.dart` 存在并通过 `flutter test test/unit/fuzzy_matcher_test.dart`
- [x] `lib/providers/quick_switcher_provider.dart` 存在，导出 `QuickSwitcherNotifier` 与 `quickSwitcherProvider`
- [x] `QuickSwitcherState` 包含 `isOpen`、`query`、`results`、`selectedIndex`、`recentNoteIds` 字段
- [x] `open()` 将 `isOpen` 设为 true 并清空 query
- [x] `setQuery(q)` 重新计算 results 并将 `selectedIndex` 重置为 0
- [x] `moveSelection(delta)` 在 results 范围内循环移动
- [x] `lib/features/quick_switcher/widgets/quick_switcher_overlay.dart` 存在，导出 `QuickSwitcherOverlay`
- [x] Overlay 在 `isOpen=false` 时返回 `SizedBox.shrink()`
- [x] Overlay 顶部有搜索框，自动获得焦点
- [x] 列表项展示笔记标题 + folderPath 副标题
- [x] ↑/↓ 键移动选中项，Enter 选中并关闭，Escape 关闭
- [x] 空结果状态显示「未找到匹配的笔记」
- [x] `lib/app.dart` 的 Stack 顶层包含 `QuickSwitcherOverlay()`
- [x] `Cmd+O`（macOS）/ `Ctrl+O`（其他）快捷键触发 `quickSwitcherProvider.notifier.open()`
- [x] `command_registry.dart` 中注册了 `nav.quickSwitcher` 命令（shortcut 为 null，避免与 `note.open` 的 Ctrl+O 重复显示；实际快捷键由 `note.open` 提供并由 app.dart 的键盘处理器触发）

## 插件设置 UI

- [x] `lib/providers/plugin_provider.dart` 中 `PluginManagerState` 含 `selectedPluginId` 字段（可空）
- [x] `PluginManagerState.copyWith` 接受 `selectedPluginId` 参数
- [x] `PluginManagerNotifier` 含 `openSettings(String pluginId)` 与 `closeSettings()` 方法
- [x] `lib/features/plugins/widgets/plugin_settings_form.dart` 存在，导出 `PluginSettingsForm` Widget
- [x] `PluginSettingsForm` 接受 `PluginManifest` + `PluginStorage` 入参
- [x] `string` 类型渲染为 TextField，初始值来自 `storage.getString(key) ?? defaultValue`
- [x] `number` 类型渲染为数字 TextField，非数字输入时显示红边框 + 「请输入数字」提示
- [x] `boolean` 类型渲染为 Switch，初始值来自 `storage.getBool(key) ?? defaultValue`
- [x] `choice` 类型渲染为 DropdownButton<String>，choices 来自 `PluginSettingDef.choices`
- [x] 每个控件改动后通过 `PluginStorage` 即时持久化（单次写入，不重复写）
- [x] `manifest.settings` 为空时显示「此插件无可配置项」
- [x] `plugin_manager_panel.dart` 中 `_PluginTile` 在 `manifest.settings.isNotEmpty` 时显示齿轮按钮
- [x] 点击齿轮按钮调用 `openSettings(manifest.id)`
- [x] `state.selectedPluginId != null` 时切换到 `_PluginSettingsDetail` 子视图
- [x] 详情视图左上角有「← 返回」按钮，点击调用 `closeSettings()`
- [x] 详情视图标题显示插件名 + 版本号
- [x] `test/unit/plugin_settings_test.dart` 存在并通过 `flutter test test/unit/plugin_settings_test.dart`
- [x] 测试使用真实 `PluginStorage` 实现（不 mock）

## 查询能力增强

- [x] `ParsedSearchQuery` 含 `pathFilter` 字段（String?）
- [x] `parseQuery('path:projects flu')` 返回的 `pathFilter == 'projects'` 且 keywords 含 'flu'
- [x] `parseQuery('p:docs hello')` 等价于 `path:docs hello`
- [x] `ParsedSearchQuery` 含 `isRegex` 与 `regexPattern` 字段
- [x] `parseQuery('/foo\\d+/')` 返回 `isRegex == true` 且 `regexPattern == 'foo\\d+'`
- [x] `parseQuery('/foo')` 不进入正则模式（不匹配 `^\/(.+)\/$` 整体模式）
- [x] `searchNotes` 在 `pathFilter` 非空时仅匹配 `folderPath` 含该值的笔记（不区分大小写）
- [x] `searchNotes` 在正则模式下用 `RegExp` 匹配标题和正文
- [x] 非法正则（如 `/[invalid/`）被捕获 `FormatException`，降级为字面量搜索
- [x] 正则模式匹配的 matches 字段包含所有 RegExpMatch 位置
- [x] `test/unit/search_service_regex_test.dart` 存在并通过 `flutter test test/unit/search_service_regex_test.dart`
- [x] 测试覆盖：path 过滤、正则匹配、非法正则降级、路径与正则组合
- [x] `sidebar_container.dart` 的 `_SearchView` 中 preview 用 `Text.rich` 渲染
- [x] preview 中匹配片段以 `AeroColors.accentYellow.withOpacity(0.3)` 背景高亮
- [x] 高亮位置正确（基于 matches 字段中的 start/end 重新定位到 preview 子串）
- [x] 正则模式下的匹配片段也被高亮

## 集成与回归

- [x] `dart analyze lib/` 输出 0 errors（warnings 可接受）
- [x] 应用启动后 `Cmd+O` 能正常唤起 Quick Switcher
- [x] 插件管理面板中「字数统计」插件（已声明 settings）显示齿轮按钮
- [x] 侧边栏搜索框输入 `path:` 前缀能正确过滤
- [x] 侧边栏搜索框输入 `/foo\d+/` 能触发正则匹配
- [x] 既有 `title:` / `content:` / `tag:` 语法不受影响（向后兼容）
- [x] 既有 `Cmd+K` / `Cmd+T` / `Cmd+D` / `Cmd+B` / `Cmd+Shift+P` 快捷键不受影响
- [x] 既有插件管理面板开关、搜索过滤功能不受影响
