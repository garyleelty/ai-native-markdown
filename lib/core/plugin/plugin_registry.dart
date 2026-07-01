/// ══════════════════════════════════════════════════
/// PluginRegistry — 插件生命周期管理器
/// ══════════════════════════════════════════════════
/// 负责: 注册 / 激活 / 暂停 / 销毁插件，
///       依赖检查、事件分发、扩展点聚合。
/// ──────────────────────────────────────────────────

import 'dart:developer' as dev;
import 'package:flutter/foundation.dart';
import '../models/note_model.dart';
import 'plugin_manifest.dart';
import 'base_plugin.dart';
import 'plugin_api.dart';
import 'plugin_storage.dart';

/// 插件注册表变更事件
enum PluginEventType {
  registered,   // 新插件注册
  activated,    // 插件激活
  paused,       // 插件暂停
  resumed,      // 插件恢复
  disposed,     // 插件销毁
  error,        // 插件出错
}

/// 插件事件
class PluginEvent {
  final PluginEventType type;
  final String pluginId;
  final String? errorMessage;

  const PluginEvent({
    required this.type,
    required this.pluginId,
    this.errorMessage,
  });
}

/// 插件注册表 — 单例，管理所有插件的生命周期
class PluginRegistry {
  PluginRegistry._();
  static final PluginRegistry instance = PluginRegistry._();

  /// 已注册的插件实例映射 (pluginId → BasePlugin)
  final Map<String, BasePlugin> _plugins = {};

  /// 已注册的插件清单映射 (pluginId → manifest)
  final Map<String, PluginManifest> _manifests = {};

  /// 插件存储实例映射 (pluginId → PluginStorage)
  final Map<String, PluginStorage> _storages = {};

  /// 插件状态映射 (pluginId → state)
  final Map<String, PluginState> _states = {};

  /// 事件监听器列表
  final List<void Function(PluginEvent)> _listeners = [];

  /// 宿主应用提供的 PluginApi 实现
  PluginApi? _api;

  /// 是否已初始化
  bool _initialized = false;

  // ──────────────────────────────────────────────
  // 初始化
  // ──────────────────────────────────────────────

  /// 初始化插件系统
  ///
  /// [api] 宿主应用提供的 PluginApi 实现
  Future<void> initialize(PluginApi api) async {
    if (_initialized) return;
    _api = api;
    _initialized = true;

    // 恢复上次激活的插件列表
    await _restorePluginStates();
  }

  /// 恢复之前激活的插件状态
  Future<void> _restorePluginStates() async {
    // 从 Hive 存储中读取上次的插件启用状态
    // 当前版本简化处理：默认激活所有已注册的插件
  }

  // ──────────────────────────────────────────────
  // 注册
  // ──────────────────────────────────────────────

  /// 注册一个插件
  ///
  /// [plugin] 插件实例
  /// [autoActivate] 是否自动激活 (默认为 true，且 manifest.enabledByDefault 为 true)
  ///
  /// 返回 true 表示注册成功。
  /// 如果插件 ID 已存在，返回 false。
  Future<bool> register(BasePlugin plugin, {bool autoActivate = true}) async {
    final manifest = plugin.manifest;

    // 防止重复注册
    if (_plugins.containsKey(manifest.id)) {
      _log('插件 ${manifest.id} 已注册，跳过');
      return false;
    }

    // 检查依赖
    for (final depId in manifest.dependencies) {
      if (!_plugins.containsKey(depId)) {
        _log('插件 ${manifest.id} 缺少依赖 $depId，注册但不激活');
        _plugins[manifest.id] = plugin;
        _manifests[manifest.id] = manifest;
        _states[manifest.id] = PluginState.registered;
        _emitEvent(PluginEvent(
          type: PluginEventType.registered,
          pluginId: manifest.id,
        ));
        return true;
      }
    }

    // 注册
    _plugins[manifest.id] = plugin;
    _manifests[manifest.id] = manifest;
    _states[manifest.id] = PluginState.registered;
    _emitEvent(PluginEvent(
      type: PluginEventType.registered,
      pluginId: manifest.id,
    ));

    // 自动激活
    if (autoActivate && manifest.enabledByDefault) {
      await activatePlugin(manifest.id);
    }

    return true;
  }

