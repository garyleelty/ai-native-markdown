# Spec: Bugfix Round 4 — 测试修复 + 代码质量改进

## Why（为什么做）

1. **Widget 测试失败**：当前 widget_test.dart 未初始化 Hive，导致插件激活失败，应用无法正常渲染，测试无法通过。
2. **Deprecated API 警告**：代码中大量使用 `withOpacity()` 和 `activeColor` 等已废弃的 API，未来 Flutter 版本可能移除，需要提前迁移。
3. **代码质量**：存在 dangling library doc comments、use_build_context_synchronously、prefer_const_constructors 等 lint 提示，影响代码整洁度。

## What Changes（改什么）

### Fix 1: 修复 Widget Test
- 在 widget_test.dart 中添加 Hive 初始化（使用测试环境兼容的方式）
- 确保应用在测试环境中能正常构建和渲染

### Fix 2: 迁移 Deprecated API
- 将 `color.withOpacity(x)` 替换为 `color.withValues(alpha: x)`
- 将 Switch 的 `activeColor` 替换为 `activeThumbColor`

### Fix 3: 修复 Lint 警告
- 为有 dangling doc comment 的文件添加 `library` 指令
- 为 use_build_context_synchronously 添加 mounted 检查
- 为可以 const 的构造器添加 const 关键字
- 将字符串拼接改为字符串插值

## Impact（影响范围）

- **测试文件**: `test/widget_test.dart`
- **核心 Widgets**: 
  - `lib/features/mermaid/widgets/`
  - `lib/features/outline/widgets/`
  - `lib/features/plugins/widgets/`
  - `lib/features/quick_switcher/widgets/`
  - `lib/features/settings/widgets/`
  - `lib/features/sidebar/widgets/`
  - `lib/features/sliding_panes/widgets/`
  - `lib/features/templates/widgets/`
  - `lib/providers/`
- **无功能变更**: 仅修复测试、迁移 deprecated API、改进代码风格，不改变任何用户可见功能

## 设计决策

1. **Hive 测试初始化**: 使用 `Hive.init()` 而非 `Hive.initFlutter()` 在测试中初始化，因为测试环境不需要 path_provider。
2. **withOpacity → withValues**: 保持 alpha 值范围一致（0.0-1.0），直接替换即可，无需调整数值。
3. **activeColor → activeThumbColor**: 这是 Flutter 3.31+ 的变更，直接替换属性名即可。
4. **Lint 修复优先级**: 先修复 error/warning 级别问题（虽然当前没有），再修复 deprecated，最后修复风格提示。

## ADDED/MODIFIED Requirements

- R1: `flutter test` 所有测试通过（包括 widget test）
- R2: `dart analyze lib/ test/` 无 error/warning（info 级别可选保留）
- R3: 所有 deprecated member use 警告已修复
- R4: Widget test 能正常构建应用并找到 "AeroMind" 文本
