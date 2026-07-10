# Checklist

- [x] C1: _doSave 有 try-catch 包裹，异常时显示红色 SnackBar 错误提示
- [x] C2: _autoSave 的 Timer 回调内有 try-catch 保护
- [x] C3: _loadNote 有 try-catch 包裹，异常时设置 _noteNotFound = true 并显示错误
- [x] C4: 创建新笔记使用 UUID（generateId()）而非时间戳
- [x] C5: dispose() 使用 addPostFrameCallback 安全保存，避免访问已销毁 context
- [x] C6: didUpdateWidget 中无论保存成功失败，都会执行 _loadNote()（使用 whenComplete）
- [x] C7: 代码通过静态分析（dart analyze）无错误
