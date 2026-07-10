# Tasks

- [x] T1: 修复 _doSave 方法：添加 try-catch，失败时显示错误 SnackBar
- [x] T2: 修复 _autoSave Timer 回调：添加 try-catch
- [x] T3: 修复 _loadNote 方法：添加 try-catch，失败时设置 _noteNotFound = true 并显示错误提示
- [x] T4: 修复创建新笔记（第1262行）：使用 noteRepository.generateId() 替代时间戳 ID
- [x] T5: 修复 dispose()：使用 addPostFrameCallback 安全执行保存
- [x] T6: 修复 didUpdateWidget：保存失败也要继续加载新笔记
