/// ══════════════════════════════════════════════════
/// PluginManagerPanel — 插件管理面板 UI
/// ══════════════════════════════════════════════════
/// 显示已安装插件列表、状态、启用/禁用开关。
/// 通过命令面板或设置页面打开。
/// ──────────────────────────────────────────────────

library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/dialog_header.dart';
import '../../../core/widgets/modal_overlay.dart';
import '../../../core/widgets/search_input.dart';
import '../../../core/plugin/plugin_manifest.dart';
import '../../../core/plugin/base_plugin.dart';
import '../../../core/plugin/plugin_registry.dart';
import '../../../core/plugin/plugin_storage.dart';
import '../../../providers/plugin_provider.dart';
import 'plugin_settings_form.dart';

// ignore: non_const_argument_for_const_parameter
IconData _pluginIcon(int codePoint) =>
    IconData(codePoint, fontFamily: 'MaterialIcons');

/// 插件管理面板覆盖层
class PluginManagerOverlay extends ConsumerStatefulWidget {
  const PluginManagerOverlay({super.key});

  @override
  ConsumerState<PluginManagerOverlay> createState() =>
      _PluginManagerOverlayState();
}

class _PluginManagerOverlayState extends ConsumerState<PluginManagerOverlay> {
  late final TextEditingController _searchController;
  late final FocusNode _searchFocusNode;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _searchFocusNode = FocusNode();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(pluginManagerProvider);

    return ModalOverlay(
      isOpen: state.isOpen,
      onClose: () => ref.read(pluginManagerProvider.notifier).close(),
      child: _PluginManagerDialog(
        searchController: _searchController,
        searchFocusNode: _searchFocusNode,
      ),
    );
  }
}

class _PluginManagerDialog extends ConsumerWidget {
  final TextEditingController searchController;
  final FocusNode searchFocusNode;

