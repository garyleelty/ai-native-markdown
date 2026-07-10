# Progress

## Round 1 (Spec Phase)

- 已完成：
  - 代码审计：全面审查了 17 处 openPane 调用点、NotePanel 加载/保存逻辑、PaneStackNotifier 边界条件、侧边栏布局、日历视图、文件选择服务
  - 确认上一轮修复的 3 个问题已正确实现
  - 发现 5 个同类型新问题：_syncToFile 写入 bug（数据丢失风险）、NotePanel 无笔记时空白、activePaneId 空字符串、日历新建后不刷新标记
  - spec.md/tasks.md/checklist.md 已生成
- 进行中：等待用户审阅规划文档
- 阻塞/风险：无
- 关键决策（grill-me 自我拷问）：
  - _syncToFile 添加防御性父目录创建（即使 DailyNoteService 已创建目录，外部删除场景仍需保护）
  - NotePanel 笔记不存在时显示关闭按钮而非自动创建（避免孤儿数据）
  - activePaneId 改为 nullable（无消费者，低风险）
- 下一轮计划：实现 Task 2-5 的代码修复 → Task 6 验证

## Round 2 (Implementation + Verification) — DONE

- 已完成：
  - **Fix A (_syncToFile)**: 将同步方法改为 async，写入前递归创建父目录，修复 catchError 返回无意义 File 的 bug
  - **Fix B-E (NotePanel 错误状态)**: 添加 `_noteNotFound` 标志，_loadNote 在 note==null 时设置错误状态，build 方法返回 _buildNoteNotFound() 错误 UI（图标+提示+关闭按钮）
  - **Fix F (activePaneId nullable)**: AIContext.activePaneId 从 String 改为 String?，移除 `?? ''` 回退
  - **Fix G (日历刷新)**: _openNoteForDay 在新日记保存后调用 _loadMonthData() 刷新月份标记
- 验证结果：
  - flutter analyze lib/ 退出码 0，0 errors，0 warnings
  - checklist.md 18/18 项全部通过
  - 代码审查确认修改范围仅限于 spec 定义的 3 个文件
- 文件变更：
  - 修改：lib/features/editor/widgets/note_panel.dart（_syncToFile, _loadNote, build, _buildNoteNotFound）
  - 修改：lib/providers/pane_provider.dart（AIContext 类 + aiContextProvider）
  - 修改：lib/features/calendar/widgets/calendar_view.dart（_openNoteForDay）
- 关键决策回顾：
  - _syncToFile 防御性创建父目录，覆盖外部删除文件夹的边缘情况
  - NotePanel 笔记未找到时显示关闭按钮而非自动创建，避免孤儿数据
  - activePaneId nullable 修复语义错误，为未来 AI 上下文接入奠定正确基础
  - 日历仅在新建笔记后刷新，避免不必要的 IO
- 下一轮计划：所有任务完成，checklist 全部通过，本 spec 标记为 DONE

## Round 3

- **Verdict**: PARTIAL (code fixes applied + verified)
- **Scope reviewed**: 上一轮完成后，进行同类型问题深度审计。
- **Issues discovered (similar pattern)**:
  - **Critical Bug**: sidebar_container.dart _duplicateNote() 副本笔记直接复用原笔记 filePath，导致两个 Hive 条目指向同一个文件，编辑副本会覆盖原文件内容。修复：副本 filePath 设为空字符串（与手动新建笔记一致）。
  - **Bug**: sidebar_provider.dart renameNote() 只更新 note.title，未更新 rawMarkdown 开头的 `# 标题`，导致面板标题与文档内 H1 不一致。修复：用正则替换第一个 `# ...` 行。
  - **Data Sync Gap**: sidebar_provider.dart 中 toggleTask()、renameTag()、deleteTag()、renameNote()、sidebar_container.dart duplicateNote() 仅更新 Hive，对有 filePath 的笔记未同步到文件系统。修复：在 repo.saveNote() 后调用 FileService.syncToFile()。
  - **Code Duplication**: _syncToFile 是 note_panel.dart 私有方法，其他 provider/widget 无法复用。修复：提取到 FileService.syncToFile() 公共静态方法，并添加 shouldSyncToFile() 辅助方法处理 kIsWeb 和空路径判断。
- **Files changed in this round**:
  - Modified: lib/core/services/file_service.dart (新增 syncToFile/shouldSyncToFile 静态方法，带 dart:io 和 foundation 导入)
  - Modified: lib/features/editor/widgets/note_panel.dart (使用 FileService 替代私有 _syncToFile，移除 dart:io 导入)
  - Modified: lib/features/sidebar/widgets/sidebar_container.dart (duplicateNote: filePath='' + FileService 导入)
  - Modified: lib/providers/sidebar_provider.dart (toggleTask/renameTag/deleteTag/renameNote 添加文件同步 + renameNote 更新 H1 标题 + FileService 导入)
