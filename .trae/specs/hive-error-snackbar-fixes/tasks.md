# Tasks

- [x] T1: 修复 hive_service.dart 中的危险降级逻辑（移除第80-84行的 try-catch + Hive.init('.') 逻辑）
- [x] T2: 创建 lib/core/utils/ 目录并新建 error_utils.dart，实现 showErrorSnackBar 和 showSuccessSnackBar 函数
- [x] T3: 修复 lib/app.dart 中的空 catch 块（第157行）
- [x] T4: 修复 lib/features/calendar/widgets/calendar_view.dart 中的空 catch 块（第107行）
- [x] T5: 修复 lib/providers/settings_provider.dart 中的3个空 catch 块
- [x] T6: 修复 lib/features/sliding_panes/widgets/sliding_panes_container.dart 中的空 catch 块
- [x] T7: 修复 lib/providers/git_backup_provider.dart 中的3个空 catch 块
- [x] T8: 修复 lib/providers/sidebar_provider.dart 中的5个空 catch 块
- [x] T9: 修复 lib/core/services/plugin_api_impl.dart 中的4个空 catch 块
- [x] T10: 修复 lib/core/services/git_backup_service.dart 中的空 catch 块
- [x] T11: 修复 lib/core/plugin/plugin_registry.dart 中的空 catch 块
- [x] T12: 修复 lib/core/builtin_plugins/word_count_plugin.dart 中的空 catch 块
- [x] T12b: 补充修复 lib/features/editor/widgets/note_panel.dart 中漏掉的2个空 catch 块
- [x] T13: 运行 flutter analyze 验证代码无错误

## 依赖关系
- T1, T2 无依赖，可并行执行
- T3-T12 无依赖于 T1/T2，可并行执行
- T13 依赖所有 T1-T12 完成
