/// ══════════════════════════════════════════════════
/// OutlinePanel — 大纲/目录面板
/// ══════════════════════════════════════════════════
/// 显示当前笔记的标题层级结构，点击可跳转到对应位置。
/// ──────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/sidebar_provider.dart';
import '../../editor/services/editor_service.dart';

/// 大纲面板
class OutlinePanel extends ConsumerWidget {
  /// 点击标题后的回调 (传入标题在文档中的偏移量)
  final void Function(int offset)? onHeadingTap;

  const OutlinePanel({super.key, this.onHeadingTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sidebarProvider);
    final headings = state.outlineHeadings;

    // 空状态
    if (headings.isEmpty) {
      return const _EmptyOutline();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── 标题栏 ──
        Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: const BoxDecoration(
            color: AeroColors.bgElevated,
            border: Border(
              bottom: BorderSide(color: AeroColors.divider, width: 0.5),
            ),
          ),
          child: Row(
            children: [
              const Icon(Icons.list_alt, size: 14, color: AeroColors.accentBlue),
              const SizedBox(width: 6),
              Text(
                '大纲',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AeroColors.textPrimary,
                    ),
              ),
              const Spacer(),
              Text(
                '${headings.length} 个标题',
                style: const TextStyle(
                  color: AeroColors.textMuted,
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),

        // ── 标题列表 ──
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 4),
            itemCount: headings.length,
            itemBuilder: (context, index) {
              final heading = headings[index];
              return _HeadingTile(
                heading: heading,
                onTap: () => onHeadingTap?.call(heading.offset),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// 空状态
class _EmptyOutline extends StatelessWidget {
  const _EmptyOutline();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.list_alt, size: 32, color: AeroColors.textMuted),
          SizedBox(height: 8),
          Text(
            '暂无大纲',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 12),
          ),
          SizedBox(height: 4),
          Text(
            '在笔记中添加标题 (#)',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

/// 标题列表项
class _HeadingTile extends StatelessWidget {
  final HeadingInfo heading;
  final VoidCallback onTap;

  const _HeadingTile({
    required this.heading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // 根据标题层级计算缩进
    final indent = (heading.level - 1) * 16.0;

    // 根据层级选择颜色
    final dotColor = switch (heading.level) {
      1 => AeroColors.accentBlue,
      2 => AeroColors.accentPurple,
      3 => AeroColors.accentCyan,
      4 => AeroColors.accentGreen,
      5 => AeroColors.accentOrange,
      _ => AeroColors.textMuted,
    };

    // 根据层级设置字体大小
    final fontSize = switch (heading.level) {
      1 => 13.0,
      2 => 12.0,
      _ => 11.0,
    };

    return InkWell(
      onTap: onTap,
      child: Container(
        height: 28,
        padding: EdgeInsets.only(left: 12 + indent, right: 12),
        child: Row(
          children: [
            // 层级圆点
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),

            // 标题文本
            Expanded(
              child: Text(
                heading.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: fontSize,
                  color: AeroColors.textPrimary,
                  fontWeight: heading.level == 1 ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),

            // 层级标签
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: dotColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(3),
              ),
              child: Text(
                'H${heading.level}',
                style: TextStyle(
                  color: dotColor,
                  fontSize: 9,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