- **Verification results**:
  - flutter analyze lib/ 退出码 0，0 errors，0 warnings，240 info（均为 pre-existing 风格问题）
  - 代码审查确认：FileService.syncToFile 正确处理父目录创建、静默 catch、kIsWeb/空路径守卫；duplicateNote 不再复用原 filePath；renameNote 正确更新 H1 并同步；toggleTask/renameTag/deleteTag 在 changed 分支内对每个更新的笔记调用 syncToFile。
- **Key decisions**:
  - 副本笔记 filePath 设为空而非自动生成路径，因为当前应用中无 filePath 的笔记仅存于 Hive（与新建笔记行为一致），避免意外写入磁盘。
  - FileService.syncToFile 为静态方法，无需实例化 FileService（后者需要 vaultRoot 构造参数），方便在任意 provider/widget 中调用。
  - 保持现有架构：文件同步为单向（Hive→文件），不重构为 repository 层统一处理（避免大范围改动风险）。
- **Risks and issues**:
  - TrashService.moveToTrash/deletePermanently 仍未处理文件系统删除（磁盘上会留孤立文件）。此为设计权衡——当前架构以 Hive 为 source of truth，回收站仅软删除 Hive 条目，不删除磁盘文件，避免误删用户数据。可在后续轮次考虑添加"永久删除时询问是否删除文件"。
  - 240 条 info 级 lint 提示（prefer_const_constructors/deprecated_member_use/dangling_library_doc_comments 等）建议后续用 dart fix --apply 批量清理。

## Round 4

- **Verdict**: COMPLETE (additional similar-pattern audit + fixes)
- **Scope reviewed**: After Round 3 fixes, performed exhaustive audit of all 22 saveNote call sites across 12 files to find remaining similar issues.
- **Issues discovered and fixed (4 bugs)**:
  1. **app.dart version history restore (data loss bug)**: Restoring a note from version history saved to Hive but never synced to the file system, so disk content would be stale. Fix: added FileService.shouldSyncToFile/syncToFile after saveNote, added FileService import.
  2. **sliding_panes_container.dart inline tab rename (3 bugs)**: `_finishEditing()` (double-click tab title to rename) had three issues: (a) only updated title field but not the H1 heading in rawMarkdown (same bug that was fixed for sidebar renameNote in Round 3); (b) didn't sync to file system; (c) didn't refresh note tree. Fix: added H1 regex replacement, FileService.syncToFile, and sidebarProvider.loadNoteTree() call, plus required imports.
  3. **plugin_api_impl.dart saveNote (data sync gap)**: Plugin API's saveNote method wrote to Hive but didn't sync to file, meaning any plugin modifying notes would cause data inconsistency between Hive and disk. Fix: added FileService.shouldSyncToFile/syncToFile after repo.saveNote.
  4. **daily_note_panel.dart _openDailyNote (missing UI refresh)**: Creating a new diary from the daily note panel (sidebar mini-calendar) didn't refresh the `_daysWithNotes` markers, so the cyan dot wouldn't appear until navigation (same bug fixed in calendar_view.dart in Round 2). Fix: added `_loadDaysWithNotes()` call after wasNew, matching calendar_view pattern.
- **Files changed in this round**:
  - Modified: lib/app.dart (FileService import + version restore sync)
  - Modified: lib/core/services/plugin_api_impl.dart (FileService import + saveNote sync)
  - Modified: lib/features/daily_notes/widgets/daily_note_panel.dart (_openDailyNote refresh)
  - Modified: lib/features/sliding_panes/widgets/sliding_panes_container.dart (imports + _finishEditing H1/sync/tree refresh)
- **Verification results**:
  - flutter analyze lib/ exit code 0, 0 errors, 0 warnings, 241 info (pre-existing)
  - 88/89 tests pass; widget_test.dart failure is pre-existing Hive initialization issue in test environment (documented in spec NFR)
  - All 4 fixes verified via code inspection
- **Key decisions**:
  - plugin_api_impl.dart saveNote should sync to file: plugins are treated the same as internal code paths; if a plugin modifies a note with a filePath, changes must persist to disk
  - sliding_panes inline rename must update H1: consistency with sidebar renameNote behavior from Round 3
  - DailyNoteService already writes files to disk on creation, so no extra syncToFile needed there; only _loadDaysWithNotes UI refresh was missing
- **Audit conclusions**: All 22 saveNote call sites have been reviewed. Remaining saveNote calls without explicit syncToFile are:
  - note.new/template/duplicate/create commands: filePath is '' (intentionally, new notes start unsaved)
  - daily note creation: file already written by DailyNoteService._storage.writeAsString
  - file import/open: reads from existing files, no write needed at import time
  - trash restore: doesn't rewrite file (user edits will trigger sync via autosave)
  - moveNoteToFolder: only changes folderPath metadata, not content
  - JSON import: imported notes default filePath to ''
  These are all correct by design.
