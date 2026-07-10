# Spec: Round 2 — Bug 修复 + 健壮性改进

## Why（为什么做）

1. **最近笔记标题显示 bug**: `_RecentView` 中点击笔记时传入 `onNoteSelected?.call(noteId, noteId)`，第二个参数应该是笔记标题而不是 ID，会导致面板标题显示错误。
2. **测试隔离问题**: PluginRegistry 是单例，测试之间可能状态污染，需要确保测试后正确重置。
3. **类似问题排查**: 需要检查其他类似的参数传递错误、资源释放问题。

## What Changes（改什么）

### Fix 1: 修复 _RecentView 标题问题
- 将 `_NoteListItem` 的 onTap 回调从 `onNoteSelected?.call(noteId, noteId)` 改为正确传入标题

### Fix 2: 改进测试健壮性
- 确保 widget test 有正确的 tearDown 清理
- 检查 PluginRegistry 是否需要显式重置方法

### Fix 3: 类似问题排查
- 检查其他视图（标签、任务等）是否有类似参数错误
- 检查是否有其他资源未释放问题

## Impact（影响范围）

- `lib/features/sidebar/widgets/sidebar_container.dart`
- `test/widget_test.dart`
- `lib/core/plugin/plugin_registry.dart`（如需添加 reset 方法）

## 设计决策

1. **最小修复原则**: 仅修复发现的具体 bug，不做大规模重构
2. **测试优先**: 先确保所有测试通过，再进行改进
3. **向后兼容**: 不改变现有 API 行为

## ADDED/MODIFIED Requirements

- R1: 最近笔记点击后面板标题显示正确的笔记标题
- R2: 所有测试连续运行也能通过（无状态污染）
- R3: flutter test 全部通过
- R4: dart analyze 无 error/warning
