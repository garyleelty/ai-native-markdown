# 任务清单

## 任务 1: 光标位置同步 - 模式切换时保持光标位置
- [x] 在 `_switchToMode` 中，切换到实时预览时根据 `_textController.selection` 计算光标所在行
- [x] 在 `LiveMarkdownEditor` 中添加 `initialCursorOffset` 参数来设置初始光标位置
- [x] 从实时预览切换回源码模式时，根据当前编辑行计算 `_textController.selection`
- [x] 添加 `_getLineFromOffset` 和 `_getOffsetInLine` 辅助方法
- [x] 在 `_syncToController` 中同步 selection 到主 controller

## 任务 2: 滚动位置同步 - 模式切换时保持滚动位置
- [x] 确保 `NotePanel` 的 `_scrollController` 传递给 `LiveMarkdownEditor`
- [x] 源码模式和实时预览模式共享同一个 `ScrollController`

## 任务 3: 工具栏按钮在实时预览模式下正常工作
- [x] 验证工具栏格式化按钮（粗体、斜体、标题、列表等）在实时预览模式下正常工作
- [x] 格式化操作通过 `_textController` 进行，然后通过 `_onControllerChanged` 同步到 `_lineControllers`
- [x] 给每个 line controller 添加 listener，监听文本和 selection 变化

## 任务 4: 撤销/重做在实时预览模式下工作
- [x] 验证 `_undo` 和 `_redo` 方法在实时预览模式下正常工作
- [x] 撤销/重做历史在两种模式间共享（通过 `_textController`）

## 任务 5: 快捷键支持
- [x] 将快捷键和 Actions 从 `_buildEditMode` 提升到 `_buildEditorArea` 外层
- [x] 源码模式和实时预览模式共享同一套快捷键
- [x] 支持的快捷键：粗体(Ctrl+B)、斜体(Ctrl+I)、链接(Ctrl+K)、撤销(Ctrl+Z)、重做(Ctrl+Y)、搜索(Ctrl+F)

## 任务 6: 实时预览编辑器内部改进
- [x] 确保 Enter 键正确延续列表、任务列表、引用格式
- [x] 确保 Backspace 在行首可以合并到上一行
- [x] 确保方向键可以在行间正常移动
- [x] 状态栏在实时预览模式下也显示光标位置

## 任务 7: 验证和测试
- [x] 运行 `dart analyze` 检查代码质量
- [x] 运行 `flutter test` 确保现有测试通过
- [ ] 手动验证所有验收项
