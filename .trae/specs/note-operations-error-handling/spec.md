# 笔记操作错误处理修复 Spec

## Why
当前笔记相关操作（创建、重命名、复制、删除、恢复、标签操作等）缺乏统一的错误处理机制：
1. 异步操作失败时无用户反馈，仅 debugPrint 或静默失败
2. 对话框中创建的 TextEditingController 未正确 dispose，存在内存泄漏
3. 部分 async 方法声明为 void async，不符合最佳实践
4. await 后调用 setState 前缺少 mounted 检查，可能导致组件销毁后调用 setState 的异常
5. Provider 层操作（toggleTask/renameTag/deleteTag）无异常捕获

## What Changes

### 1. sliding_panes_container.dart
- `_createNewNote`：添加 try-catch，失败时显示 SnackBar 错误提示
- `_finishEditing`：添加 try-catch，await 后 setState 前检查 mounted，失败时恢复 UI 状态并显示错误提示
- 注：该文件中无 `_doRename` 和 `_duplicateNote`，这两个方法实际在 sidebar_container.dart 中

### 2. sidebar_container.dart
- `_createNote`（_SidebarContentHeader 中）：添加 try-catch 和 SnackBar 错误提示
- `_doRename`（_NoteTreeTileState 中）：添加 try-catch 和 SnackBar 错误提示
- `_duplicateNote`（_NoteTreeTileState 中）：添加 try-catch 和 SnackBar 错误提示
- 删除确认对话框的 onPressed 回调：添加 try-catch 和 SnackBar 错误提示
- `_openFile`（_OpenFileButtons 中）：添加 try-catch 和 SnackBar 错误提示
- 标签重命名 `renameTag` 调用处：添加 try-catch 和 SnackBar 错误提示
- 标签删除 `deleteTag` 调用处：添加 try-catch 和 SnackBar 错误提示
- 修复对话框 TextEditingController 泄漏问题：将对话框内容包装为 StatefulWidget 以正确 dispose controller
- 检查并修复所有 void async 方法为 Future<void> async

### 3. trash_panel.dart
- `_restoreNote`：添加 try-catch 和 SnackBar 错误提示
- `_deletePermanently`：添加 try-catch 和 SnackBar 错误提示
- `_emptyTrash`：添加 try-catch 和 SnackBar 错误提示

### 4. sidebar_provider.dart
- `toggleTask`：添加 try-catch，失败时 debugPrint 并返回
- `renameTag`：添加 try-catch，失败时 debugPrint 并返回
- `deleteTag`：添加 try-catch，失败时 debugPrint 并返回
- `deleteNote`：添加 try-catch
- `renameNote`：添加 try-catch

### 5. 通用修复
- 所有 `void async` 方法改为 `Future<void> async`
- 所有 await 后调用 setState 前必须检查 `if (mounted)`
- 对话框中创建的 TextEditingController 必须正确 dispose（使用 StatefulWidget 包装对话框内容）
- 错误信息使用用户友好的中文提示，通过 ScaffoldMessenger 显示 SnackBar

## 设计决策（Grill-me 自我拷问结论）

1. **对话框 controller 生命周期**：
   - 问：showDialog 中直接创建 TextEditingController，如何正确 dispose？
   - 答：最佳实践是创建一个私有的 StatefulWidget 作为对话框内容，在该 State 的 dispose 方法中 dispose controller。或者使用 `showDialog` 的 `builder` 返回一个 StatefulWidget。我们采用后者。

2. **错误提示位置**：
   - 问：Provider 层出错时如何通知 UI？
   - 答：Provider 层只捕获异常并 debugPrint，异常继续向上抛出给 UI 层，由 UI 层显示 SnackBar。这样保持 Provider 的纯净性，UI 负责用户反馈。

3. **TrashPanel 是 ConsumerWidget 无 setState**：
   - 问：TrashPanel 是 StatelessWidget，操作失败后如何刷新 UI？
   - 答：通过 `ref.read(_trashVersionProvider.notifier).state++` 触发 FutureBuilder 重建即可，无需 setState。

4. **mounted 检查范围**：
   - 问：哪些地方需要 mounted 检查？
   - 答：所有在 State 类中、await 之后调用 setState 或访问 context（如 Navigator.pop、ScaffoldMessenger）的地方都需要检查 mounted。

5. **重复代码处理**：
   - 问：是否需要抽取统一的错误提示工具方法？
   - 答：本任务仅修复现有问题，不做过度重构。错误提示代码直接内联，保持简单。

## Impact
- 影响文件：
  - lib/features/sliding_panes/widgets/sliding_panes_container.dart
  - lib/features/sidebar/widgets/sidebar_container.dart
  - lib/features/sidebar/widgets/trash_panel.dart
  - lib/providers/sidebar_provider.dart
- 不影响数据模型和业务逻辑，仅添加异常捕获和用户反馈
- 不破坏现有 API，所有方法签名保持兼容（仅 void async → Future<void> async，这是兼容的）

## ADDED/MODIFIED Requirements

### R1: sliding_panes_container.dart 错误处理
- _createNewNote 必须有 try-catch
- _createNewNote 失败时显示 SnackBar 错误提示
- _finishEditing 必须有 try-catch
- _finishEditing 在 await 后 setState 前检查 mounted
- _finishEditing 失败时恢复 UI 状态并显示 SnackBar

### R2: sidebar_container.dart 错误处理
- _createNote 必须有 try-catch 和 SnackBar
- _doRename 必须有 try-catch 和 SnackBar
- _duplicateNote 必须有 try-catch 和 SnackBar
- 删除笔记操作必须有 try-catch 和 SnackBar
- _openFile 必须有 try-catch 和 SnackBar
- renameTag 调用处必须有 try-catch 和 SnackBar
- deleteTag 调用处必须有 try-catch 和 SnackBar

### R3: TextEditingController 正确 dispose
- 所有 showDialog 中创建的 TextEditingController 必须在对话框关闭后 dispose
- 通过 StatefulWidget 管理 controller 生命周期

### R4: trash_panel.dart 错误处理
- _restoreNote 必须有 try-catch 和 SnackBar
- _deletePermanently 必须有 try-catch 和 SnackBar
- _emptyTrash 必须有 try-catch 和 SnackBar

### R5: sidebar_provider.dart 错误处理
- toggleTask 必须有 try-catch
- renameTag 必须有 try-catch
- deleteTag 必须有 try-catch
- deleteNote 必须有 try-catch
- renameNote 必须有 try-catch

### R6: 方法签名规范
- 所有 async 方法必须返回 Future<void>，不得使用 void async

### R7: mounted 检查
- 所有 State 类中 await 后调用 setState、Navigator.pop、ScaffoldMessenger 等操作前必须检查 mounted
