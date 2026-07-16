# 任务清单

## 任务 1: 修复 `_scrollToOffset` 支持实时预览模式
- [x] 修改 `_scrollToOffset` 方法，添加对实时预览模式的支持
- [x] 验证从侧边栏大纲点击跳转在实时预览模式下正常工作

## 任务 2: 在实时预览模式下支持 WikiLink 补全
- [x] 修改 `_checkWikiLinkTrigger`，让它也支持实时预览模式
- [x] 将 wiki link 补全 UI 从 `_buildEditMode` 移到 `_buildEditorArea` 外层
- [x] 修改 `_handleHardwareKey` 的焦点检查，支持实时预览模式
- [x] 修改 `_applyWikiLinkCompletion` 和 `_wikiLinkConfirm` 的焦点处理
- [x] 修改 `_switchToMode`，切换到实时预览时不关闭补全
- [x] 调整 `_getCaretLocalY`，适配两种模式的不同 padding

## 任务 3: 改进焦点管理
- [x] 切换到实时预览模式时，编辑器自动获得焦点（通过 initialCursorOffset 和 focusLine）
- [x] 确保焦点切换流畅

## 任务 4: 验证和测试
- [x] 运行 `dart analyze` 检查代码质量
- [x] 运行 `flutter test` 确保现有测试通过
- [x] 运行 `flutter build macos --debug` 确保构建成功
