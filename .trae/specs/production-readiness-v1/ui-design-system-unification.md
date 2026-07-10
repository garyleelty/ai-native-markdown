# UI 设计系统统一化 - Spec (Round 11)

## Overview
- **Summary**: 统一所有 Overlay 对话框的设计语言，抽取通用组件，消除视觉不一致，让产品看起来像一个精心设计的整体而非拼凑的集合。
- **Purpose**: 经过多轮功能开发，各 Overlay 面板各自实现了遮罩、动画、标题栏、搜索框、关闭按钮等基础元素，样式、颜色、尺寸、交互均不统一，严重影响产品质感。
- **Target Users**: 所有使用 AeroMind 的用户，特别是对 UI 一致性敏感的用户。

## 发现的设计不一致问题

### 1. Overlay 架构不统一
- 已有 `ModalOverlay` 通用组件但几乎未被使用
- 每个 Overlay 各自实现遮罩层 + 动画 + 容器
- 动画曲线/时长不统一
- 遮罩点击关闭行为不统一

### 2. 标题栏样式不统一
| 面板 | 高度 | 背景色 | 关闭按钮 | 底部边框 |
|------|------|--------|----------|----------|
| 命令面板 | 52px（搜索框即标题） | bgElevated | 无独立标题栏 | Divider |
| 快速跳转 | 44px | bgElevated | IconButton 18px | 有 |
| 插件管理 | 44px | bgElevated | IconButton 18px | 有 |
| 模板画廊 | 48px | 透明（与主体同色） | GestureDetector 16px | Divider |
| 设置页 | 44px | bgElevated | IconButton 18px | 有 |
| 快捷键速查 | ~48px（padding） | bgElevated | 无 | 有 |
| 欢迎页 | 渐变 Hero 区 | 蓝紫渐变 | TextButton | 无 |

### 3. 搜索框样式不统一
| 面板 | 样式 | 背景色 | 边框 | 聚焦色 | 高度 |
|------|------|--------|------|--------|------|
| 命令面板 | Row + TextField（无 InputDecoration 边框） | 透明 | 无 | - | 52px |
| 快速跳转 | OutlineInputBorder | bgDeep | 有 | accentCyan | ~36px |
| 插件管理 | OutlineInputBorder | bgDeep | 有 | accentBlue | ~36px |
| 模板画廊 | Container + Row + TextField | bgSurface | 有 | - | 36px |

### 4. 对话框背景色不统一
- 命令面板: `bgElevated`
- 快速跳转: `bgSurface`
- 插件管理: `bgSurface`
- 模板画廊: `bgElevated`
- 设置页: `bgDeep`（外层容器）
- 欢迎页: `bgSurface`
- 快捷键速查: `bgSurface`

### 5. 选中项高亮色不统一
- 命令面板: `accentBlue`
- 快速跳转: `accentCyan`
- 设置页左侧导航: `accentBlue`
- 侧边栏活动栏: 需要确认

### 6. 列表项高度不统一
- 命令面板: 44px
- 快速跳转: ~56px（两行信息）
- 设置导航: 36px
- 插件列表: 需要确认

## 修复策略

### 原则
1. **抽取通用组件**而非每个页面重复造轮子
2. **以 VS Code / Obsidian 为设计参考**，保持暗色极客风格
3. **bgElevated 作为对话框标准背景色**，与面板标题栏/工具栏层次一致
4. **accentBlue 作为主交互色**（选中、聚焦），accentCyan 仅用于 AI/搜索等特殊场景
5. **44px 为标准标题栏高度**，40px 为标准列表项高度（单行）

### 抽取的通用组件
1. `DialogHeader` — 统一的对话框标题栏（图标+标题+计数+关闭按钮）
2. `SearchInput` — 统一的搜索框样式（前缀图标+后缀清除+聚焦效果）
3. 所有 Overlay 改用 `ModalOverlay` 包裹

## Goals
- 所有 overlay 对话框视觉风格完全统一
- 通用组件复用率 100%（无重复实现）
- 颜色/尺寸/间距遵循统一设计规范
- 用户感知不到不同面板的设计差异

## Non-Goals
- 不改变功能逻辑
- 不重做整体主题系统
- 不添加新功能
- 不改变侧边栏和编辑器的主布局

## Acceptance Criteria
- 所有 overlay 使用 ModalOverlay 或相同的遮罩/动画模式
- 标题栏高度/背景色/关闭按钮样式统一
- 搜索框样式（高度/背景/边框/聚焦色）统一
- 对话框使用一致的背景色（bgElevated）
- 选中项使用一致的主色（accentBlue）
- 所有 89 个测试通过
- dart analyze 0 errors
- macOS 构建成功
