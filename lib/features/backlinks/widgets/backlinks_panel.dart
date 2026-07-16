/// ══════════════════════════════════════════════════
/// BacklinksPanel — 反向链接面板
/// ══════════════════════════════════════════════════
/// 显示引用当前笔记的其他笔记列表。
/// ──────────────────────────────────────────────────
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/models/backlink_info.dart';
import '../../../core/models/note_model.dart';
import '../../../providers/note_provider.dart';
import '../../../providers/sidebar_provider.dart';

/// 反向链接面板
class BacklinksPanel extends ConsumerWidget {
  /// 点击笔记后的回调
  final void Function(String noteId, String title)? onNoteTap;

  const BacklinksPanel({super.key, this.onNoteTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sidebarProvider);
    final analysis = state.backlinkAnalysis;

    final hasBacklinks = analysis.backlinks.isNotEmpty;
    final hasUnlinked = analysis.unlinkedMentions.isNotEmpty;
    final hasOutgoing = analysis.outgoingLinks.isNotEmpty;

    if (!hasBacklinks && !hasUnlinked && !hasOutgoing) {
      return const EmptyState(
        icon: Icons.link_off,
        title: '暂无反向链接',
        subtitle: '其他笔记引用此笔记时会显示在这里',
        iconColor: AeroColors.accentBlue,
      );
    }

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      children: [
        // ── 反向链接 ──
        if (hasBacklinks) ...[
          _buildSectionHeader(
            icon: Icons.arrow_back,
            title: '反向链接',
            count: analysis.backlinks.length,
          ),
          ..._groupByNote(analysis.backlinks).entries.map((entry) {
            return _BacklinkTile(
              noteId: entry.key,
              noteTitle: entry.value.first.noteTitle,
              references: entry.value,
              onTap: () {
                onNoteTap?.call(entry.key, entry.value.first.noteTitle);
              },
            );
          }),
          const SizedBox(height: 8),
        ],

        // ── 未链接提及 ──
        if (hasUnlinked) ...[
          _buildSectionHeader(
            icon: Icons.alternate_email,
            title: '未链接提及',
            count: analysis.unlinkedMentions.length,
          ),
          ..._groupByNote(analysis.unlinkedMentions).entries.map((entry) {
            return _BacklinkTile(
              noteId: entry.key,
              noteTitle: entry.value.first.noteTitle,
              references: entry.value,
              isUnlinked: true,
              onTap: () {
                onNoteTap?.call(entry.key, entry.value.first.noteTitle);
              },
            );
          }),
          const SizedBox(height: 8),
        ],

        // ── 前向链接 ──
        if (hasOutgoing) ...[
          _buildSectionHeader(
            icon: Icons.arrow_forward,
            title: '前向链接',
            count: analysis.outgoingLinks.length,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Wrap(
              spacing: 6,
              runSpacing: 4,
              children: analysis.outgoingLinks.map((link) {
                return _OutgoingLinkChip(
                  title: link,
                  onTap: () => _openOutgoingLink(ref, link),
                );
              }).toList(),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSectionHeader({
    required IconData icon,
    required String title,
    required int count,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Row(
        children: [
          Icon(icon, size: 12, color: AeroColors.textMuted),
          const SizedBox(width: 6),
          Text(
            title,
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: AeroColors.bgDeep,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                color: AeroColors.textMuted,
                fontSize: 10,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Map<String, List<BacklinkReference>> _groupByNote(
      List<BacklinkReference> refs) {
    final grouped = <String, List<BacklinkReference>>{};
    for (final ref in refs) {
      grouped.putIfAbsent(ref.noteId, () => []);
      grouped[ref.noteId]!.add(ref);
    }
    return grouped;
  }

  /// 根据标题查找对应笔记并触发跳转
  Future<void> _openOutgoingLink(WidgetRef ref, String title) async {
    final repo = ref.read(noteRepositoryProvider);
    final allNotes = await repo.getAllNotes();
    final lowerTitle = title.toLowerCase().trim();
    NoteModel? target;
    for (final note in allNotes) {
      if (note.title.toLowerCase().trim() == lowerTitle) {
        target = note;
        break;
      }
    }
    if (target != null) {
      onNoteTap?.call(target.id, target.title);
    }
  }
}

/// 前向链接 Chip
class _OutgoingLinkChip extends StatelessWidget {
  final String title;
  final VoidCallback onTap;

  const _OutgoingLinkChip({
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: AeroColors.accentBlue.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            title,
            style: const TextStyle(
              color: AeroColors.accentBlue,
              fontSize: 11,
            ),
          ),
        ),
      ),
    );
  }
}

/// 反向链接列表项
class _BacklinkTile extends StatelessWidget {
  final String noteId;
  final String noteTitle;
  final List<BacklinkReference> references;
  final bool isUnlinked;
  final VoidCallback onTap;

  const _BacklinkTile({
    required this.noteId,
    required this.noteTitle,
    required this.references,
    this.isUnlinked = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 笔记标题
            Row(
              children: [
                Icon(
                  isUnlinked ? Icons.text_fields : Icons.description_outlined,
                  size: 13,
                  color: isUnlinked
                      ? AeroColors.accentOrange
                      : AeroColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    noteTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isUnlinked
                          ? AeroColors.accentOrange
                          : AeroColors.accentBlue,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                if (references.length > 1)
                  Container(
                    margin: const EdgeInsets.only(left: 4),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: AeroColors.bgDeep,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${references.length}',
                      style: const TextStyle(
                        color: AeroColors.textMuted,
                        fontSize: 10,
                      ),
                    ),
                  ),
              ],
            ),

            // 引用上下文（只显示第一个）
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.only(left: 19),
              child: Text(
                references.first.context,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AeroColors.textMuted,
                  fontSize: 10,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
