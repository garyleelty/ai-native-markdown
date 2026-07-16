# 编辑器模式一致性修复进度

## Round 1 - 开始

- 已完成：创建 spec、tasks、checklist
- 进行中：开始修复第一个问题（_scrollToOffset）
- 阻塞/风险：无
- 下一轮计划：修复 _scrollToOffset 和焦点管理

## Round 2 (DONE) - 所有修复完成

- 已完成：
  1. 修复 `_scrollToOffset` 支持实时预览模式
  2. 在实时预览模式下支持 WikiLink 补全
     - 修改 `_checkWikiLinkTrigger` 支持实时预览模式
     - 将补全 UI 从 `_buildEditMode` 移到 `_buildEditorArea` 外层
     - 修改键盘事件处理的焦点检查
     - 调整补全位置计算适配两种模式
  3. 改进焦点管理
  4. 所有 89 个测试通过
  5. dart analyze 无新增错误
  6. macOS 构建成功

- 总结：
  编辑器三种模式（源码、实时预览、阅读）的功能一致性已大幅提升。
  实时预览模式现在支持：
  - 工具栏格式化按钮
  - 键盘快捷键（Ctrl+B/I/K/Z/Y/F 等）
  - 撤销/重做
  - WikiLink 补全（[[ 触发）
  - 大纲导航滚动
  - 搜索替换功能
  - 状态栏光标位置显示
