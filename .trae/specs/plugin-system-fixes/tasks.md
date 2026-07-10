# Tasks

- [x] 1. 更新 plugin_api.dart 添加事件取消注册方法（offNoteOpened 等）
  - 依赖：无
  - 可并行：是

- [x] 2. 修复 plugin_api_impl.dart
  - 实现 getStorage 方法
  - 添加 offNoteOpened/offNoteSaved/offEntitiesRecognized/offPaneStackChanged 方法
  - 依赖：任务 1
  - 可并行：否

- [x] 3. 修复 ai_chat_plugin.dart，移除 onActivate 中的重复命令注册
  - 依赖：无
  - 可并行：是

- [x] 4. 修复 plugin_registry.dart
  - resumePlugin 添加 storage null 检查
  - 实现插件状态持久化（保存/恢复禁用状态）
  - pausePlugin 时也需要注销命令
  - 依赖：任务 2
  - 可并行：否

- [x] 5. 运行静态分析验证代码正确性
  - 依赖：任务 1-4
  - 可并行：否
