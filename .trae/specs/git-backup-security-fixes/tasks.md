# Tasks

- [x] Task 1: 修复 git_backup_service.dart（clone/commit/异步IO/安全/错误处理）
  - 依赖：无
  - 可并行：是（与 Task 2 可并行，但先做 service 更合理）
- [x] Task 2: 修复 git_backup_provider.dart（异步加载/状态/错误处理）
  - 依赖：Task 1
  - 可并行：否
- [x] Task 3: 运行静态分析验证修复
  - 依赖：Task 2
  - 可并行：否
- [x] Task 4: 更新 progress.md
  - 依赖：Task 3
  - 可并行：否
