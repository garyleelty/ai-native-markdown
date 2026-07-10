# 搜索与 UI 修复 Spec

## Why（为什么做）

当前搜索功能和相关 UI 存在以下问题：
1. 侧边栏搜索框的清除按钮仅依赖 onChanged 回调中的 setState，若通过代码调用 controller.clear() 不会触发按钮显示/隐藏更新
2. 搜索无结果时仅显示"0 个结果"，缺少明确的空状态提示
3. 正则搜索语法错误时虽然降级为字面搜索，但用户无感知
4. 各 overlay（命令面板、Quick Switcher）的错误/空状态提示不统一，部分缺少清除按钮和加载错误提示
5. wiki_link_preview.dart 中 `void _show() async` 是反模式，且缺少异常处理

## What Changes（改什么）

### 1. sidebar_container.dart 搜索框修复
- 为 `_SearchViewState._controller` 添加 listener，在 controller 文本变化时调用 setState
- 确保 suffixIcon 清除按钮在输入/清除时实时显示/隐藏

### 2. 搜索无结果提示
- 当 searchQuery 非空、!isSearching 且 searchResults.isEmpty 时，显示明确的"未找到匹配的笔记"空状态
- 保留结果计数显示

### 3. search_service.dart 正则错误降级提示
- 为 `SearchService.searchNotes()` 添加警告信息返回机制
- 正则 FormatException 时除降级为字面搜索外，返回警告提示"正则语法无效，已降级为普通搜索"
- 在 SidebarState 中添加 `searchMessage` 字段存储搜索提示/警告
- UI 层显示搜索提示信息

### 4. Overlay 错误状态完善
- **命令面板 (Command Palette)**:
  - 搜索框添加 suffixIcon 清除按钮（有输入时显示）
  - 保持现有"没有匹配的命令"空状态
- **Quick Switcher**:
  - 搜索框添加 suffixIcon 清除按钮（有输入时显示）
  - 加载笔记失败时显示错误提示"加载笔记失败，请重试"

### 5. wiki_link_preview.dart 异步修复
- 将 `void _show(String linkText, LayerLink layerLink) async` 改为 `Future<void> _show(...)`
- 添加 try-catch 包裹异步操作，防止异常未捕获导致的问题

## Impact（影响范围）

- `lib/features/sidebar/widgets/sidebar_container.dart`
- `lib/core/services/search_service.dart`
- `lib/features/sidebar/models/sidebar_state.dart`
- `lib/providers/sidebar_provider.dart`（需更新 search 方法设置 searchMessage）
- `lib/features/command_palette/widgets/command_palette.dart`
- `lib/features/quick_switcher/widgets/quick_switcher_overlay.dart`
- `lib/features/editor/widgets/wiki_link_preview.dart`

## 设计决策

### Q: 如何传递搜索警告信息？
A: 在 SidebarState 添加 `searchMessage` 字段（String?），由 sidebarProvider 在搜索时设置。理由：最小侵入性，不需要修改 SearchResult 结构，UI 层可直接读取显示。

### Q: controller listener 是否会导致重复 setState？
A: 不会。onChanged 已经会触发 setState，listener 也会触发 setState，但 Flutter 的 setState 是幂等的，同一帧内多次调用只会重绘一次。

### Q: 正则降级后是否仍然执行字面搜索？
A: 是的，保持现有降级逻辑，仅额外返回提示信息告知用户。

### Q: Quick Switcher 加载错误如何处理？
A: 现有代码已 catch 异常，仅需在 catch 中设置错误状态并显示给用户。

## ADDED/MODIFIED Requirements

1. **搜索框清除按钮实时响应**: 输入文字时清除按钮立即出现，点击清除/手动清空时立即消失
2. **搜索无结果提示**: 搜索无结果时显示"未找到匹配的笔记"提示
3. **正则错误提示**: 输入无效正则（如 `/[invalid/`）时，搜索正常执行（字面量匹配）且显示提示"正则语法无效，已降级为普通搜索"
4. **命令面板清除按钮**: 命令面板搜索框有输入时显示清除按钮
5. **Quick Switcher 完善**: Quick Switcher 搜索框有输入时显示清除按钮，加载失败时显示错误提示
6. **WikiLink 预览安全**: _show 方法返回 Future<void> 且有 try-catch 保护
