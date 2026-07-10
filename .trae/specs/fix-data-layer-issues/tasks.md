# Tasks

- [x] T1: 修复 LocalNoteRepository.saveNote（自动生成空ID、自动设置createdAt）
- [x] T2: 修复 TrashService（使用uuid生成trashId，用updatedAt记录删除时间）
- [x] T3: 修复 TemplateService 自定义模板ID（改用uuid）
- [x] T4: 修复 TemplateGallery 创建笔记ID（改用repo.generateId()）
- [x] T5: 修复 FilePickerService.importFromPath ID生成（改用Uuid）
- [x] T6: 修复 app.dart 中三处笔记ID生成（欢迎笔记、新建笔记、复制笔记）
- [x] T7: 修复 SlidingPanesContainer：
  - [x] T7a: _createNewNote ID改用repo.generateId()
  - [x] T7b: _openTodayNote 返回类型改为 Future<void>
  - [x] T7c: _openLocalFile 返回类型改为 Future<void> 并添加try-catch
- [x] T8: 修复 SidebarContainer：
  - [x] T8a: _createNote ID改用repo.generateId()
  - [x] T8b: _duplicateNote ID改用repo.generateId()
- [x] T9: 修复 ImportExportPanel：
  - [x] T9a: 导入fallback ID改用Uuid
  - [x] T9b: 所有await后setState前添加mounted检查
- [x] T10: 检查 daily_notes 目录下服务确认无时间戳ID问题
