# 修复数据层剩余问题

## Why

当前代码存在以下数据层问题：
1. ID生成使用时间戳（millisecondsSinceEpoch）存在碰撞风险，尤其在快速连续操作时
2. 部分 async 方法返回类型为 void 而非 Future<void>，且缺少异常捕获
3. setState 在 await 后调用前未检查 mounted，可能导致 widget 销毁后调用 setState 异常
4. LocalNoteRepository.saveNote 未处理新建笔记时 ID 自动生成的场景
5. TrashService 将删除时间和原始ID编码在ID中，依赖字符串解析，不够健壮

## What Changes

### 1. TrashService 修复
- trashId 生成改用 uuid，格式改为 `${note.id}_trash_${uuid}` 保留原始ID前缀用于恢复，但不再依赖时间戳解析删除时间
- 新增内部字段或使用 note.updatedAt 记录删除时间（移动到回收站时更新 updatedAt 为当前时间，用于排序和过期清理）
- 修改 `_getDeletedTime` 不再从ID解析，直接使用 note.updatedAt
- `_getOriginalId` 仍可从ID前缀解析（格式保留 `${originalId}_trash_`）

### 2. Templates 服务修复
- `template_service.dart:176`: createFromContent 中自定义模板ID改用 uuid（`custom_${Uuid().v4()}`）
- `template_gallery.dart:89`: _applyTemplate 中创建笔记改用 repo.generateId()

### 3. Daily Notes 服务检查
- daily_note_service.dart 使用 filePath.hashCode 生成确定性ID，这是基于文件路径的合理设计（同一文件路径始终生成相同ID），且未使用时间戳，无需修改为随机uuid
- 检查 daily_note_storage 文件确认无时间戳ID问题

### 4. 所有笔记ID生成统一
替换以下位置的 `DateTime.now().millisecondsSinceEpoch.toString()` 为 repo.generateId()：
- app.dart:170（欢迎笔记）
- app.dart:323（新建笔记命令）
- app.dart:374（复制笔记命令）
- sliding_panes_container.dart:351（_createNewNote）
- sidebar_container.dart:491（_createNote）
- sidebar_container.dart:904（_duplicateNote）
- file_picker_service.dart:40（importFromPath）- 需要注入 NoteRepository 或直接使用 Uuid
- import_export_panel.dart:366（导入时fallback ID）改用 Uuid().v4()

### 5. LocalNoteRepository.saveNote 改进
- 若传入 note.id 为空，自动调用 generateId() 生成新ID
- 保留自动更新 updatedAt 的逻辑（当前已正确实现）
- 新建笔记时若 createdAt 为空，设置为当前时间

### 6. SlidingPanesContainer async 方法修复
- `_openTodayNote`: 返回类型从 `void` 改为 `Future<void>`，已有try-catch保留
- `_openLocalFile`: 返回类型从 `void` 改为 `Future<void>`，添加 try-catch 错误处理

### 7. ImportExportPanel mounted 检查
- 所有 await 之后的 setState 调用前添加 `if (!mounted) return;` 检查
- 覆盖方法：_exportCurrent, _exportAll, _copyAllToClipboard, _importFromJson

## Impact

- 影响文件：
  - lib/core/services/trash_service.dart
  - lib/core/services/file_picker_service.dart
  - lib/features/templates/services/template_service.dart
  - lib/features/templates/widgets/template_gallery.dart
  - lib/features/sliding_panes/widgets/sliding_panes_container.dart
  - lib/features/import_export/widgets/import_export_panel.dart
  - lib/features/sidebar/widgets/sidebar_container.dart
  - lib/app.dart
  - lib/providers/note_provider.dart
- uuid 依赖已在 pubspec.yaml 中，无需新增依赖
- 回收站的过期清理逻辑改用 note.updatedAt 判断，已有回收站数据不受影响（旧数据的 updatedAt 即为删除时间附近的值）
- 新建笔记ID从时间戳改为uuid后，ID格式发生变化，但不影响已有数据

## 设计决策（Grill-Me 结论）

1. **TrashService ID设计**：不彻底重构为独立字段，保留 `${originalId}_trash_${uuid}` 格式：
   - 理由：最小改动原则，保留从trashId快速解析originalId的能力，避免修改NoteModel添加deletedAt字段
   - 删除时间改用 note.updatedAt（moveToTrash时更新为当前时间），过期清理和排序均使用updatedAt，不再从ID解析
   - 风险：旧的回收站数据ID格式为 `${id}_trash_${timestamp}`，_getOriginalId 仍能正确解析（split('_trash_').first），兼容旧数据

2. **Daily Note ID**：不改为随机uuid，保留基于filePath的hashCode：
   - 理由：日记是基于文件系统的，需要确定性ID（同一路径始终得到同一ID），这样才能正确识别"今日日记已存在"的场景
   - hashCode虽有理论碰撞风险，但对于单用户知识库场景实际可接受；若需更强保证可后续改为crypto哈希，但非本次任务范围

3. **FilePickerService**：直接使用 `Uuid().v4()` 而非注入repository：
   - 理由：FilePickerService是底层服务，直接使用uuid更简单，避免循环依赖；项目已多处直接使用Uuid()

4. **saveNote自动生成ID**：仅在id为空时生成，不强制覆盖已有ID：
   - 理由：导入笔记、复制笔记等场景可能需要保留原有ID；空ID才自动生成符合"最小意外"原则

5. **version_service.dart版本ID**：不修改，保留时间戳：
   - 理由：任务明确要求"作为笔记ID的地方"替换，版本历史ID需要按时间排序，时间戳在版本场景下是合理的
