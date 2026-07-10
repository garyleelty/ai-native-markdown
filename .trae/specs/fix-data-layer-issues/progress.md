# Progress

## Round 1

- 已完成：spec.md, tasks.md, checklist.md 创建
- 进行中：实现所有修复任务 T1-T10
- 阻塞/风险：无
- 下一轮计划：逐个实现修复，验证通过后完成

## Round 2 (DONE)

- 已完成：所有 7 项修复任务全部完成
  1. TrashService: trashId 改用 uuid，删除时间通过 note.updatedAt 记录，不再依赖 ID 解析
  2. Templates 服务：自定义模板 ID 和新建笔记 ID 均改用 uuid/repo.generateId()
  3. Daily notes：确认使用基于 filePath 的确定性哈希 ID，无时间戳问题，无需修改
  4. 全局笔记 ID：app.dart、sidebar_container.dart、sliding_panes_container.dart、file_picker_service.dart、import_export_panel.dart 中所有使用时间戳作为笔记 ID 的地方均已替换为 uuid 或 repo.generateId()
  5. LocalNoteRepository.saveNote: 新增空 ID 自动生成逻辑，NoteModel.copyWith 补充了缺失的 createdAt 参数
  6. SlidingPanesContainer: _openTodayNote 和 _openLocalFile 返回类型改为 Future<void>，_openLocalFile 添加 try-catch
  7. ImportExportPanel: 所有 async 方法中 await 后的 setState 调用前均添加了 mounted 检查，防止 widget 销毁后异常
- 进行中：无
- 阻塞/风险：无
- 验证结果：dart analyze 通过，无新增错误或警告
- 修改文件清单：
  - lib/core/models/note_model.dart（copyWith 添加 createdAt 参数）
  - lib/core/services/trash_service.dart（uuid + updatedAt 记录删除时间）
  - lib/core/services/file_picker_service.dart（importFromPath 使用 Uuid）
  - lib/features/templates/services/template_service.dart（自定义模板用 uuid）
  - lib/features/templates/widgets/template_gallery.dart（新建笔记用 repo.generateId()）
  - lib/features/sliding_panes/widgets/sliding_panes_container.dart（ID 生成 + async 返回类型 + try-catch）
  - lib/features/sidebar/widgets/sidebar_container.dart（新建/复制笔记用 repo.generateId()）
  - lib/features/import_export/widgets/import_export_panel.dart（导入 fallback ID 用 uuid + mounted 检查）
  - lib/app.dart（欢迎笔记/新建/复制笔记用 repo.generateId()）
  - lib/providers/note_provider.dart（saveNote 自动生成空 ID）
