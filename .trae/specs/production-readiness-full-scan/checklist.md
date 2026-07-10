# 验收清单

- [ ] 1. 已扫描 lib/ 目录下所有 .dart 文件（排除 examples/）
- [ ] 2. 空 catch 块问题已全部识别并验证上下文
- [ ] 3. void async 方法问题已全部识别并验证上下文
- [ ] 4. 缺少 try-catch 的 async 方法已全部识别（重点关注 IO/网络/JSON 解析）
- [ ] 5. dispose 后调用 setState 问题已全部识别
- [ ] 6. 未使用 uuid 的 ID 生成问题已全部识别（先确认 pubspec.yaml 依赖）
- [ ] 7. 缺少 mounted 检查问题已全部识别（仅限 StatefulWidget 的 State 类）
- [ ] 8. 同步 IO 方法问题已全部识别
- [ ] 9. 所有问题均包含：文件路径、行号、问题类型、代码片段
- [ ] 10. 误报已全部排除（如包含日志的 catch 块、重抛异常等）
- [ ] 11. 报告按文件路径排序，输出格式清晰易读