  // ──────────────────────────────────────────────
  // 激活 / 暂停 / 恢复 / 销毁
  // ──────────────────────────────────────────────

  /// 激活指定插件
  Future<bool> activatePlugin(String pluginId) async {
    final plugin = _plugins[pluginId];
    final manifest = _manifests[pluginId];
    if (plugin == null || manifest == null || _api == null) return false;

    // 已激活则跳过
    if (plugin.state == PluginState.active) return true;

    // 检查依赖是否都已激活
    for (final depId in manifest.dependencies) {
      final depState = _states[depId];
      if (depState != PluginState.active) {
        _log('插件 $pluginId 的依赖 $depId 未激活');
        return false;
      }
    }

    try {
      // 获取或创建存储
      _storages[pluginId] ??= await PluginStorage.create(pluginId);

      // 构建上下文
      final ctx = PluginContext(
        manifest: manifest,
        api: _api!,
        storage: _storages[pluginId]!,
      );

      // 激活插件
      await plugin.activate(ctx);
      _states[pluginId] = PluginState.active;

      // 注册插件提供的命令
      final commands = plugin.getCommands();
      for (final cmd in commands) {
        _api!.registerCommand(cmd);
      }

      _emitEvent(PluginEvent(
        type: PluginEventType.activated,
        pluginId: pluginId,
      ));

      _log('插件 $pluginId 已激活');
      return true;
    } catch (e) {
      _states[pluginId] = PluginState.error;
      _emitEvent(PluginEvent(
        type: PluginEventType.error,
        pluginId: pluginId,
        errorMessage: e.toString(),
      ));
      _log('插件 $pluginId 激活失败: $e');
      return false;
    }
  }

  /// 暂停指定插件
  Future<void> pausePlugin(String pluginId) async {
    final plugin = _plugins[pluginId];
    if (plugin == null || plugin.state != PluginState.active) return;

    await plugin.pause();
    _states[pluginId] = PluginState.paused;
    _emitEvent(PluginEvent(
      type: PluginEventType.paused,
      pluginId: pluginId,
    ));
  }

  /// 恢复已暂停的插件
  Future<void> resumePlugin(String pluginId) async {
    final plugin = _plugins[pluginId];
    final manifest = _manifests[pluginId];
    if (plugin == null || manifest == null || _api == null) return;
    if (plugin.state != PluginState.paused) return;

    final ctx = PluginContext(
      manifest: manifest,
      api: _api!,
      storage: _storages[pluginId]!,
    );

    await plugin.resume(ctx);
    _states[pluginId] = PluginState.active;
    _emitEvent(PluginEvent(
      type: PluginEventType.resumed,
      pluginId: pluginId,
    ));
  }

  /// 销毁指定插件 (不可逆)
  Future<void> disposePlugin(String pluginId) async {
    final plugin = _plugins[pluginId];
    if (plugin == null) return;

    // 注销该插件注册的命令
    if (_api != null) {
      final commands = plugin.getCommands();
      for (final cmd in commands) {
        _api!.unregisterCommand(cmd.id);
      }
    }

    await plugin.dispose();
    _plugins.remove(pluginId);
    _manifests.remove(pluginId);
    _states.remove(pluginId);

    // 关闭存储
    await _storages[pluginId]?.close();
    _storages.remove(pluginId);

    _emitEvent(PluginEvent(
      type: PluginEventType.disposed,
      pluginId: pluginId,
    ));
  }

  // ──────────────────────────────────────────────
  // 查询
  // ──────────────────────────────────────────────

  /// 获取所有已注册插件的清单
  List<PluginManifest> get allManifests => _manifests.values.toList();

