# Obsidian 风格功能增强（Quick Switcher / 插件设置 UI / 查询增强）Spec

## Why

AeroMind 已具备插件系统骨架、命令面板（Cmd+K）和带前缀语法的搜索服务，但与 Obsidian 相比仍缺少三个高频核心特性：

1. **Quick Switcher（Cmd/Ctrl+O）** — Obsidian 最高频使用的笔记跳转入口，可按模糊匹配快速打开任意笔记，无此特性时用户必须切到侧栏再点击。
2. **插件设置 UI** — `PluginManifest.settings` 已声明 `PluginSettingDef`（含 4 种类型），但插件管理面板只显示开关，无法查看/编辑插件配置，导致内置插件（如字数统计、Markdown 增强）无法被用户调参。
3. **查询能力增强** — `SearchService` 已支持 `title:` / `content:` / `tag:`，但缺 `path:`（Obsidian 标准过滤器）、缺正则搜索（项目 memory 明确要求 `/pattern/` 格式触发）、缺搜索结果高亮（previews 仅纯文本）。

补齐这三项后，"像 Obsidian、有插件功能、查询功能"的产品目标在第一轮 Ralph Loop 中达成可用基线。

## What Changes

### 1. Quick Switcher（快速跳转面板）
- 新增 `lib/features/quick_switcher/` 目录，含：
  - `widgets/quick_switcher_overlay.dart` — 全屏半透明覆盖层，居中搜索框 + 结果列表，VS Code/Obsidian 风格
  - `services/fuzzy_matcher.dart` — 模糊匹配算法（子序列 + 连续匹配加分 + 大小写敏感加分）
- 在 `lib/app.dart` 中：注册 `QuickSwitcherOverlay` 到 Stack，绑定 `Cmd/Ctrl+O` 快捷键
- 在 `lib/features/command_palette/services/command_registry.dart` 中：注册「快速跳转」命令，快捷键 `Cmd/Ctrl+O`，与面板入口一致
- 在 `lib/providers/` 下新增 `quick_switcher_provider.dart`：管理 isOpen、query、results、selectedIndex、recentNoteIds

### 2. 插件设置 UI
- 在 `lib/features/plugins/widgets/plugin_manager_panel.dart` 中：
  - `_PluginTile` 增加「设置」按钮（仅在 `manifest.settings` 非空时显示）
  - 点击后切换到 `_PluginSettingsDetail` 子视图（同一个 Dialog 内，带返回按钮）
- 新增 `lib/features/plugins/widgets/plugin_settings_form.dart`：
  - 根据 `PluginSettingDef.type` 渲染对应输入控件（string→TextField / number→数字 TextField / boolean→Switch / choice→DropdownButton）
  - 读取/写入通过 `PluginStorage`（已有，KV 接口 `getString/putString` 等）
  - 每次修改即时持久化（单次写入，符合工程约定）
- 在 `lib/providers/plugin_provider.dart` 中：扩展 `PluginManagerState` 增加 `selectedPluginId`（详情视图状态），增加 `openSettings(pluginId)` / `closeSettings()` 方法

### 3. 查询能力增强
- 在 `lib/core/services/search_service.dart` 中：
  - `ParsedSearchQuery` 增加 `pathFilter` 字段
  - `parseQuery` 增加 `path:` / `p:` 前缀解析
  - 增加正则模式识别：当整个 query 被一对 `/.../ ` 包裹时（如 `/foo\d+/`），将 keywords 视为正则模式
  - 在 `searchNotes` 中：当检测到正则模式时，使用 `RegExp` 进行匹配（捕获 `FormatException` 回退为字面量搜索）
  - `_buildPreview` 改造：增加 `List<SearchMatch>` 参数，将匹配位置包裹 `<mark>` 标签（在 UI 侧用 `RichText` 渲染），并在结果中加亮关键字
  - 在 `lib/features/sidebar/widgets/sidebar_container.dart` 的 `_SearchView` 中：将 preview 改为支持高亮的 `RichText`/`Text.rich` 渲染
- `lib/core/models/note_model.dart` 已有 `folderPath` 字段（P0 计划确认），无需新增

## Impact

