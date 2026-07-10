# 审计验收清单

- [ ] 所有目标目录下的 .dart 文件已被检查
- [ ] TODO/FIXME/HACK 注释已全部列出并标注位置
- [ ] async 操作缺少 try-catch 的问题已识别
- [ ] fire-and-forget async 调用（未 await）已识别
- [ ] Notifier dispose 和生命周期问题已检查
- [ ] async 间隙后 mounted 检查缺失已识别
- [ ] 潜在 UI 溢出问题已识别
- [ ] TextField 焦点和文本选择问题已识别
- [ ] 每个问题都包含文件路径、行号、严重度
- [ ] 问题按严重度排序（critical > high > medium > low）
- [ ] 最终报告用中文输出，结构清晰