  const _PluginManagerDialog({
    required this.searchController,
    required this.searchFocusNode,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(pluginManagerProvider);

    return DialogContainer(
      width: 640,
      height: 520,
      child: Column(
        children: [
          // ── 标题栏（列表视图）/ 返回行（详情视图）──
          if (state.selectedPluginId == null)
            DialogHeader(
              icon: Icons.extension,
              iconColor: AeroColors.accentCyan,
              title: '插件管理',
              badgeText: '${state.activeCount}/${state.totalCount}',
              badgeColor: AeroColors.accentCyan,
              onClose: () {
                ref.read(pluginManagerProvider.notifier).close();
              },
            )
          else
            _buildDetailHeader(context, ref, state.selectedPluginId!),

          // ── 搜索栏（仅列表视图显示）──
          if (state.selectedPluginId == null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: SearchInput(
                controller: searchController,
                focusNode: searchFocusNode,
                hintText: '搜索插件...',
                height: 36,
                onChanged: (q) {
                  ref.read(pluginManagerProvider.notifier).updateSearch(q);
                },
              ),
            ),

          // ── 主体：列表视图 / 设置详情视图 ──
          Expanded(
            child: state.selectedPluginId == null
                ? (state.filteredPlugins.isEmpty
                    ? const Center(
                        child: Text(
                          '暂无插件',
                          style:
                              TextStyle(color: AeroColors.textMuted, fontSize: 13),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        itemCount: state.filteredPlugins.length,
                        itemBuilder: (context, index) {
                          final plugin = state.filteredPlugins[index];
                          return _PluginTile(
                            manifest: plugin.manifest,
                            state: plugin.state,
                            onToggle: () {
                              ref
                                  .read(pluginManagerProvider.notifier)
                                  .togglePlugin(plugin.manifest.id);
                            },
                            onOpenSettings: () {
                              ref
                                  .read(pluginManagerProvider.notifier)
                                  .openSettings(plugin.manifest.id);
                            },
                          );
                        },
                      ))
                : _PluginSettingsDetail(pluginId: state.selectedPluginId!),
          ),

          // ── 底部信息栏（仅列表视图显示）──
          if (state.selectedPluginId == null)
            Container(
              height: 36,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: const BoxDecoration(
                color: AeroColors.bgSurface,
                border: Border(
                  top: BorderSide(color: AeroColors.divider, width: 0.5),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline,
                      size: 14, color: AeroColors.textMuted),
                  const SizedBox(width: 6),
                  Text(
                    '插件系统 v1.0 · ${state.totalCount} 个插件已注册',
                    style: const TextStyle(
                      color: AeroColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDetailHeader(
      BuildContext context, WidgetRef ref, String pluginId) {
    final plugin = PluginRegistry.instance.getPlugin(pluginId);
    final manifest = plugin?.manifest;

    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: AeroColors.bgSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back,
                size: 18, color: AeroColors.textSecondary),
            onPressed: () {
              ref.read(pluginManagerProvider.notifier).closeSettings();
            },
            tooltip: '返回',
            splashRadius: 16,
            padding: const EdgeInsets.all(4),
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
          ),
          const SizedBox(width: 8),
          if (manifest != null) ...[
            Icon(
              _pluginIcon(manifest.iconCodePoint),
              size: 18,
              color: AeroColors.accentCyan,
            ),
            const SizedBox(width: 8),
          ],
          Text(
            manifest?.name ?? '插件设置',
            style: const TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// 单个插件列表项
class _PluginTile extends StatelessWidget {
  final PluginManifest manifest;
  final PluginState state;
  final VoidCallback onToggle;
  final VoidCallback onOpenSettings;

  const _PluginTile({
    required this.manifest,
    required this.state,
    required this.onToggle,
    required this.onOpenSettings,
  });

  @override
  Widget build(BuildContext context) {
    final isActive = state == PluginState.active;
    final hasError = state == PluginState.error;

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: hasError
            ? AeroColors.accentOrange.withValues(alpha: 0.05)
            : AeroColors.bgSurface,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: hasError
              ? AeroColors.accentOrange.withValues(alpha: 0.3)
              : AeroColors.border,
          width: 0.5,
        ),
      ),
      child: Row(
        children: [
          // 图标
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isActive
                  ? AeroColors.accentCyan.withValues(alpha: 0.12)
                  : AeroColors.bgDeep,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              _pluginIcon(manifest.iconCodePoint),
              size: 18,
              color: isActive ? AeroColors.accentCyan : AeroColors.textMuted,
            ),
          ),
          const SizedBox(width: 10),

          // 信息
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        manifest.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isActive
                              ? AeroColors.textPrimary
                              : AeroColors.textSecondary,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'v${manifest.version}',
                      style: const TextStyle(
                        color: AeroColors.textMuted,
                        fontSize: 10,
                      ),
                    ),
                    if (manifest.author.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Text(
                        'by ${manifest.author}',
                        style: const TextStyle(
                          color: AeroColors.textMuted,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  manifest.description,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AeroColors.textMuted,
                    fontSize: 11,
                  ),
                ),
                if (manifest.extensionTypes.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 4,
                    children: manifest.extensionTypes.take(3).map((ext) {
                      return Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: AeroColors.bgDeep,
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(
                          ext,
                          style: const TextStyle(
                            color: AeroColors.textMuted,
                            fontSize: 9,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ],
            ),
          ),

          // 设置按钮（仅当插件声明了配置项时显示）
          if (manifest.settings.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.settings_outlined,
                  size: 16, color: AeroColors.textSecondary),
              onPressed: onOpenSettings,
              tooltip: '设置',
              splashRadius: 14,
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            ),

          // 状态指示 + 开关
          if (hasError)
            const Tooltip(
              message: '加载失败',
              child: Icon(Icons.error_outline,
                  size: 16, color: AeroColors.accentOrange),
            )
          else
            SizedBox(
              width: 40,
              height: 24,
              child: Switch(
                value: isActive,
                onChanged: (_) => onToggle(),
                activeThumbColor: AeroColors.accentCyan,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════
// 插件设置详情子视图
// ══════════════════════════════════════════════════

/// 插件设置详情视图
///
/// 在插件管理面板内嵌的子视图，显示指定插件的配置项。
/// 通过 [PluginStorage.create] 获取隔离存储实例（Hive box 幂等，
/// 已打开的 box 会复用缓存），再交给 [PluginSettingsForm] 渲染表单。
class _PluginSettingsDetail extends ConsumerWidget {
  final String pluginId;

  const _PluginSettingsDetail({required this.pluginId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final registry = PluginRegistry.instance;
    final plugin = registry.getPlugin(pluginId);

    // 插件不存在时显示空状态
    if (plugin == null) {
      return const Center(
        child: Text('插件未找到',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 13)),
      );
    }

    final manifest = plugin.manifest;

    // 通过 PluginStorage.create 获取隔离存储实例。
    // Hive.openBox 对已打开的 box 是幂等的，因此多次调用安全。
    return FutureBuilder<PluginStorage>(
      future: PluginStorage.create(pluginId),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final storage = snapshot.data!;

        return Column(
          children: [
            // 插件信息行
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: AeroColors.divider, width: 0.5),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _pluginIcon(manifest.iconCodePoint),
                    size: 18,
                    color: AeroColors.accentCyan,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          manifest.name,
                          style: const TextStyle(
                            color: AeroColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          'v${manifest.version} · ${manifest.author.isNotEmpty ? manifest.author : "未知作者"}',
                          style: const TextStyle(
                            color: AeroColors.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // 设置表单（PluginSettingsForm 内部自带 SingleChildScrollView）
            Expanded(
              child: PluginSettingsForm(
                manifest: manifest,
                storage: storage,
              ),
            ),
          ],
        );
      },
    );
  }
}