  /// 获取所有已激活插件的清单
  List<PluginManifest> get activeManifests {
    return _plugins.entries
        .where((e) => e.value.state == PluginState.active)
        .map((e) => _manifests[e.key]!)
        .toList();
  }

  /// 获取指定插件的状态
  PluginState? getState(String pluginId) => _states[pluginId];

  /// 获取指定插件实例
  BasePlugin? getPlugin(String pluginId) => _plugins[pluginId];

  /// 检查插件是否已激活
  bool isActive(String pluginId) =>
      _states[pluginId] == PluginState.active;

  /// 获取已注册插件数量
  int get count => _plugins.length;

  /// 获取已激活插件数量
  int get activeCount =>
      _states.values.where((s) => s == PluginState.active).length;

  // ──────────────────────────────────────────────
  // 扩展点聚合
  // ──────────────────────────────────────────────

  /// 聚合所有已激活插件的实体识别结果
  Future<List<EntityHighlight>> aggregateEntities(String markdown) async {
    final results = <EntityHighlight>[];
    for (final plugin in _activePlugins) {
      try {
        final entities = await plugin.recognizeEntities(markdown);
        results.addAll(entities);
      } catch (e) {
        _log('插件 ${plugin.manifest.id} 实体识别失败: $e');
      }
    }
    return results;
  }

  /// 聚合所有已激活插件的内容处理
  ///
  /// 链式执行: 前一个插件的输出作为后一个的输入。
  Future<String> aggregateContentProcessors(
    String markdown,
    String noteId,
  ) async {
    String result = markdown;
    for (final plugin in _activePlugins) {
      try {
        final processed = await plugin.processContent(result, noteId);
        if (processed != null) {
          result = processed;
        }
      } catch (e) {
        _log('插件 ${plugin.manifest.id} 内容处理失败: $e');
      }
    }
    return result;
  }

  /// 聚合所有已激活插件的搜索增强
  Future<List<dynamic>> aggregateSearchEnhancers(
    List<dynamic> results,
    String query,
  ) async {
    var enhanced = results;
    for (final plugin in _activePlugins) {
      try {
        // 类型转换: 期望 NoteModel 列表
        final typedResults = enhanced.cast<NoteModel>();
        final enhancedResults = await plugin.enhanceSearchResults(
          typedResults,
          query,
        );
        enhanced = enhancedResults;
      } catch (e) {
        _log('插件 ${plugin.manifest.id} 搜索增强失败: $e');
      }
    }
    return enhanced;
  }

  // ──────────────────────────────────────────────
  // 事件系统
  // ──────────────────────────────────────────────

  /// 添加事件监听器
  void addListener(void Function(PluginEvent) listener) {
    _listeners.add(listener);
  }

  /// 移除事件监听器
  void removeListener(void Function(PluginEvent) listener) {
    _listeners.remove(listener);
  }

  /// 触发事件
  void _emitEvent(PluginEvent event) {
    for (final listener in _listeners) {
      try {
        listener(event);
      } catch (_) {}
    }
  }

  // ──────────────────────────────────────────────
  // 内部工具
  // ──────────────────────────────────────────────

  /// 获取所有已激活插件实例列表
  Iterable<BasePlugin> get _activePlugins sync* {
    for (final entry in _plugins.entries) {
      if (entry.value.state == PluginState.active) {
        yield entry.value;
      }
    }
  }

  /// 日志输出
  void _log(String message) {
    dev.log(message, name: 'PluginRegistry');
    if (kDebugMode) {
      print('[PluginRegistry] $message');
    }
  }

  // ──────────────────────────────────────────────
  // 销毁 (应用退出时调用)
  // ──────────────────────────────────────────────

  /// 销毁所有插件和注册表
  Future<void> disposeAll() async {
    final pluginIds = _plugins.keys.toList();
    for (final id in pluginIds) {
      await disposePlugin(id);
    }
    _listeners.clear();
    _initialized = false;
  }
}
