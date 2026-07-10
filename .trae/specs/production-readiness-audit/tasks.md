# 审计任务列表

- [ ] T1: 读取所有目标文件内容（可并行）
  - 依赖：无
- [ ] T2: 搜索 TODO/FIXME/HACK 注释
  - 依赖：T1
- [ ] T3: 搜索 async/await 相关问题（无 try-catch、fire-and-forget）
  - 依赖：T1
- [ ] T4: 搜索 Notifier 生命周期问题（dispose、内存泄漏）
  - 依赖：T1
- [ ] T5: 搜索 mounted 检查缺失问题
  - 依赖：T1
- [ ] T6: 搜索 UI 溢出相关代码（Column/Row 无 Expanded、SingleChildScrollView）
  - 依赖：T1
- [ ] T7: 搜索 TextField 焦点和文本选择相关问题
  - 依赖：T1
- [ ] T8: 人工验证所有发现的问题，确认上下文并分级
  - 依赖：T2-T7
- [ ] T9: 整理并生成结构化问题报告
  - 依赖：T8
