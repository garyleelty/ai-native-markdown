# Checklist

- [x] git clone 使用 `git clone <url> .` 语法克隆到当前目录
- [x] clone 前使用异步方法检查目录是否为空
- [x] commit 方法已移除 --allow-empty 参数
- [x] commit 前检查 git status --porcelain，无变更时不提交
- [x] 所有同步 IO（existsSync/createSync/listSync）已替换为异步方法
- [x] _ensureDir 已改为 async 方法
- [x] _loadFromStorage 已改为 async 方法
- [x] GitBackupState 包含 isLoading 字段，初始为 true，加载完成后为 false
- [x] 所有 Process.run 调用已移除 runInShell: true
- [x] 所有公共方法都有适当的 try-catch 错误处理
- [x] dart analyze 无错误和警告
