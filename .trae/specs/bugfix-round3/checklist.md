# Checklist

- [x] _syncToFile 是 async 方法，使用 await 写入并递归创建父目录
- [x] _NotePanelState 类中有 bool _noteNotFound = false 字段
- [x] _loadNote 中 note == null 时设置 _noteNotFound = true 并 return
- [x] build 方法在 Column 之前检查 _noteNotFound 并返回 _buildNoteNotFound()
- [x] _buildNoteNotFound 方法包含错误图标、文字提示和关闭面板按钮
- [x] AIContext.activePaneId 类型是 String?（可空）
- [x] aiContextProvider 使用 paneState.activeNoteId（不使用 ?? ''）
- [x] _openNoteForDay 解构 isNew，使用 wasNew 标记新笔记
- [x] 新建笔记后调用 _loadMonthData() 刷新日历
- [x] flutter analyze 无 error/warning（仅有 pre-existing info 提示）
