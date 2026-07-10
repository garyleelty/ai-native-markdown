# Spec: Flutter 代码问题修复 Round 5

## Why

修复 Flutter 项目中的 deprecated API 使用和 lint 警告，提升代码质量并符合最新的 Flutter/Dart 规范。

## What Changes

1. **withOpacity 替换**：将所有 `color.withOpacity(x)` 替换为 `color.withValues(alpha: x)`
2. **Switch activeColor 替换**：将所有 Switch 的 `activeColor` 属性替换为 `activeThumbColor`
3. **library 指令添加**：为指定的 11 个文件在文档注释后添加 `library;` 指令
4. **use_build_context_synchronously 修复**：在 sidebar_container.dart 第 1504 和 1506 行，async 间隙后检查 mounted
5. **prefer_interpolation_to_compose_strings 修复**：在 sidebar_provider.dart 第 335 和 377 行，使用字符串插值代替 + 拼接

## Impact

- 影响范围：lib/ 目录下的多个 Dart 文件
- 不改变任何功能逻辑
- 保持现有代码风格一致
- 不添加任何注释

## ADDED/MODIFIED Requirements

1. 所有 `withOpacity` 调用均替换为 `withValues(alpha: ...)`
2. 所有 Switch 组件的 `activeColor` 属性均替换为 `activeThumbColor`
3. 指定的 11 个文件在文档注释后正确添加 `library;` 指令
4. sidebar_container.dart 中 async 后使用 context 前检查 mounted
5. sidebar_provider.dart 中不再使用 `+` 进行字符串拼接，改用插值
6. 运行 `dart analyze lib/ test/` 无警告和错误

## 设计决策

- 全局搜索替换 withOpacity 和 activeColor，确保不遗漏
- library 指令仅在用户明确列出的文件中添加，不扩大范围
- mounted 检查采用标准的 `if (!mounted) return;` 模式，符合 Flutter 最佳实践
- 字符串插值仅修改用户指出的两行，不做额外改动
