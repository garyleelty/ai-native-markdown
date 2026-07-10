# Tasks

- [x] T1: 修复 sidebar_provider.dart - 为 toggleTask/renameTag/deleteTag/deleteNote/renameNote 添加 try-catch
- [x] T2: 修复 sliding_panes_container.dart - _createNewNote 添加 try-catch 和 SnackBar 错误提示
- [x] T3: 修复 sliding_panes_container.dart - _finishEditing 添加 try-catch、mounted 检查，失败时恢复状态
- [x] T4: 修复 sidebar_container.dart - _createNote 添加 try-catch 和 SnackBar，修复对话框 controller dispose
- [x] T5: 修复 sidebar_container.dart - _doRename 添加 try-catch 和 SnackBar，修复对话框 controller dispose
- [x] T6: 修复 sidebar_container.dart - _duplicateNote 添加 try-catch 和 SnackBar
- [x] T7: 修复 sidebar_container.dart - 删除笔记操作、_openFile 添加 try-catch 和 SnackBar
- [x] T8: 修复 sidebar_container.dart - renameTag/deleteTag 调用处添加 try-catch 和 SnackBar，修复对话框 controller dispose
- [x] T9: 修复 trash_panel.dart - _restoreNote/_deletePermanently/_emptyTrash 添加 try-catch 和 SnackBar
- [x] T10: 全局检查 - 确保所有 void async 改为 Future<void> async，所有 await 后 setState/context 操作前检查 mounted

## 任务依赖
- T1 无依赖，可先行 ✓
- T2-T3 依赖：无（sliding_panes 独立）✓
- T4-T8 依赖：无（sidebar_container 独立，但建议按顺序）✓
- T9 依赖：无（trash_panel 独立）✓
- T10 依赖：T1-T9 全部完成后进行最终检查 ✓
