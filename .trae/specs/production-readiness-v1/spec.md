# AeroMind 生产级修复 v1 - Product Requirement Document

## Overview
- **Summary**: 系统性修复 AeroMind 笔记应用中影响生产可用性的所有 critical/high 级别 bug，统一错误处理，修复数据层问题，改善 Overlay 管理，提升整体稳定性至可日常使用的水平。
- **Purpose**: 经过三轮代码审计共发现 115 个问题（16 个 critical，28 个 high，36 个 medium，35 个 low），本 PRD 聚焦修复所有 critical 和 high 级别的问题，以及最影响用户体验的 medium 级别问题。
- **Target Users**: 需要稳定日常使用 AeroMind 进行笔记的用户。

## Goals
- 消除所有可能导致崩溃或数据丢失的 critical bug
- 全链路添加错误处理和用户反馈（不再静默失败）
- 修复数据层的竞态条件、ID 碰撞、缓存不一致问题
- 统一 Overlay 管理（同一时间只有一个 overlay 打开，ESC 关闭）
- 修复 Git 备份、实体识别偏移等功能级 bug
- 给异步操作添加加载/错误状态
- 确保跨平台路径安全
- 统一 UI/UX 设计语言（遮罩、动画、交互一致）
- 源码模式具备基础语法高亮
- 编辑器搜索体验对标 Obsidian/VS Code

## Non-Goals (Out of Scope)
- 不做大规模 UI 重设计或主题更换
- 不添加新的大功能（如语义搜索、协作）
- 不重构整个插件系统架构
- 不做性能优化（如全文搜索索引、虚拟滚动）
- 不做国际化 i18n
- 不做浅色主题完善

## Background & Context
AeroMind 是一个 Flutter 桌面笔记应用，核心架构已完成：三层 feature-based 架构 + Riverpod 状态管理 + 插件系统 + Hive 本地存储。经过多轮功能开发和 bugfix，代码中存在大量 fire-and-forget 异步调用、空 catch 块、缺少 mounted 检查、ID 碰撞风险、overlay 焦点争抢等问题，导致应用在真实使用场景下容易崩溃、数据丢失、或出现"按了没反应"的情况。

### 审计发现的问题分布（按模块）
| 模块 | Critical | High | Medium |
|------|----------|------|--------|
| 编辑器/面板/侧边栏 | 4 | 8 | 6 |
| UI/Overlay | 0 | ~12 | ~20 |
| 数据层/服务 | 6 | 14 | 15 |
| **合计** | **10** | **34** | **41** |

## Functional Requirements

### FR-1: 全局错误处理体系
- 所有 async 方法必须有 try-catch
- catch 块中必须：1) debugPrint 记录错误 2) 给用户显示 SnackBar/提示
- 设置 `FlutterError.onError` 和 `PlatformDispatcher.instance.onError` 全局错误捕获
- main.dart 中 Hive 初始化失败时显示错误页面而非继续运行崩溃
- 空 catch 块 `catch (_) {}` 必须替换为带日志的处理

### FR-2: 数据保存可靠性
- `_doSave` 方法必须有 try-catch，保存失败时给用户提示
- `dispose()` 中的保存必须使用 `WidgetsBinding.instance.addPostFrameCallback` 安全执行
- `initState` 中的 `_loadNote()` 必须有 try-catch，加载失败显示错误面板而非白屏
- 切换笔记时（`didUpdateWidget`）保存旧笔记必须 await 完成后再加载新笔记，保存失败也要继续加载
- 自动保存 Timer 回调必须有 try-catch

### FR-3: ID 生成和数据一致性
- 笔记 ID 改用 UUID v4 而非 `DateTime.now().millisecondsSinceEpoch`，消除碰撞风险
- `NoteRepository.saveNote()` 自动维护 `updatedAt` 字段，不依赖调用方手动设置
- `saveNote()` 后自动 invalidate 相关 provider（allNotesProvider、noteByIdProvider）
- 跨平台路径使用 `p.join()` 拼接，修复 Windows 路径问题
- FileService JSON 转义补全（处理 \t、\r、控制字符）
- `syncToFile` 失败时通过 debugPrint 记录，不静默吞掉

### FR-4: Hive 初始化安全
- Hive 初始化失败时显示用户友好的错误页面，不继续运行
- Box 打开失败时正确清理已打开的资源
- 应用退出时调用 `HiveService.closeHive()`
- 移除危险的 `Hive.init('.')` 静默降级

