import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/graph_provider.dart';
import '../models/graph_node.dart';

/// 知识图谱浮层
/// ─────────────────────────────
/// 当鼠标悬停在节点上时，在节点附近显示详细信息：
///   - 节点名称
///   - 连接数
///   - 最近编辑时间
///   - 关联标签列表
///   - "打开笔记" 按钮
///
/// 注意：此 Widget 必须作为 Stack 的直接子节点使用，
///       内部返回 Positioned 定位到右上角。
class GraphOverlay extends ConsumerWidget {
  /// 打开笔记的回调
  final void Function(String noteId, String title)? onOpenNote;

  const GraphOverlay({super.key, this.onOpenNote});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(graphProvider);
    final hoveredNode = state.hoveredNode;
    final selectedNode = state.selectedNode;

    // 优先显示悬停节点，其次显示选中节点
    final displayNode = hoveredNode ?? selectedNode;

    // 始终返回 Positioned，保证在 Stack 中正确定位
    return Positioned(
      right: 16,
      top: 16,
      child: displayNode == null
          ? const SizedBox.shrink()
          : _NodeInfoCard(
              node: displayNode,
              onOpenNote: onOpenNote != null
                  ? () => onOpenNote!(displayNode.nodeId, displayNode.label)
                  : null,
            ),
    );
  }
}

/// 节点信息卡片
class _NodeInfoCard extends StatelessWidget {
  final GraphNode node;
  final VoidCallback? onOpenNote;

  const _NodeInfoCard({
    required this.node,
    this.onOpenNote,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 200),
      builder: (context, value, child) {
        return Transform.scale(
          scale: 0.9 + 0.1 * value,
          alignment: Alignment.topRight,
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: Container(
        width: 220,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AeroColors.bgElevated,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AeroColors.border, width: 0.5),
          boxShadow: const [
            BoxShadow(
              color: AeroColors.shadow,
              blurRadius: 16,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── 标题行 ──
            Row(
              children: [
                // 颜色指示圆点
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: node.color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    node.label,
                    style: const TextStyle(
                      color: AeroColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),

            // ── 连接数 ──
            _InfoRow(
              icon: Icons.link,
              label: '连接数',
              value: '${node.connections.length}',
              color: AeroColors.accentBlue,
            ),

            // ── 最近编辑时间 ──
            if (node.lastEditedAt != null) ...[
              const SizedBox(height: 6),
              _InfoRow(
                icon: Icons.access_time,
                label: '编辑于',
                value: _formatDateTime(node.lastEditedAt!),
                color: AeroColors.accentCyan,
              ),
            ],

            // ── 标签列表 ──
            if (node.tags.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: node.tags.map((tag) {
                  return Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: node.color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(3),
                      border: Border.all(
                        color: node.color.withValues(alpha: 0.3),
                        width: 0.5,
                      ),
                    ),
                    child: Text(
                      tag,
                      style: TextStyle(
                        color: node.color,
                        fontSize: 10,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],

            // ── 打开笔记按钮 ──
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: InkWell(
                onTap: onOpenNote,
                borderRadius: BorderRadius.circular(4),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  decoration: BoxDecoration(
                    color: AeroColors.accentBlue.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: AeroColors.accentBlue.withValues(alpha: 0.3),
                      width: 0.5,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.open_in_new,
                          size: 13, color: AeroColors.accentBlue),
                      const SizedBox(width: 6),
                      Text(
                        '打开笔记',
                        style: TextStyle(
                          color: AeroColors.accentBlue,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 格式化日期时间
  String _formatDateTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inHours < 1) return '${diff.inMinutes} 分钟前';
    if (diff.inDays < 1) return '${diff.inHours} 小时前';
    if (diff.inDays < 7) return '${diff.inDays} 天前';
    return DateFormat('yyyy-MM-dd').format(dt);
  }
}

/// 信息行组件
class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 6),
        Text(
          '$label: ',
          style: const TextStyle(
            color: AeroColors.textMuted,
            fontSize: 11,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
