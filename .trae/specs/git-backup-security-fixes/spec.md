# Git Backup 安全与健壮性修复 Spec

## Why（为什么做）
当前 Git 备份实现存在以下问题：
1. clone 使用子目录方式而非当前目录，不符合使用场景
2. 使用 `--allow-empty` 产生无意义空提交
3. 同步 IO 操作可能阻塞 UI 线程
4. 初始加载没有加载状态，用户体验差
5. `runInShell: true` 存在命令注入安全风险
6. 部分方法缺少完善的错误处理

## What Changes（改什么）

### MODIFIED: lib/core/services/git_backup_service.dart
1. **clone 方法修复**：
   - 使用 `git clone <url> .` 克隆到当前目录
   - 异步检查目录是否为空（使用 list() 而非 listSync()）
   - clone 前异步确保目录存在
2. **commit 方法修复**：
   - 移除 `--allow-empty` 参数
   - 内部先检查 hasChanges()，无变更时返回成功但标记"无变更需要提交"
3. **IO 异步化**：
   - `_ensureDir()` 改为 async，使用 `exists()` 和 `create(recursive: true)` 替代同步方法
   - `clone()` 中使用 `await dir.list().isEmpty` 替代 `listSync().isNotEmpty`
4. **安全修复**：
   - 移除 `_runGit()` 中的 `runInShell: true`
5. **错误处理**：
   - 确保所有公共方法都有适当的错误处理（_runGit 已有 try-catch，其他方法依赖 GitResult 返回）

### MODIFIED: lib/providers/git_backup_provider.dart
1. **状态扩展**：
   - GitBackupState 添加 `isLoading` 字段，表示配置加载中
   - 初始状态 isLoading = true
2. **_loadFromStorage 异步化**：
   - 改为 async 方法
   - 加载完成后设置 isLoading = false
3. **错误处理增强**：
   - 确保所有异步方法都有完善的 try-catch
   - _saveToStorage 和 _initService 也改为 async 并添加错误处理

## Impact（影响范围）
- lib/core/services/git_backup_service.dart
- lib/providers/git_backup_provider.dart
- 使用 gitBackupProvider 的 UI 组件（需要处理 isLoading 状态）

## 设计决策
1. **空目录检查**：保持严格检查，任何文件存在都不允许 clone，避免数据丢失
2. **空提交处理**：service 层 commit 内部检查 hasChanges，无变更返回成功（exitCode=0）但 stdout 提示，provider 层可以据此不更新 lastBackupTime
3. **异步 _ensureDir**：所有调用 _ensureDir 的方法必须 await，确保目录创建完成
4. **加载状态**：使用独立的 isLoading 字段而非复用 SyncStatus，因为 SyncStatus 用于表示同步操作状态，加载是初始化过程
5. **_saveToStorage 异步化**：Hive 的 put 操作是异步的，改为 async 确保数据写入完成