### FR-5: 插件系统修复
- 修复 `resumePlugin` 空指针崩溃（添加 null 检查）
- 修复 AI 聊天插件命令重复注册问题
- PluginApi 添加事件取消注册接口（`offNoteOpened` 等）
- 修复 `getStorage` 未实现问题
- PluginApiImpl 不持有失效的 WidgetRef
- 插件状态持久化（禁用的插件重启后保持禁用）

### FR-6: Git 备份修复
- 修复 `git clone` 目标路径错误（克隆到指定目录而非子目录）
- 移除 `--allow-empty`，避免空提交污染历史
- 异步初始化添加加载状态
- 替换同步 IO 方法为异步方法

### FR-7: 实体识别修复
- 修复远程 LLM 识别返回偏移量基于截断文本的问题（发送全文或正确映射偏移）
- 防抖回调添加异常处理
- EntityCache 添加容量上限（最近 200 篇笔记）

### FR-8: Overlay 统一管理
- 同一时间只允许一个主要 overlay 打开（命令面板、Quick Switcher、模板画廊、插件管理、设置、图谱、速查表、导入导出、欢迎页）
- ESC 键按打开顺序逆序关闭 overlay，全部关闭后回到编辑器
- 打开新 overlay 时自动关闭已打开的 overlay
- 设置全局 overlay 状态管理替代零散的 boolean 标志

### FR-9: 搜索功能修复
- 搜索 TextField suffixIcon（清除按钮）正确响应输入变化
- 搜索无结果时显示明确提示
- 正则搜索无效时给用户提示
- 标签匹配高亮正确

### FR-10: 回收站和笔记操作错误处理
- 复制笔记、重命名、恢复、永久删除、清空回收站添加 try-catch 和错误提示
- LiveMarkdownEditor 的 addPostFrameCallback 添加 mounted 检查
- 所有 `void async` 方法改为 `Future<void> async`

### FR-11: 全局错误提示组件
- 统一 SnackBar/通知样式
- 保存成功/失败有明确反馈
- 长时间操作有 loading 指示器

### FR-12: Overlay 视觉与交互统一
- 所有模态 overlay 统一遮罩样式（半透明黑色背景）
- 统一入场/出场动画（Fade + Scale）
- 点击遮罩区域关闭 overlay（除需明确确认的对话框外）
- 统一圆角、边框、阴影等视觉风格

### FR-13: 编辑器内搜索体验
- 搜索时高亮所有匹配项（黄色背景标记）
- 当前匹配项有不同颜色高亮
- 显示匹配计数（如 3/12）
- 支持 Enter 跳转到下一个，Shift+Enter 跳转到上一个
- 搜索框有关闭按钮和清除按钮

### FR-14: 浅色主题清理
- 移除设置中不可用的浅色主题选项，避免误导用户
- 或在选项中明确标注"即将推出"且禁用切换

### FR-15: 知识图谱动画优化
- 圆形揭示动画从按钮点击位置开始，而非屏幕左上角
- 关闭动画反向播放

## Non-Functional Requirements
- **NFR-1**: 所有 critical 和 high 级别问题修复后，`flutter test` 全部通过
- **NFR-2**: `dart analyze lib/` 无新增 warning/error（保持 0 error，warning 不超过 5 个）
- **NFR-3**: macOS Debug 构建成功
- **NFR-4**: 编辑 1000 字长文后快速切换 5 个不同笔记，内容不丢失
- **NFR-5**: 连续打开/关闭 overlay 10 次不崩溃、不出现焦点问题

## Constraints
- **Technical**: Flutter/Dart SDK >=3.2.0，Riverpod 2.x，Hive，不引入新的重依赖
- **Business**: 不做付费/云同步等商业功能
- **Dependencies**: 可以添加 `uuid` 包（项目已有此依赖，检查版本）；使用 `path` 包（已通过 Flutter 间接依赖）

## Assumptions
- 用户主要在 macOS 桌面端使用
- Git 备份依赖系统安装 git 命令行工具
- AI 功能依赖用户自行配置 LLM API

## Acceptance Criteria

### AC-1: 应用启动稳定性
- **Given**: Hive 正常初始化
- **When**: 用户启动应用
- **Then**: 应用正常打开，自动加载笔记树，首次启动显示欢迎页和欢迎笔记
- **Verification**: `programmatic`

