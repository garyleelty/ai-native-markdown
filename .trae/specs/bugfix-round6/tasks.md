# Bugfix Round 6 — 任务列表

## 任务依赖图
```
Task 1 (快捷键冲突排查) ──┐
Task 2 (保存加固) ────────┤
Task 3 (空状态修复) ──────┼── Task 5 (验证)
Task 4 (点击链路修复) ────┘
```

## 任务列表

- [ ] **Task 1: 快捷键冲突系统性排查**
  - 内容：全项目扫描 Shortcuts 定义，检查 Enter/Tab/Backspace/方向键等 TextField 默认行为键是否被错误拦截
  - 文件：全局 grep Shortcuts/SingleActivator
  - 依赖：无
  - 可并行：是

- [ ] **Task 2: 异步保存与状态竞争加固**
  - 内容：检查所有 fire-and-forget 异步写入，确保 dispose/didUpdateWidget 等生命周期中数据安全
  - 文件：note_panel.dart, sidebar_provider.dart 等
  - 依赖：无
  - 可并行：是

- [ ] **Task 3: 空状态与初始化修复**
  - 内容：检查各 feature 初始化加载、空数据提示，避免白屏和假死
  - 文件：各 feature 的主要 widget
  - 依赖：无
  - 可并行：是

- [ ] **Task 4: 点击跳转链路修复**
  - 内容：检查反向链接、Quick Switcher、知识图谱等点击跳转的完整链路
  - 文件：backlinks_panel.dart, quick_switcher_overlay.dart, graph_canvas.dart 等
  - 依赖：无
  - 可并行：是

- [ ] **Task 5: 综合验证**
  - 内容：运行测试 + 静态分析 + 构建验证
  - 依赖：Task 1-4
