# Git 远程备份与恢复功能

## Why

- 本地存储存在数据丢失风险（硬盘损坏、误删除等）
- 需要在多设备间同步笔记
- Git 是成熟的版本控制工具，天然支持历史回溯和冲突管理
- 用户已有使用 Git 的习惯，学习成本低

## What Changes

新增 Git 备份插件，提供以下功能：

1. **远程仓库配置**：设置远程 Git 仓库 URL、用户名、邮箱、认证方式（SSH Key / HTTPS Token）
2. **手动备份**：一键将当前笔记推送到远程仓库（commit + push）
3. **自动备份**：可选的自动备份（编辑后延迟 N 秒自动提交推送）
4. **从远程恢复**：从远程仓库拉取最新笔记，合并/覆盖本地
5. **历史版本**：查看 Git 提交历史，支持回滚到指定版本
6. **命令面板集成**：通过 `Cmd/Ctrl + K` 快速触发备份/恢复
7. **状态展示**：在状态栏或设置页显示上次备份时间、同步状态

## 实现方式

使用 `dart:io` 的 `Process.run` 调用系统 git 命令，不引入额外依赖。

### 核心组件

| 组件 | 位置 | 说明 |
|---|---|---|
| `GitBackupService` | `lib/core/services/git_backup_service.dart` | Git 操作封装（init, add, commit, push, pull, log, status） |
| `gitBackupProvider` | `lib/providers/git_backup_provider.dart` | 状态管理（配置 + 同步状态） |
| `_GitBackupSection` | `lib/features/settings/widgets/settings_page.dart` | 设置页中的 Git 备份配置区 |
| 命令注册 | `lib/features/command_palette/services/command_registry.dart` | 添加"备份到 Git"、"从 Git 恢复"、"Git 历史"命令 |

### 存储目录结构

```
<notes_directory>/
├── .git/                    # Git 仓库
├── note1.md                 # 笔记文件
├── note2.md
└── ...
```

## Impact

- **新增文件**：git_backup_service.dart, git_backup_provider.dart
- **修改文件**：settings_page.dart（添加 Git 备份设置区）, command_registry.dart（添加命令）
- **依赖**：无新增 pub 依赖，使用系统 git 命令
- **向后兼容**：默认关闭，不影响现有功能

## ADDED Requirements

1. 用户能在设置页配置远程 Git 仓库 URL 和认证信息
2. 用户能手动触发备份（commit + push），并看到进度反馈
3. 用户能从远程仓库恢复/拉取笔记
4. 用户能通过命令面板快速触发备份和恢复
5. 状态栏显示上次备份时间和同步状态
6. 支持自动备份开关（编辑后自动提交推送）
7. 错误时有清晰的提示信息（如网络错误、认证失败等）

## 设计决策（Grill-Me 拷问）

### Q: 为什么用系统 git 命令而不是 Dart 库？
A: Dart Git 库（如 `git` 包）功能有限且维护不佳，系统 git 命令完整可靠。桌面端（macOS/Linux/Windows）默认或极易安装 git。

### Q: 如何处理冲突？
A: V1 简化处理：pull 时如果有冲突，提示用户手动解决，或选择"保留本地" / "使用远程"。推荐先备份本地再 pull。

### Q: 如何认证？
A: V1 支持两种方式：
1. HTTPS + Personal Access Token（URL 中嵌入 token，如 `https://user:token@github.com/...`）
2. SSH Key（依赖系统 ssh agent 或配置好的 ssh key）

### Q: 提交什么内容？
A: 仅提交 `.md` 笔记文件，不提交应用配置和元数据（Hive 数据）。使用 `.gitignore` 排除非笔记文件。

### Q: 如何处理大型仓库？
A: V1 不做特殊优化，假设笔记仓库是小型的（百兆以内）。后续可考虑 shallow clone。
