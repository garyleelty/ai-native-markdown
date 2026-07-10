# 插件系统问题修复

## Why

当前插件系统存在多个稳定性问题：
1. `resumePlugin` 方法缺少 null 检查，在 storage 未初始化时会崩溃
2. `AiChatPlugin` 在 `onActivate` 和 `getCommands` 中重复注册命令，导致命令重复
3. `PluginApiImpl` 存在三个问题：
   - `getStorage` 方法未实现
   - 持有失效的 `WidgetRef` 可能导致问题
   - 缺少事件取消注册方法（offNoteOpened/offNoteSaved 等）
4. 插件禁用状态没有持久化，重启应用后禁用的插件会重新激活

## What Changes

### 1. 修复 plugin_registry.dart
- 在 `resumePlugin` 方法中对 `_storages[pluginId]` 添加 null 检查
- 如果 storage 不存在则重新创建
- 添加插件状态持久化逻辑：
  - 在 `pausePlugin` 和 `activatePlugin` 时保存状态到 Hive
  - 在 `_restorePluginStates` 中读取并恢复禁用状态
  - 使用 PluginStorage 或独立的 Hive box 存储插件状态

### 2. 修复 ai_chat_plugin.dart
- 移除 `onActivate` 中的命令注册代码
- 只通过 `getCommands()` 返回命令列表（由 PluginRegistry 统一注册）

### 3. 修复 plugin_api_impl.dart
- 实现 `getStorage` 方法：通过 PluginRegistry 获取对应插件的 storage
- 不直接持有 WidgetRef，改用 Ref 容器或 Provider 方式访问（可选，保持兼容但确保安全）
- 添加事件取消注册方法：
  - `offNoteOpened`
  - `offNoteSaved`
  - `offEntitiesRecognized`
  - `offPaneStackChanged`
- 更新 plugin_api.dart 接口添加这些 off 方法

## Impact

- 修改文件：
  - `lib/core/plugin/plugin_registry.dart`
  - `lib/core/plugin/plugin_api.dart`
  - `lib/core/builtin_plugins/ai_chat_plugin.dart`
  - `lib/core/services/plugin_api_impl.dart`
- 影响范围：插件生命周期管理、命令注册、事件系统、状态持久化
- 向后兼容：保持现有 API 签名，只添加新方法

## 设计决策

### 自我拷问

1. **resumePlugin 的 null 检查**：storage 确实可能为 null（比如插件注册后未激活直接暂停），所以必须处理，选择在 null 时重新创建 storage。

2. **命令重复注册问题**：PluginRegistry.activatePlugin 已经会调用 getCommands() 注册命令，所以插件不应该在 onActivate 中再次注册，否则会重复。

3. **WidgetRef 失效问题**：考虑到改动范围，先不重构 WidgetRef 的持有方式，而是确保 getStorage 能正常工作。事件监听器存储在 PluginApiImpl 实例中，需要提供 off 方法让插件可以取消注册，避免内存泄漏。

4. **插件状态持久化**：使用一个全局的 Hive box 来存储插件状态（plugin_states），键是 pluginId，值是 bool（true 表示启用，false 表示禁用）。在 pausePlugin 时保存为 false，activatePlugin 时保存为 true，初始化时读取这个状态，禁用的插件不自动激活。

5. **事件取消注册**：添加 off* 方法，允许插件传入之前注册的回调进行移除，这是标准的事件监听器模式。

## ADDED/MODIFIED Requirements

1. ✅ resumePlugin 方法必须检查 storage 是否为 null，为 null 时重新创建
2. ✅ AiChatPlugin 只能通过 getCommands() 提供命令，不能在 onActivate 中注册
3. ✅ PluginApi 必须实现 getStorage 方法
4. ✅ PluginApi 必须提供 offNoteOpened、offNoteSaved、offEntitiesRecognized、offPaneStackChanged 方法
5. ✅ 插件禁用后重启应用必须保持禁用状态
