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

---

## [x] Task 9: Round 17 REVIEW 深度审计发现的同类问题修复
- **Priority**: critical
- **Depends On**: Task 8
- **Completed In**: Round 17 (Review Phase)
- **Description**:
  - 修复 sliding_panes_container.dart _finishEditing: 无H1时prepend新标题（原只替换不插入，标题丢失）
  - 修复 sidebar_provider.dart renameNote: 同上H1缺失prepend逻辑
  - 修复 calendar_view.dart: _loadMonthData添加版本计数器解决月份快速切换竞态条件
  - 修复 calendar_view.dart: _CalendarFooter仅在当前月份显示"今天已记录 ✓"
  - 修复 calendar_view.dart: _loadMonthData首次setState添加mounted防御检查
  - 修复 calendar_view.dart: isFuture判断统一使用today参数（而非DateTime.now()）
  - 修复 calendar_view.dart: _openNoteForDay返回类型从void改为Future<void>
  - 修复 sidebar_container.dart duplicateNote: 移除filePath=''后的死代码syncToFile调用
  - 修复 sidebar_container.dart duplicateNote: 更新rawMarkdown中H1为"XXX 副本"
  - 修复 note_panel.dart _doSave: 从markdown提取标题更新note.title（关键bug：编辑标题不更新侧边栏/面板标题）
  - 修复 note_panel.dart _doSave: 标题变更时更新面板标题和刷新侧边栏树
  - 修复 note_panel.dart _doSave: syncToFile使用updatedNote.filePath而非note.filePath
  - 修复 app.dart note.new: rawMarkdown初始化为'# 新笔记\n'（之前为空字符串）
  - 修复 app.dart note.duplicate: 更新rawMarkdown中H1为"XXX 副本"
  - 修复 daily_note_panel.dart _openDailyNote: 返回类型从void改为Future<void>
  - 修复 template_gallery.dart _applyTemplate: 使用FileService.extractTitle获取实际渲染标题
  - 修复 template_gallery.dart _applyTemplate: 返回类型从void改为Future<void>
  - 修复 sliding_panes_container.dart _createNewNote: rawMarkdown初始化为'# 新笔记\n'
- **Acceptance Criteria Addressed**: AC-1~AC-5全部加强覆盖，同类数据一致性/H1标题问题全覆盖
- **Notes**: 共修复18个额外问题，其中note_panel _doSave标题同步为最高优先级核心bug

---

## [ ] Issue 1: DailyNoteService 读取已有日记时标题硬编码
- **Discovered During**: Round 17 Review
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - daily_note_service.dart 读取已有日记时，title使用硬编码日期（如_buildTitle(date)），不从文件内容提取H1
  - 如果用户手动在文件系统中修改了日记标题，应用不会反映更改
- **Evidence / Signals**:
  - 代码位置: lib/features/daily_notes/services/daily_note_service.dart:71-78
- **Suggested Remediation**:
  - 使用FileService.extractTitle(content, filePath)从内容提取标题，fallback到日期标题
- **Notes**: 日记场景下日期标题通常就是用户期望的标题，影响较小

## [ ] Issue 2: 多个async void方法可改进为Future<void>
- **Discovered During**: Round 17 Review
- **Blocks Release**: No
- **Severity**: Low
- **Description**:
  - app.dart _openTodayDailyNote, _showRenameDialog, _showDeleteConfirmDialog, _buildGraphData
  - sliding_panes_container.dart _openTodayNote, _openLocalFile
  - wiki_link_preview.dart _show
  - 这些方法使用void async，异常无法被捕获
- **Evidence / Signals**:
  - 代码审计发现共7处
- **Suggested Remediation**:
  - 批量改为Future<void>，不影响功能但提升健壮性
- **Notes**: 低优先级代码质量改进

## [ ] Issue 3: widget_test.dart 因Hive未初始化失败（pre-existing）
- **Discovered During**: Round 17 Review
- **Blocks Release**: No
- **Severity**: Low
- **Description**:
  - widget_test.dart 集成测试因测试环境未初始化Hive而失败
  - 88个单元测试全部通过，仅1个widget测试失败
- **Evidence / Signals**:
  - flutter test 输出: 88 passed, 1 failed (widget_test.dart)
  - 此问题在Round 4 progress.md中已记录为已知环境限制
- **Suggested Remediation**:
  - 在widget_test.dart中添加Hive初始化setUpAll或使用mock
- **Notes**: NFR中已记录"不修复macOS Flutter测试shell环境问题"
