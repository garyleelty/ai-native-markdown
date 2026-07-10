# Git 备份与恢复 - 验收清单

## 功能验收

- [ ] GitBackupService 能正确调用系统 git 命令
- [ ] gitBackupProvider 管理配置和同步状态
- [ ] 设置页有 Git 备份配置区域
- [ ] 命令面板有"备份到 Git"和"从 Git 恢复"命令
- [ ] 状态栏显示同步状态
- [ ] 错误时有清晰的提示信息

## 质量验收

- [ ] `flutter test` 全部通过
- [ ] `dart analyze lib/` 无 errors
- [ ] macOS Debug 构建成功
- [ ] 代码风格与现有项目一致
