# Checklist

## Provider 层错误处理
- [x] C1: sidebar_provider.dart 中 toggleTask 方法有 try-catch 包裹整个逻辑
- [x] C2: sidebar_provider.dart 中 renameTag 方法有 try-catch 包裹整个逻辑
- [x] C3: sidebar_provider.dart 中 deleteTag 方法有 try-catch 包裹整个逻辑
- [x] C4: sidebar_provider.dart 中 deleteNote 方法有 try-catch 包裹整个逻辑
- [x] C5: sidebar_provider.dart 中 renameNote 方法有 try-catch 包裹整个逻辑

## sliding_panes_container.dart
- [x] C6: _createNewNote 方法有 try-catch
- [x] C7: _createNewNote 失败时通过 ScaffoldMessenger 显示 SnackBar
- [x] C8: _finishEditing 方法有 try-catch
- [x] C9: _finishEditing 中 await 后 setState 前检查 mounted
- [x] C10: _finishEditing 失败时恢复 _isEditing 状态并显示 SnackBar

## sidebar_container.dart - 笔记操作
- [x] C11: _createNote 方法有 try-catch
- [x] C12: _createNote 失败时显示 SnackBar
- [x] C13: 新建笔记对话框中的 TextEditingController 正确 dispose（通过 _NewNoteDialog StatefulWidget）
- [x] C14: _doRename 方法有 try-catch
- [x] C15: _doRename 失败时显示 SnackBar
- [x] C16: 重命名对话框中的 TextEditingController 正确 dispose（通过 _RenameNoteDialog StatefulWidget）
- [x] C17: _duplicateNote 方法有 try-catch
- [x] C18: _duplicateNote 失败时显示 SnackBar
- [x] C19: 删除笔记操作有 try-catch
- [x] C20: 删除笔记失败时显示 SnackBar
- [x] C21: _openFile 方法有 try-catch
- [x] C22: _openFile 失败时显示 SnackBar

## sidebar_container.dart - 标签操作
- [x] C23: renameTag 调用处有 try-catch
- [x] C24: renameTag 失败时显示 SnackBar
- [x] C25: 重命名标签对话框中的 TextEditingController 正确 dispose（通过 _RenameTagDialog StatefulWidget）
- [x] C26: deleteTag 调用处有 try-catch
- [x] C27: deleteTag 失败时显示 SnackBar
- [x] C28: 删除标签对话框（无 controller）正确处理

## trash_panel.dart
- [x] C29: _restoreNote 方法有 try-catch
- [x] C30: _restoreNote 失败时显示 SnackBar
- [x] C31: _deletePermanently 方法有 try-catch
- [x] C32: _deletePermanently 失败时显示 SnackBar
- [x] C33: _emptyTrash 方法有 try-catch
- [x] C34: _emptyTrash 失败时显示 SnackBar

## 全局规范
- [x] C35: 没有 `void async` 方法，所有 async 方法返回 `Future<void>`
- [x] C36: 所有 StatefulWidget 中 await 后调用 setState/Navigator.pop/ScaffoldMessenger 前有 mounted 检查
- [x] C37: 所有 showDialog 中创建的 TextEditingController 都被正确 dispose（使用 StatefulWidget 包装）
- [x] C38: 代码通过 `dart analyze` 静态分析无新增错误（唯一错误是项目原有的 SearchResponse 类型问题，与本次修改无关）
