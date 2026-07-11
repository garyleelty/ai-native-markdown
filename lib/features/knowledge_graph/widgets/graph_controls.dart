import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/icon_text_button.dart';
import '../../../providers/graph_provider.dart';

/// 知识图谱控制栏
/// ─────────────────────────────
/// 包含：
///   - 搜索框（过滤节点名称）
///   - 缩放滑块
///   - 布局重置按钮
///   - 过滤器：按标签、按最小连接数
///   - 标签图例（颜色对照表）
class GraphControls extends ConsumerStatefulWidget {
  const GraphControls({super.key});

  @override
  ConsumerState<GraphControls> createState() => _GraphControlsState();
}

class _GraphControlsState extends ConsumerState<GraphControls> {
  /// 搜索框控制器
  late TextEditingController _searchController;

  /// 连接数过滤的当前值
  double _minConnectionsValue = 0;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(graphProvider);
    final allTags = state.allTags;

    return Container(
      width: 240,
      decoration: const BoxDecoration(
        color: AeroColors.bgSurface,
        border: Border(
          right: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── 标题栏 ──
          _buildTitleBar(context),

          // ── 搜索框 ──
          _buildSearchBar(context),

          const Divider(height: 1, color: AeroColors.divider),

          // ── 缩放控制 ──
          _buildZoomControl(context, state),

          const Divider(height: 1, color: AeroColors.divider),

          // ── 布局控制 ──
          _buildLayoutControls(context),

          const Divider(height: 1, color: AeroColors.divider),

          // ── 连接数过滤 ──
          _buildConnectionFilter(context, state),

          const Divider(height: 1, color: AeroColors.divider),

          // ── 标签过滤 ──
          _buildTagFilter(context, state, allTags),

          const Divider(height: 1, color: AeroColors.divider),

          // ── 标签图例 ──
          _buildLegend(context, allTags),

          // ── 统计信息 ──
          const Spacer(),
          _buildStats(context, state),
        ],
      ),
    );
  }

  /// 标题栏
  Widget _buildTitleBar(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.account_tree_outlined,
              size: 16, color: AeroColors.accentBlue),
          const SizedBox(width: 8),
          Text(
            '知识图谱',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AeroColors.accentBlue,
                  fontSize: 14,
                ),
          ),
        ],
      ),
    );
  }

  /// 搜索框
  Widget _buildSearchBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: TextField(
        controller: _searchController,
        style: const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
        decoration: InputDecoration(
          hintText: '搜索节点...',
          hintStyle: const TextStyle(color: AeroColors.textMuted, fontSize: 13),
          prefixIcon:
              const Icon(Icons.search, size: 16, color: AeroColors.textMuted),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear,
                      size: 14, color: AeroColors.textMuted),
                  onPressed: () {
                    _searchController.clear();
                    ref.read(graphProvider.notifier).setSearchQuery('');
                  },
                )
              : null,
          isDense: true,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          filled: true,
          fillColor: AeroColors.bgElevated,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(4),
            borderSide: const BorderSide(color: AeroColors.border, width: 0.5),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(4),
            borderSide: const BorderSide(color: AeroColors.border, width: 0.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(4),
            borderSide:
                const BorderSide(color: AeroColors.accentBlue, width: 0.5),
          ),
        ),
        onChanged: (value) {
          ref.read(graphProvider.notifier).setSearchQuery(value);
        },
      ),
    );
  }

  /// 缩放控制
  Widget _buildZoomControl(BuildContext context, GraphState state) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.zoom_in, size: 14, color: AeroColors.textMuted),
              const SizedBox(width: 6),
              Text(
                '缩放 ${(state.zoom * 100).toInt()}%',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
          ),
          const SizedBox(height: 4),
          SliderTheme(
            data: SliderThemeData(
              activeTrackColor: AeroColors.accentBlue,
              inactiveTrackColor: AeroColors.border,
              thumbColor: AeroColors.accentBlue,
              overlayColor: AeroColors.accentBlue.withValues(alpha: 0.1),
              trackHeight: 2,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
            ),
            child: Slider(
              value: state.zoom,
              min: 0.1,
              max: 3.0,
              onChanged: (value) {
                ref.read(graphProvider.notifier).updateZoom(value);
              },
            ),
          ),
        ],
      ),
    );
  }

  /// 布局控制按钮
  Widget _buildLayoutControls(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: IconTextButton(
              icon: Icons.refresh,
              label: '重置布局',
              onTap: () {
                ref.read(graphProvider.notifier).resetLayout();
              },
              color: AeroColors.accentPurple,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: IconTextButton(
              icon: Icons.center_focus_strong,
              label: '重置视图',
              onTap: () {
                ref.read(graphProvider.notifier).resetView();
              },
              color: AeroColors.accentPurple,
            ),
          ),
        ],
      ),
    );
  }

  /// 连接数过滤
  Widget _buildConnectionFilter(BuildContext context, GraphState state) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.filter_list,
                  size: 14, color: AeroColors.textMuted),
              const SizedBox(width: 6),
              Text(
                '最少连接数: ${_minConnectionsValue.toInt()}',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
          ),
          const SizedBox(height: 4),
          SliderTheme(
            data: SliderThemeData(
              activeTrackColor: AeroColors.accentPurple,
              inactiveTrackColor: AeroColors.border,
              thumbColor: AeroColors.accentPurple,
              overlayColor: AeroColors.accentPurple.withValues(alpha: 0.1),
              trackHeight: 2,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
            ),
            child: Slider(
              value: _minConnectionsValue,
              min: 0,
              max: 10,
              divisions: 10,
              onChanged: (value) {
                setState(() => _minConnectionsValue = value);
                ref.read(graphProvider.notifier).setMinConnections(value.toInt());
              },
            ),
          ),
        ],
      ),
    );
  }

  /// 标签过滤
  Widget _buildTagFilter(
      BuildContext context, GraphState state, Set<String> allTags) {
    if (allTags.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.label_outline,
                  size: 14, color: AeroColors.textMuted),
              const SizedBox(width: 6),
              Text(
                '标签过滤',
                style: Theme.of(context).textTheme.labelSmall,
              ),
              const Spacer(),
              if (state.filterTags.isNotEmpty)
                GestureDetector(
                  onTap: () {
                    ref.read(graphProvider.notifier).setFilterTags([]);
                  },
                  child: Text(
                    '清除',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AeroColors.accentBlue,
                        ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: allTags.map((tag) {
              final isSelected = state.filterTags.contains(tag);
              return GestureDetector(
                onTap: () {
                  final newTags = isSelected
                      ? state.filterTags.where((t) => t != tag).toList()
                      : [...state.filterTags, tag];
                  ref.read(graphProvider.notifier).setFilterTags(newTags);
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AeroColors.accentBlue.withValues(alpha: 0.2)
                        : AeroColors.bgElevated,
                    borderRadius: BorderRadius.circular(3),
                    border: Border.all(
                      color: isSelected
                          ? AeroColors.accentBlue
                          : AeroColors.border,
                      width: 0.5,
                    ),
                  ),
                  child: Text(
                    tag,
                    style: TextStyle(
                      color: isSelected
                          ? AeroColors.accentBlue
                          : AeroColors.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  /// 标签图例（颜色对照表）
  Widget _buildLegend(BuildContext context, Set<String> allTags) {
    // 预定义的颜色映射
    const legendItems = [
      _LegendItem('概念', AeroColors.accentBlue),
      _LegendItem('人物', AeroColors.accentPurple),
      _LegendItem('任务', AeroColors.accentCyan),
      _LegendItem('引文', AeroColors.accentOrange),
      _LegendItem('引用', AeroColors.accentGreen),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.palette_outlined,
                  size: 14, color: AeroColors.textMuted),
              const SizedBox(width: 6),
              Text(
                '图例',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
          ),
          const SizedBox(height: 6),
          ...legendItems.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: item.color.withValues(alpha: 0.6),
                        shape: BoxShape.circle,
                        border: Border.all(color: item.color, width: 1),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      item.label,
                      style: const TextStyle(
                        color: AeroColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  /// 统计信息
  Widget _buildStats(BuildContext context, GraphState state) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          top: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _StatItem(
            label: '节点',
            value: '${state.nodes.length}',
            color: AeroColors.accentBlue,
          ),
          _StatItem(
            label: '边',
            value: '${state.edges.length}',
            color: AeroColors.accentPurple,
          ),
          _StatItem(
            label: '可见',
            value: '${state.visibleNodes.length}',
            color: AeroColors.accentCyan,
          ),
        ],
      ),
    );
  }
}

/// 图例项
class _LegendItem {
  final String label;
  final Color color;
  const _LegendItem(this.label, this.color);
}

/// 统计信息项
class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(
            color: AeroColors.textMuted,
            fontSize: 10,
          ),
        ),
      ],
    );
  }
}
