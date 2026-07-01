/// ══════════════════════════════════════════════════
/// PluginManagerPanel — 插件管理面板 UI
/// ══════════════════════════════════════════════════
/// 显示已安装插件列表、状态、启用/禁用开关。
/// 通过命令面板或设置页面打开。
/// ──────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/plugin/plugin_manifest.dart';
import '../../../core/plugin/base_plugin.dart';
import '../../../providers/plugin_provider.dart';

/// 插件管理面板覆盖层
class PluginManagerOverlay extends ConsumerWidget {
  const PluginManagerOverlay({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(pluginManagerProvider);

    if (!state.isOpen) return const SizedBox.shrink();

    return Material(
      color: Colors.black38,
      child: Center(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.9, end: 1.0),
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          builder: (context, scale, child) {
            return Transform.scale(
              scale: scale,
              child: Opacity(
                opacity: (scale - 0.9) * 10,
                child: child,
              ),
            );
          },
          child: _PluginManagerDialog(),
        ),
      ),
    );
  }
}

class _PluginManagerDialog extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(pluginManagerProvider);

    return Container(
      width: 640,
      height: 520,
      decoration: BoxDecoration(
        color: AeroColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AeroColors.border, width: 0.5),
        boxShadow: const [
          BoxShadow(color: AeroColors.shadow, blurRadius: 24),
        ],
      ),
      child: Column(
        children: [
          // ── 标题栏 ──
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: const BoxDecoration(
              color: AeroColors.bgElevated,
              borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
              border: Border(
                bottom: BorderSide(color: AeroColors.divider, width: 0.5),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.extension, size: 18, color: AeroColors.accentCyan),
                const SizedBox(width: 8),
                const Text(
                  '插件管理',
                  style: TextStyle(
                    color: AeroColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AeroColors.accentCyan.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${state.activeCount}/${state.totalCount}',
                    style: const TextStyle(
                      color: AeroColors.accentCyan,
                      fontSize: 11,
                    ),
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, size: 18, color: AeroColors.textSecondary),
                  onPressed: () {
                    ref.read(pluginManagerProvider.notifier).close();
                  },
                  splashRadius: 16,
                ),
              ],
            ),
          ),

          // ── 搜索栏 ──
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              style: const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText: '搜索插件...',
                hintStyle: const TextStyle(color: AeroColors.textMuted),
                prefixIcon: const Icon(Icons.search, size: 18, color: AeroColors.textMuted),
                filled: true,
                fillColor: AeroColors.bgDeep,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                  borderSide: const BorderSide(color: AeroColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                  borderSide: const BorderSide(color: AeroColors.border, width: 0.5),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                  borderSide: const BorderSide(color: AeroColors.accentBlue, width: 1),
                ),
              ),
              onChanged: (q) {
                ref.read(pluginManagerProvider.notifier).updateSearch(q);
              },
            ),
          ),

          // ── 插件列表 ──
          Expanded(
            child: state.filteredPlugins.isEmpty
                ? const Center(
                    child: Text(
                      '暂无插件',
                      style: TextStyle(color: AeroColors.textMuted, fontSize: 13),
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
                          ref.read(pluginManagerProvider.notifier)
                              .togglePlugin(plugin.manifest.id);
                        },
                      );
                    },
                  ),
          ),

          // ── 底部信息栏 ──
          Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: const BoxDecoration(
              color: AeroColors.bgElevated,
              border: Border(
                top: BorderSide(color: AeroColors.divider, width: 0.5),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, size: 14, color: AeroColors.textMuted),
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
}

/// 单个插件列表项
class _PluginTile extends StatelessWidget {
  final PluginManifest manifest;
  final PluginState state;
  final VoidCallback onToggle;

  const _PluginTile({
    required this.manifest,
    required this.state,
    required this.onToggle,
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
            ? AeroColors.accentOrange.withOpacity(0.05)
            : AeroColors.bgElevated,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: hasError
              ? AeroColors.accentOrange.withOpacity(0.3)
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
                  ? AeroColors.accentCyan.withOpacity(0.12)
                  : AeroColors.bgDeep,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              IconData(manifest.iconCodePoint, fontFamily: 'MaterialIcons'),
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

          // 状态指示 + 开关
          if (hasError)
            const Tooltip(
              message: '加载失败',
              child: Icon(Icons.error_outline, size: 16, color: AeroColors.accentOrange),
            )
          else
            SizedBox(
              width: 40,
              height: 24,
              child: Switch(
                value: isActive,
                onChanged: (_) => onToggle(),
                activeColor: AeroColors.accentCyan,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
        ],
      ),
    );
  }
}
