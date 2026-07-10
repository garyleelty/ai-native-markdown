# AeroMind 生产就绪性审计 Spec

## Why
对 AeroMind Flutter 项目的编辑器、滑动面板和侧边栏系统进行生产就绪性审计，识别可能导致崩溃、内存泄漏、UI 异常和用户体验问题的代码缺陷。

## What Changes
- 审计范围：`lib/features/editor/`、`lib/features/sliding_panes/`、`lib/features/sidebar/`、`lib/providers/`
- 检查 8 类问题：
  1. async 操作缺少 try-catch
  2. Notifier 生命周期问题（dispose、内存泄漏）
  3. Fire-and-forget async 调用（无 await）
  4. async 间隙后缺少 mounted 检查
  5. UI 溢出问题（RenderFlex overflow）
  6. TextField 焦点问题、重建时文本选择丢失
  7. TODO/FIXME/HACK 注释
- 输出结构化问题清单（文件路径、行号、严重度）

## Impact
- 仅生成审计报告，不修改任何代码
- 识别的问题将用于后续修复

## 设计决策
- **严重度分级标准**：
  - Critical: 直接导致应用崩溃、数据丢失的问题
  - High: 内存泄漏、状态不一致、主要功能异常
  - Medium: UI 溢出、焦点问题、用户体验缺陷
  - Low: TODO/FIXME 注释、代码异味
- **搜索策略**：使用正则表达式系统搜索各类问题模式，然后人工验证上下文
- **输出格式**：中文报告，按严重度排序
