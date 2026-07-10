# Git 备份与恢复 - 任务列表

## 任务依赖图
```
Task 1 (GitBackupService) ──┐
                            ├── Task 3 (设置页 UI) ── Task 4 (命令面板) ── Task 5 (验证)
Task 2 (Provider) ──────────┘
```

## 任务列表

- [x] **Task 1: 实现 GitBackupService 核心服务**
  - 文件：`lib/core/services/git_backup_service.dart`
  - 内容：封装 git 命令调用（init, add, commit, push, pull, status, log, diff）
  - 依赖：无
  - 可并行：是（与 Task 2 可并行）

- [x] **Task 2: 实现 gitBackupProvider 状态管理**
  - 文件：`lib/providers/git_backup_provider.dart`
  - 内容：配置状态（仓库URL、用户名、邮箱、自动备份开关）、同步状态、上次备份时间
  - 依赖：无
  - 可并行：是（与 Task 1 可并行）

- [x] **Task 3: 实现设置页 Git 备份配置 UI**
  - 文件：`lib/features/settings/widgets/settings_page.dart`
  - 内容：添加 Git 备份设置区，包括仓库配置、手动备份/恢复按钮、状态显示
  - 依赖：Task 1, Task 2

- [x] **Task 4: 添加命令面板集成**
  - 文件：`lib/features/command_palette/services/command_registry.dart`, `lib/app.dart`
  - 内容：添加"Git: 立即备份"、"Git: 从远程恢复"、"Git: 备份设置"命令
  - 依赖：Task 1, Task 2

- [x] **Task 5: 测试与验证**
  - 内容：运行现有测试，macOS Debug 构建验证
  - 依赖：Task 3, Task 4
  - 结果：89 个测试通过，dart analyze 无 errors，macOS Debug 构建成功
