# 验收清单

## 功能验收

- [x] 从源码模式切换到实时预览时，光标保持在同一行（通过 initialCursorOffset 实现）
- [x] 从实时预览切换回源码模式时，光标位置合理（通过 _syncToController 同步 selection）
- [x] 模式切换时滚动位置基本保持一致（共享同一个 ScrollController）
- [x] 实时预览模式下，点击工具栏粗体按钮可以为选中文本添加/移除粗体格式（通过 _textController 同步）
- [x] 实时预览模式下，点击工具栏斜体按钮可以为选中文本添加/移除斜体格式（通过 _textController 同步）
- [x] 实时预览模式下，点击工具栏标题按钮可以添加/移除标题（通过 _textController 同步）
- [x] 实时预览模式下，点击工具栏列表按钮可以添加/移除列表（通过 _textController 同步）
- [x] 实时预览模式下，Ctrl+Z 可以撤销操作（共享 _textController 和历史记录）
- [x] 实时预览模式下，Ctrl+Y 可以重做操作（共享 _textController 和历史记录）
- [x] 实时预览模式下，Enter 键正确换行并延续无序列表格式
- [x] 实时预览模式下，Enter 键正确换行并延续有序列表格式
- [x] 实时预览模式下，Enter 键正确换行并延续任务列表格式
- [x] 实时预览模式下，Enter 键正确换行并延续引用格式
- [x] 实时预览模式下，Backspace 在行首可以合并到上一行
- [x] 实时预览模式下，方向键可以在行间正常移动
- [x] 实时预览模式下，非光标行显示渲染后的 Markdown
- [x] 实时预览模式下，光标所在行显示原始 Markdown 可编辑

## 代码质量验收

- [x] `dart analyze` 无新增 error/warning
- [x] `flutter test` 全部通过（89 个测试）
- [x] 代码符合现有代码风格
- [x] macOS 构建成功