### AC-2: Hive 初始化失败处理
- **Given**: Hive 数据库损坏或无写权限
- **When**: 用户启动应用
- **Then**: 显示错误提示页面而非白屏/崩溃
- **Verification**: `programmatic`

### AC-3: 笔记编辑不丢失
- **Given**: 用户正在编辑一篇笔记
- **When**: 用户快速切换到另一篇笔记、关闭面板、或关闭应用
- **Then**: 已输入的内容全部保存，切换后新笔记正确加载
- **Verification**: `human-judgment` + `programmatic`（测试）

### AC-4: 保存失败有反馈
- **Given**: 磁盘满或文件被占用导致保存失败
- **When**: 自动保存或手动保存触发
- **Then**: 用户看到明确的错误提示（SnackBar），不会静默丢失内容
- **Verification**: `human-judgment`

### AC-5: Overlay 互斥
- **Given**: 命令面板已打开
- **When**: 用户按 Cmd+O 打开 Quick Switcher
- **Then**: 命令面板自动关闭，Quick Switcher 打开
- **Verification**: `human-judgment`

### AC-6: ESC 关闭 overlay
- **Given**: 任意 overlay 打开
- **When**: 用户按 Escape 键
- **Then**: 当前打开的 overlay 关闭，焦点回到编辑器
- **Verification**: `human-judgment`

### AC-7: 笔记 ID 不碰撞
- **Given**: 快速连续创建 10 篇笔记
- **When**: 每篇笔记标题不同
- **Then**: 所有笔记正确保存，不会互相覆盖
- **Verification**: `programmatic`

### AC-8: Wiki 链接跳转
- **Given**: 笔记 A 中有 `[[笔记B]]` 链接
- **When**: 用户在阅读模式点击该链接
- **Then**: 如果笔记 B 存在则打开；不存在则弹出创建确认
- **Verification**: `human-judgment`

### AC-9: Git 备份功能可用
- **Given**: 用户配置了正确的 Git 远程仓库
- **When**: 点击"立即备份"
- **Then**: 文件正确 commit 并 push 到远程，不产生空提交
- **Verification**: `human-judgment`

### AC-10: 无未捕获异常
- **Given**: 用户正常使用应用（创建/编辑/删除笔记、搜索、打开各种面板）
- **When**: 操作 5 分钟
- **Then**: 控制台无未捕获异常，应用不崩溃
- **Verification**: `human-judgment`

### AC-11: Overlay 视觉统一
- **Given**: 应用正常运行
- **When**: 用户打开命令面板、模板画廊、插件管理、设置等 overlay
- **Then**: 所有 overlay 有一致的遮罩、动画、圆角和边框样式
- **Verification**: `human-judgment`

### AC-12: 搜索结果高亮
- **Given**: 用户在编辑器中打开搜索栏并输入关键词
- **When**: 存在多个匹配项
- **Then**: 所有匹配项以黄色背景标记，当前匹配项以橙色高亮
- **Verification**: `human-judgment`

### AC-13: 设置无误导选项
- **Given**: 用户打开设置页面
- **When**: 查看主题设置
- **Then**: 浅色主题选项要么可用，要么明确标注不可用，不会让用户以为切换了但没生效
- **Verification**: `human-judgment`

### AC-14: 图谱动画从按钮位置展开
- **Given**: 用户在笔记面板中
- **When**: 点击图谱按钮打开知识图谱
- **Then**: 圆形揭示动画从按钮位置开始扩散，而非从左上角
- **Verification**: `human-judgment`

## Open Questions
- [ ] 远程 LLM 实体识别偏移量问题：是发送全文给 LLM 还是做正确的偏移映射？推荐：限制 4000 字符发送但正确计算偏移映射
- [ ] Overlay 管理：是使用 Riverpod provider 统一管理还是在 App Shell 中简单实现？推荐：在 App Shell 中用 enum 统一管理，避免过度工程化

## Critical Files for Implementation
- `lib/main.dart` — 全局错误处理、Hive 初始化失败处理
- `lib/app.dart` — Overlay 统一管理、ESC 键处理、退出时清理
- `lib/features/editor/widgets/note_panel.dart` — 编辑器保存可靠性、错误处理
- `lib/providers/note_provider.dart` — ID 生成、updatedAt 自动维护、cache invalidation
- `lib/core/services/hive_service.dart` — 初始化安全、closeHive
- `lib/core/plugin/plugin_registry.dart` — 插件 null 安全、状态持久化
- `lib/core/services/git_backup_service.dart` — clone 路径、空提交修复