- **Affected specs**: 插件系统（settings 渲染扩展点）、侧边栏（搜索视图高亮渲染）、命令面板（新增「快速跳转」命令）、应用 Shell（绑定 Cmd/Ctrl+O 快捷键）
- **Affected code**:
  - 新增：`lib/features/quick_switcher/**`、`lib/features/plugins/widgets/plugin_settings_form.dart`、`lib/providers/quick_switcher_provider.dart`
  - 修改：`lib/app.dart`、`lib/features/command_palette/services/command_registry.dart`、`lib/features/plugins/widgets/plugin_manager_panel.dart`、`lib/providers/plugin_provider.dart`、`lib/core/services/search_service.dart`、`lib/features/sidebar/widgets/sidebar_container.dart`
- **新测试**：
  - `test/unit/fuzzy_matcher_test.dart`
  - `test/unit/search_service_regex_test.dart`（扩展现有或新建）
  - `test/unit/plugin_settings_test.dart`（验证 PluginStorage 读写）
- **不影响**：实体识别引擎、知识图谱、Sliding Panes、模板系统、日记系统、Mermaid 渲染

## 设计决策（grill-me 自我拷问结论）

1. **Quick Switcher 是否复用命令面板？**
   — 不复用。命令面板是「执行命令」，Quick Switcher 是「打开笔记」，语义不同，且 Obsidian 也是两个独立入口。但共用相同的视觉语言（半透明覆盖层 + 居中对话框 + 键盘导航）。

2. **模糊匹配算法选择？**
   — 自实现子序列匹配 + 加分规则（连续匹配 +1、首字母匹配 +2、大小写完全匹配 +1）。不引入 `fuzzy` 第三方包，避免依赖膨胀，且此规模够用。

3. **结果数量上限？**
   — Quick Switcher 默认展示前 50 条，避免长列表卡顿（符合「分页/限流，禁止全量加载」约定）。

4. **插件设置是否走 PluginApi.getStorage？**
   — 是。`PluginStorage` 已是隔离 KV，直接复用。设置值通过 `storage.getString(key)` 读、`storage.putString(key, value)` 写，单次写入符合工程约定。

5. **正则搜索的触发与边界？**
   — 整个 query 被一对 `/.../ ` 包裹时启用（如 `/foo\d+/`）。`RegExp` 构造失败时回退为字面量搜索并返回所有匹配（不抛异常给用户）。Memory 中已明确要求 `/pattern/` 触发正则。

6. **搜索结果高亮的实现方式？**
   — `SearchResult.preview` 仍返回纯文本（不破坏现有 API），但新增 `List<SearchMatch> matches` 字段已存在；UI 层根据 matches 中的 start/end 在 preview 上构造 `TextSpan`，匹配区间用 `AeroColors.accentYellow` 背景。无需更改 SearchResult 结构。

7. **`path:` 过滤匹配规则？**
   — 子串匹配 `note.folderPath`（已存在字段），不区分大小写。空 `folderPath` 视为根目录，永远匹配空字符串。

8. **Cmd/Ctrl+O 是否冲突？**
   — 当前 `app.dart` 已绑定 Cmd+K（命令面板）/ Cmd+T（模板）/ Cmd+D（日记）/ Cmd+B（侧栏）/ Cmd+Shift+P（插件管理）。Cmd+O 未被占用，无冲突。

9. **是否实现插件市场？**
   — 不在本轮范围。当前内置 4 个插件已足够支撑设置 UI 演示，市场是更大工程，留待后续 Ralph Loop 轮次。

10. **是否实现跨文件搜索替换？**
    — 不在本轮。Obsidian 的全局替换是高级特性，本轮先补齐只读的查询能力与高亮，替换留待后续。

## ADDED Requirements

### Requirement: Quick Switcher 快速跳转面板
系统 SHALL 提供一个可通过 `Cmd/Ctrl+O` 全局快捷键唤起的 Quick Switcher 覆盖层，支持模糊匹配全部笔记的标题/内容并跳转。

#### Scenario: 用户按下 Cmd+O 打开面板
- **WHEN** 用户在应用任意位置按下 `Cmd+O`（macOS）或 `Ctrl+O`（其他平台）
- **THEN** 显示居中半透明覆盖层，搜索框自动获得焦点，结果列表展示最近编辑的笔记（最多 50 条）

#### Scenario: 用户输入查询并选中结果
- **WHEN** 用户在搜索框输入 "flu note"
- **THEN** 列表实时按模糊匹配过滤并按相关度排序，按 `Enter` 打开高亮项的笔记，关闭覆盖层
- **AND** 上一次选中的笔记 ID 被记录到 `recentNoteIds`，下次打开时置顶展示

