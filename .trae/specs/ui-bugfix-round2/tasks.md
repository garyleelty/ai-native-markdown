# AeroMind UI Bugfix Round 2 - The Implementation Plan

## [x] Task 1: Project Setup and Environment Configuration
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 验证 Flutter 环境可用（flutter analyze 可运行）
  - 确认上一轮修复的文件状态（calendar_view.dart, file_picker_service.dart, note_panel.dart, pane_provider.dart, sidebar_container.dart, daily_note_panel.dart, app.dart, sliding_panes_container.dart）
  - 确认 .trae/specs/ui-bugfix-round2/ 目录存在且包含 spec.md
- **Acceptance Criteria Addressed**: 基础设施准备
- **Test Requirements**:
  - `programmatic` TR-1.1: flutter analyze 可执行且退出码为 0（仅 info 级提示）
  - `programmatic` TR-1.2: 所有关键文件可读取
- **Notes**: 上一轮已修复的代码保持不变，本轮只做增量修复

---

## [x] Task 2: 修复 _syncToFile 文件写入逻辑 (FR-1)
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `lib/features/editor/widgets/note_panel.dart` 中 `_syncToFile` 方法
  - 在写入前确保父目录存在
  - 修复 catchError 错误用法，改为正确的 try-catch 静默处理
  - 将方法改为 async 以支持 await 目录创建
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: _syncToFile 在写入前创建父目录
  - `programmatic` TR-2.2: catchError 不再返回无意义的 File 对象
  - `programmatic` TR-2.3: 方法签名正确（async Future）
- **Notes**: 使用 dart:io 的 Directory 和 File API；kIsWeb 判断保留

---

## [x] Task 3: NotePanel 笔记未找到错误状态 (FR-2, FR-5)
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修改 `lib/features/editor/widgets/note_panel.dart` 中 _loadNote 和 build 方法
  - 添加 _noteNotFound 状态标志
  - 当 repo.getNote 返回 null 时显示错误状态 Widget
  - 错误状态包含：图标、"笔记未找到"文字、"关闭面板"按钮
  - 标题栏在 _noteNotFound 时显示"笔记未找到"
- **Acceptance Criteria Addressed**: AC-2, AC-5
- **Test Requirements**:
  - `human-judgment` TR-3.1: 错误状态居中显示，视觉风格一致
  - `programmatic` TR-3.2: 点击关闭按钮调用 closePane
  - `programmatic` TR-3.3: _noteNotFound 为 true 时不渲染编辑器 UI
- **Notes**: 需要找到当前面板索引以调用 closePane

---

## [x] Task 4: 修复 activePaneId 空字符串为 null (FR-3)
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - 修改 `lib/providers/pane_provider.dart` 中 AIContext 类
  - activePaneId 类型从 String 改为 String?
  - 移除 ?? '' 默认值
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-4.1: activePaneId 类型为 String?
  - `programmatic` TR-4.2: 无面板时 activePaneId 为 null
  - `programmatic` TR-4.3: 无类型错误
- **Notes**: 当前 aiContextProvider 尚无消费者，改动风险低

---

## [x] Task 5: 日历新建日记后刷新月份标记 (FR-4)
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - 修改 `lib/features/calendar/widgets/calendar_view.dart` 中 _openNoteForDay
  - 在成功保存新笔记后调用 _loadMonthData() 刷新标记
  - 仅新创建笔记时刷新
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-5.1: 新笔记保存后调用 _loadMonthData()
  - `programmatic` TR-5.2: 已存在笔记不重复刷新
- **Notes**: _loadMonthData 已有 mounted 检查

---

## [x] Task 6: 验证与静态分析
- **Priority**: high
- **Depends On**: Task 2, Task 3, Task 4, Task 5
- **Description**:
  - 运行 flutter analyze lib/ 确认无新增 error/warning
  - 逐项核对 checklist.md
  - 代码审查确认所有修复与 spec 一致
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-6.1: flutter analyze lib/ 退出码为 0
  - `programmatic` TR-6.2: 无新增 error 或 warning
  - `human-judgment` TR-6.3: 代码风格一致

---

## [x] Task 7: Round 3 额外修复 (duplicateNote filePath, renameNote H1, 侧边栏数据同步, FileService 提取)
- **Priority**: high
- **Depends On**: Task 6
- **Completed In**: Round 3
- **Description**:
  - sidebar_container.dart duplicateNote: filePath 设为空字符串，不再复用原笔记文件路径
  - sidebar_provider.dart renameNote: 更新 rawMarkdown 中第一个 H1 标题
  - sidebar_provider.dart toggleTask/renameTag/deleteTag/renameNote: 添加 FileService.syncToFile
  - 提取 FileService.syncToFile/shouldSyncToFile 公共静态方法
- **Acceptance Criteria Addressed**: 同类型数据同步问题全覆盖
- **Notes**: 已在 Round 3 完成

---

## [x] Task 8: Round 4 深度审计与剩余类似问题修复
- **Priority**: high
- **Depends On**: Task 7
- **Completed In**: Round 4
- **Description**:
  - 审计全部 22 个 saveNote 调用点
  - 修复 app.dart 版本历史恢复未同步到文件的问题
  - 修复 sliding_panes_container.dart 内联标签重命名未更新 H1/未同步/未刷新树的问题
  - 修复 plugin_api_impl.dart saveNote 未同步到文件的问题
  - 修复 daily_note_panel.dart 新建日记后日历标记不刷新的问题
- **Acceptance Criteria Addressed**: AC-1 (extended), AC-4 (extended), 新增同类问题全覆盖
- **Notes**: 所有 22 个 saveNote 调用点已审计完毕
