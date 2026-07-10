# Progress

## Round 1

- 已完成：spec.md、tasks.md、checklist.md 创建完成
- 进行中：开始实现所有修复
- 阻塞/风险：无
- 下一轮计划：完成所有代码修改，运行 dart analyze 验证

## Round 1 (DONE)

- 已完成：
  1. 三个笔记创建位置（欢迎笔记、新建笔记、复制笔记）都已使用 repo.generateId() 替代时间戳ID
  2. 四个异步方法（_openTodayDailyNote、_showRenameDialog、_showDeleteConfirmDialog、_buildGraphData）返回类型已改为 Future<void>
  3. _openTodayDailyNote 的 catch 块添加了 debugPrint 错误日志
  4. dispose() 中添加了 HiveService.closeHive() 调用
  5. _showRenameDialog 的 TextEditingController 使用 showDialog().then() 在对话框关闭后正确 dispose
  6. _buildGraphData 添加了 try-catch，异常时降级到 _buildDemoGraph() 并记录错误
  7. 实现了 Overlay 互斥：
     - 原 _closeAllOverlays 重命名为 _closeTopOverlay（保持 if-else 链，ESC键调用，只关最上层）
     - 新增真正的 _closeAllOverlays() 方法（关闭所有overlay，无动画，打开新overlay前调用）
     - 所有打开overlay的入口（命令面板/QuickSwitcher/模板/插件/设置/图谱/速查表/欢迎/导入导出）都在打开前调用 _closeAllOverlays()
  8. dart analyze 通过，无任何问题
- 进行中：无
- 阻塞/风险：无
- 所有任务已完成，checklist 全部通过