#### Scenario: 用户在空查询时按下 Escape
- **WHEN** 用户按下 `Escape`
- **THEN** 关闭 Quick Switcher 覆盖层，不修改当前打开的笔记

#### Scenario: 没有匹配结果
- **WHEN** 输入的查询匹配不到任何笔记
- **THEN** 列表显示「未找到匹配的笔记」空状态

#### Scenario: 大量笔记的性能
- **WHEN** 笔记总数超过 1000 条
- **THEN** Quick Switcher 仍能在用户输入后 100ms 内返回前 50 条结果（通过限制结果数 + 同步子序列匹配实现）

### Requirement: 插件设置 UI
系统 SHALL 在插件管理面板中为每个声明了 `settings` 的插件提供「设置」入口，渲染对应输入控件，并即时持久化到隔离的 `PluginStorage`。

#### Scenario: 用户打开某插件的设置详情
- **WHEN** 用户在插件管理面板点击「字数统计」插件的「设置」按钮
- **THEN** 在同一对话框内切换到设置详情子视图，显示该插件声明的所有 `PluginSettingDef` 控件，每个控件显示当前值（从 `PluginStorage` 读取，无值时用 `defaultValue`）

#### Scenario: 用户修改字符串类型设置
- **WHEN** 用户在 `string` 类型输入框中键入文字
- **THEN** 该值通过 `PluginStorage.putString(key, value)` 即时持久化，下次打开仍为此值

#### Scenario: 用户切换布尔类型设置
- **WHEN** 用户切换 `boolean` 类型 Switch
- **THEN** 该值通过 `PluginStorage.putBool(key, value)` 即时持久化

#### Scenario: 用户选择下拉项
- **WHEN** 用户在 `choice` 类型下拉框中选择某项
- **THEN** 该值通过 `PluginStorage.putString(key, value)` 即时持久化

#### Scenario: 用户输入数值类型设置
- **WHEN** 用户在 `number` 类型输入框中键入非数字
- **THEN** 显示红色边框与提示「请输入数字」，不持久化

#### Scenario: 用户从详情返回列表
- **WHEN** 用户点击设置详情左上角「返回」按钮
- **THEN** 返回插件列表视图，保留之前的滚动位置与搜索过滤状态

### Requirement: 查询能力增强（path 过滤 + 正则 + 高亮）
系统 SHALL 在 `SearchService` 中支持 `path:` 前缀过滤、`/pattern/` 正则搜索，并在搜索结果 UI 中高亮匹配片段。

#### Scenario: 用户使用 path: 过滤
- **WHEN** 用户在侧边栏搜索框输入 `path:projects flu`
- **THEN** 仅在 `folderPath` 包含 "projects" 的笔记中搜索 "flu" 关键字

#### Scenario: 用户使用正则搜索
- **WHEN** 用户输入 `/foo\d+/`
- **THEN** 系统按正则模式匹配笔记标题和正文，返回所有匹配位置

#### Scenario: 用户输入非法正则
- **WHEN** 用户输入 `/[invalid/`
- **THEN** 系统回退为字面量搜索 "[invalid"（不抛异常），不破坏搜索功能

#### Scenario: 搜索结果高亮显示
- **WHEN** 用户搜索 "flutter" 并得到结果列表
- **THEN** 每条结果的 preview 文本中所有 "flutter" 出现位置以黄色背景高亮显示

#### Scenario: 正则搜索结果高亮
- **WHEN** 用户输入 `/foo\d+/` 并得到结果
- **THEN** preview 中所有正则匹配的子串以黄色背景高亮

## MODIFIED Requirements

### Requirement: SearchService.parseQuery 解析能力
原 `parseQuery` 支持 `title:` / `content:` / `tag:` 三个前缀，现增加 `path:` / `p:` 前缀。`ParsedSearchQuery` 增加 `pathFilter` 字段。当 query 完全匹配 `/^\/(.+)\/$/` 时，进入正则模式（提取 group(1) 作为 pattern，捕获 `FormatException` 时降级为字面量）。

### Requirement: 插件管理面板交互
原 `_PluginTile` 仅有图标、名称、版本、状态开关。现增加「设置」齿轮按钮（仅当 `manifest.settings.isNotEmpty` 时可见），点击切换到设置详情子视图（在同一 Dialog 内）。`PluginManagerState` 增加 `selectedPluginId` 字段以承载子视图状态。

## REMOVED Requirements

无。本轮仅做加法与增强，不删除任何现有能力。