- **Risks/issues**: None. Audit is complete for the similar-pattern issues tracked in this spec.

## Round 17 (Review + Similar-Pattern Fixes)

**Verdict**: PASS WITH ISSUES (all critical/high bugs fixed; 3 low-severity issues deferred)

- **Scope reviewed**: 全量审计所有AC/TR + 同类模式深度扫描（H1标题一致性、文件同步、竞态条件、边界条件）
- **Verification results**:
  - Build/Runtime: PASS — Flutter 3.44.4/Dart 3.12.2, flutter analyze 0 errors, 0 warnings, 240 info (pre-existing)
  - Static/Security: PASS — 无硬编码密钥, 无TODO/FIXME, 1个有意UnimplementedError（PluginStorage防护）
  - Tests/Coverage: PASS — 88/88 unit tests pass; widget_test.dart failure is pre-existing Hive init issue (documented)
  - Type-specific checks: 深度审查note_panel、calendar_view、pane_provider、sidebar_provider、sidebar_container、sliding_panes_container、app.dart、plugin_api_impl、daily_note_panel、file_service、template_gallery共11个文件
  - Adversarial probes: 
    1. 月份快速切换竞态 → 发现并修复（版本计数器）
    2. 非当前月份"今天已记录"误显示 → 发现并修复
    3. 空内容/无H1笔记重命名标题丢失 → 发现并修复（2处）
    4. 编辑器修改H1后标题不同步 → **发现关键bug**并修复
    5. 新建笔记/复制笔记H1不一致 → 发现并修复（4处）
    6. async void反模式 → 修复关键数据路径的3处，记录7处低优先级
  - AC audit: 5/5 fully satisfied (all ACs pass with extended coverage beyond original spec)
  - TR audit: 8/8 tasks fully satisfied + 1 new Task 9 added for review-phase fixes
- **Bugs found and fixed in this round (18 fixes across 8 files)**:
  - **CRITICAL**: note_panel _doSave不更新note.title（编辑器修改H1后标题永久不同步）— 修复：添加FileService.extractTitle + updatePaneTitle + loadNoteTree
  - **HIGH**: sliding_panes_container _finishEditing / sidebar_provider renameNote 无H1时不插入新标题 → 修复：prepend逻辑
  - **HIGH**: calendar_view月份快速切换竞态条件 → 修复：版本计数器
  - **MEDIUM**: calendar_view底部"今天已记录"在非当前月份误显示 → 修复：isCurrentMonth参数
  - **MEDIUM**: app.dart note.duplicate / sidebar_container duplicateNote 复制笔记H1不更新 → 修复：正则替换
  - **MEDIUM**: app.dart note.new / sliding_panes _createNewNote 新建笔记rawMarkdown为空 → 修复：初始化为'# 新笔记\n'
  - **MEDIUM**: template_gallery _applyTemplate使用template.name而非实际渲染标题 → 修复：FileService.extractTitle
  - **LOW**: _loadMonthData首次setState缺少mounted检查 → 修复
  - **LOW**: isFuture判断不一致、async void返回类型、duplicateNote死代码 → 修复
- **Files modified in this round**:
  - lib/features/editor/widgets/note_panel.dart (_doSave标题同步)
  - lib/features/calendar/widgets/calendar_view.dart (竞态+底部栏+mounted+isFuture+返回类型)
  - lib/features/sliding_panes/widgets/sliding_panes_container.dart (_finishEditing H1 + _createNewNote)
  - lib/providers/sidebar_provider.dart (renameNote H1 prepend)
  - lib/features/sidebar/widgets/sidebar_container.dart (duplicateNote H1 + 死代码移除)
  - lib/app.dart (note.new H1 + note.duplicate H1)
  - lib/features/daily_notes/widgets/daily_note_panel.dart (返回类型)
  - lib/features/templates/widgets/template_gallery.dart (标题提取+返回类型)
- **Remaining issues (deferred, documented in tasks.md)**:
  - Issue 1 (Medium): DailyNoteService读取日记时标题硬编码，建议使用extractTitle
  - Issue 2 (Low): 7处async void可改为Future<void>
  - Issue 3 (Low): widget_test.dart Hive初始化失败（pre-existing，NFR已排除）
- **Strengths**: 原始4轮修复质量高，核心功能（文件同步、笔记未找到UI、activePaneId nullable、日历刷新）均正确实现。FileService.syncToFile公共方法设计合理。
- **Risks and issues**: _doSave频繁调用loadNoteTree可能在笔记树很大时有性能影响，但已通过titleChanged守卫最小化调用频率。
- **Artifacts updated**:
  - checkpoints.md: 35个检查点全部通过
  - tasks.md: 追加Task 9（18项修复）+ Issue 1/2/3（延期项）
- **Recommended next session**: 处理Issue 1（DailyNoteService标题提取）+ 批量修复async void方法，可考虑dart fix --apply批量清理info级lint。
