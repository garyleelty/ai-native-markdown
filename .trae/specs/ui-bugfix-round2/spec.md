# AeroMind UI Bugfix Round 2 - Product Requirement Document

## Overview
- **Summary**: 修复第一轮 UI bugfix 后遗留的数据同步、错误处理、状态一致性问题，覆盖文件写入、空笔记面板、日历刷新、空字符串 ID 等同类型问题。
- **Purpose**: 上一轮修复了"日历点击不保存""最后面板无法关闭""侧边栏横向布局"三个问题，但代码审计发现同类型（数据持久化遗漏、错误静默吞掉、边界条件未处理）问题仍然存在，可能导致数据丢失或用户困惑。
- **Target Users**: AeroMind 笔记应用的所有终端用户。

## Goals
- 修复 `_syncToFile` 写入文件时未创建父目录且 catchError 逻辑错误的问题（数据丢失风险）
- NotePanel 在笔记不存在于 Hive 时显示明确的错误提示而非空白编辑器
- 修复 `aiContextProvider` 中 `activePaneId` 使用空字符串而非 null 的问题
- 日历视图在新建日记后刷新月份标记（`_daysWithNotes`）
- 确保所有打开面板的路径在打开前笔记已存在于 Hive

## Non-Goals (Out of Scope)
- 不重构整体架构或引入新状态管理方案
- 不添加新功能模块
- 不批量清理全部 info 级 lint 提示
- 不修改 AI 聊天、知识图谱布局、Mermaid 等与本次修复无关的功能
- 不修复 macOS Flutter 测试 shell 环境问题（已知环境限制）

## Background & Context
上一轮反馈修复了三个用户报告的问题：
1. 日历点击保存 / 文件模块显示 — 已在 calendar_view.dart、file_picker_service.dart、app.dart、daily_note_panel.dart、note_panel.dart 添加 Hive 同步
2. 最后面板关闭 / 欢迎页 — 已修复 pane_provider.dart closePane 边界，sliding_panes_container.dart 添加欢迎页
3. 侧边栏布局 — 已重构为 VS Code 风格纵向活动栏 + 可拖拽宽度 + 折叠

深度代码审计发现以下同类型问题仍需修复：

### 设计决策（grill-me 自我拷问结论）

**Q1: _syncToFile 为什么需要创建父目录？**
DailyNoteService 在创建新日记时已经调用了 `_storage.createDir(dirPath, recursive: true)` 并写入了初始文件，所以目录通常存在。但如果用户在外部删除了日记文件夹，或 filePath 指向一个尚未存在的子目录，writeAsString 会抛 FileSystemException。防御性编程要求确保父目录存在再写入。另外现有 `catchError((_) => File(filePath))` 完全是 bug——它返回一个 File 对象但什么也不做，正确做法是 try-catch 并静默失败（与其他错误处理一致）。

**Q2: NotePanel 笔记不存在时该怎么处理？**
不应该自动创建空笔记（会产生孤儿数据），也不应该静默空白（用户无法理解）。正确做法是显示"笔记未找到"提示，附带一个关闭面板按钮。这与 VS Code 等编辑器的行为一致。

**Q3: activePaneId 空字符串会造成什么问题？**
虽然目前 aiContextProvider 尚未被广泛消费，但使用空字符串而非 null 违反了"不存在即 null"的约定，未来接入时可能导致 repo.getNote('') 这种无意义查询。改为可空类型 String? 更安全。

**Q4: 日历新建后需要刷新吗？**
是的。用户点击一个没有日记的日期→系统创建日记→打开面板，但日历上该日期的"有日记"标记（青色背景点）不会立即出现，直到下次进入日历视图。_openNoteForDay 成功后应调用 _loadMonthData() 刷新。

## Functional Requirements
- **FR-1**: `_syncToFile` 写入文件前确保父目录存在，catchError 改为正确的静默错误处理
- **FR-2**: NotePanel 在 `_loadNote` 返回 null 时显示"笔记未找到"错误状态（含图标、提示文字、关闭按钮），不再显示空编辑器
- **FR-3**: `AIContext.activePaneId` 字段改为 `String?` 类型，无激活面板时为 null 而非空字符串
- **FR-4**: CalendarView `_openNoteForDay` 成功打开新日记后调用 `_loadMonthData()` 刷新月份标记
- **FR-5**: NotePanel 标题栏在笔记加载失败时显示"笔记未找到"而非笔记标题

## Non-Functional Requirements
- **NFR-1**: 所有修改通过 `flutter analyze` 静态分析，无新增 error/warning
- **NFR-2**: 文件写入操作使用 dart:io 标准 API，不引入新依赖
- **NFR-3**: 错误处理保持与现有代码风格一致（静默 catch，不向用户显示 SnackBar 干扰操作流）

## Constraints
- **Technical**: Flutter/Dart, Riverpod 状态管理, Hive 本地存储, 不引入新包
- **Business**: 无外部依赖，零网络请求
- **Dependencies**: 依赖上一轮修复已完成的代码状态

## Assumptions
- 用户笔记文件目录可能因外部操作（Finder/Explorer 删除）而不存在，需要防御性处理
- 日记保存到文件系统是桌面端主要使用场景（kIsWeb 判断已存在）
- 所有打开面板的上游路径已确保笔记在 Hive 中（已审计：note.new, file open/import, calendar, today note, quick switcher, template gallery, graph）

## Acceptance Criteria

### AC-1: _syncToFile 正确写入文件
- **Given**: 用户编辑了一个有 filePath 的笔记（如日记）
- **When**: 自动保存触发 _syncToFile
- **Then**: 父目录存在时正常写入；父目录不存在时先创建目录再写入；写入失败时静默不崩溃
- **Verification**: `programmatic`
- **Notes**: 通过代码审查 + flutter analyze 验证

### AC-2: NotePanel 笔记不存在时显示错误状态
- **Given**: 某个 noteId 对应的笔记不在 Hive 中（如被回收站彻底删除后仍在面板栈中）
- **When**: NotePanel 加载该笔记
- **Then**: 显示居中的错误图标+"笔记未找到"提示+"关闭面板"按钮；点击关闭按钮调用 closePane 关闭当前面板
- **Verification**: `human-judgment`
- **Notes**: 通过代码审查验证 UI 结构

### AC-3: activePaneId 使用 null 而非空字符串
- **Given**: 没有打开任何面板
- **When**: aiContextProvider 被消费
- **Then**: activePaneId 为 null，类型为 String?
- **Verification**: `programmatic`
- **Notes**: 通过代码审查 + 类型检查验证

### AC-4: 日历新建日记后刷新标记
- **Given**: 用户在日历上点击一个没有日记的日期
- **When**: 日记创建并打开后
- **Then**: 日历上该日期立即显示"有日记"标记（青色背景），无需重新进入视图
- **Verification**: `programmatic`
- **Notes**: 通过代码审查验证 _loadMonthData 调用

### AC-5: 静态分析无新增错误
- **Given**: 所有修改完成后
- **When**: 运行 `flutter analyze lib/`
- **Then**: 退出码为 0，无 error/warning 级别问题（info 级既有提示除外）
- **Verification**: `programmatic`

## Open Questions
- 无。所有设计决策已通过 grill-me 自我拷问完成。

## Critical Files for Implementation
- `lib/features/editor/widgets/note_panel.dart` — _syncToFile 修复 + 笔记未找到错误状态 + 标题栏
- `lib/providers/pane_provider.dart` — activePaneId 改为 nullable
- `lib/features/calendar/widgets/calendar_view.dart` — _openNoteForDay 后刷新月份数据
