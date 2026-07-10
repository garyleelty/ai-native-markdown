# Checklist

- [x] widget_test.dart 中正确初始化 Hive（使用 testPath 参数）
- [x] widget test 能成功 pumpWidget 并找到 AeroMind 相关文本
- [x] flutter test 所有 89 个测试通过（0 failures）
- [x] 所有 `withOpacity()` 调用已替换为 `withValues(alpha:)`
- [x] 所有 Switch `activeColor` 已替换为 `activeThumbColor`
- [x] 目标文件的 dangling_library_doc_comments 已修复（添加 library 指令）
- [x] use_build_context_synchronously 警告已添加 mounted 检查
- [x] prefer_interpolation_to_compose_strings 已修复为字符串插值
- [x] dart analyze lib/ test/ 无 error 和 warning（info 级别可接受）
