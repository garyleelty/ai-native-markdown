/// ══════════════════════════════════════════════════
/// Plugin Provider — 插件系统状态管理
/// ══════════════════════════════════════════════════
/// 管理插件管理面板 UI 状态、插件生命周期操作的 Riverpod 集成。
/// ──────────────────────────────────────────────────

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/plugin/plugin_registry.dart';
import '../core/plugin/plugin_manifest.dart';
import '../core/plugin/base_plugin.dart';

/// 插件管理面板 UI 状态
class PluginManagerState {
  /// 是否打开管理面板
  final bool isOpen;

  /// 搜索关键字
  final String searchQuery;

  /// 所有已注册插件信息列表
  final List<PluginInfo> plugins;

  const PluginManagerState({
    this.isOpen = false,
    this.searchQuery = '',
    this.plugins = const [],
  });

  /// 过滤后的插件列表
  List<PluginInfo> get filteredPlugins {
    if (searchQuery.isEmpty) return plugins;
    final lower = searchQuery.toLowerCase();
    return plugins.where((p) {
      return p.manifest.name.toLowerCase().contains(lower) ||
          p.manifest.description.toLowerCase().contains(lower) ||
          p.manifest.id.toLowerCase().contains(lower);
    }).toList();
  }

  /// 已激活插件数量
  int get activeCount =>
      plugins.where((p) => p.state == PluginState.active).length;

  /// 总插件数量
  int get totalCount => plugins.length;

  PluginManagerState copyWith({
    bool? isOpen,
    String? searchQuery,
    List<PluginInfo>? plugins,
  }) {
    return PluginManagerState(
      isOpen: isOpen ?? this.isOpen,
      searchQuery: searchQuery ?? this.searchQuery,
      plugins: plugins ?? this.plugins,
    );
  }
}

/// 插件信息快照
class PluginInfo {
  final PluginManifest manifest;
  final PluginState state;

  const PluginInfo({required this.manifest, required this.state});
}

/// 插件管理面板 Notifier
class PluginManagerNotifier extends Notifier<PluginManagerState> {
  @override
  PluginManagerState build() {
    return const PluginManagerState();
  }

  /// 打开管理面板
  void open() {
    _refreshPluginList();
    state = state.copyWith(isOpen: true, searchQuery: '');
  }

  /// 关闭管理面板
  void close() {
    state = state.copyWith(isOpen: false);
  }

  /// 更新搜索
  void updateSearch(String query) {
    state = state.copyWith(searchQuery: query);
  }

  /// 切换插件启用/禁用
  Future<void> togglePlugin(String pluginId) async {
    final registry = PluginRegistry.instance;
    final currentState = registry.getState(pluginId);

    if (currentState == PluginState.active) {
      await registry.pausePlugin(pluginId);
    } else if (currentState == PluginState.paused ||
        currentState == PluginState.registered) {
      await registry.activatePlugin(pluginId);
    }

    _refreshPluginList();
  }

  /// 刷新插件列表
  void _refreshPluginList() {
    final registry = PluginRegistry.instance;
    final plugins = registry.allManifests.map((manifest) {
      return PluginInfo(
        manifest: manifest,
        state: registry.getState(manifest.id) ?? PluginState.registered,
      );
    }).toList();

    state = state.copyWith(plugins: plugins);
  }
}

/// 插件管理面板 Provider
final pluginManagerProvider =
    NotifierProvider<PluginManagerNotifier, PluginManagerState>(
  PluginManagerNotifier.new,
);

/// 插件注册表 Provider (单例)
final pluginRegistryProvider = Provider<PluginRegistry>((ref) {
  return PluginRegistry.instance;
});
