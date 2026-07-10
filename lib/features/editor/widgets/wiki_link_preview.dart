/// ══════════════════════════════════════════════════
/// WikiLinkPreview — wiki link 悬浮预览卡片
/// ══════════════════════════════════════════════════
/// 鼠标悬停在 [[wiki link]] 上时，通过 OverlayEntry
/// 弹出卡片显示目标笔记的标题和内容预览。
/// ──────────────────────────────────────────────────
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/note_model.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/note_provider.dart';

/// wiki link 悬浮预览管理器
class WikiLinkHoverHandler {
  OverlayEntry? _entry;
  Timer? _showTimer;
  Timer? _hideTimer;
  final WidgetRef _ref;
  final BuildContext _context;

  WikiLinkHoverHandler(this._context, this._ref);

  /// 鼠标进入 wiki link 区域
  void onEnter(String linkText, LayerLink layerLink) {
    _hideTimer?.cancel();
    _showTimer?.cancel();
    _showTimer = Timer(const Duration(milliseconds: 500), () {
      _show(linkText, layerLink);
    });
  }

  /// 鼠标离开 wiki link 区域
  void onExit() {
    _showTimer?.cancel();
    _hideTimer = Timer(const Duration(milliseconds: 300), () {
      _hide();
    });
  }

  /// 显示预览卡片
  Future<void> _show(String linkText, LayerLink layerLink) async {
    if (!_context.mounted) return;

    try {
      // 查找匹配的笔记
      final repo = _ref.read(noteRepositoryProvider);
      final allNotes = await repo.getAllNotes();

      NoteModel? targetNote;
      for (final note in allNotes) {
        if (note.title == linkText || note.id == linkText) {
          targetNote = note;
          break;
        }
      }

      if (!_context.mounted) return;

      _entry = OverlayEntry(
        builder: (context) => _PreviewCard(
          linkText: linkText,
          note: targetNote,
          layerLink: layerLink,
          onDismiss: _hide,
        ),
      );

      Overlay.of(_context).insert(_entry!);
    } catch (e) {
      debugPrint('Error showing wiki link preview: $e');
    }
  }

  void _hide() {
    _entry?.remove();
    _entry = null;
  }

  void dispose() {
    _showTimer?.cancel();
    _hideTimer?.cancel();
    _entry?.remove();
  }
}

/// 预览卡片 Widget
class _PreviewCard extends StatefulWidget {
  final String linkText;
  final NoteModel? note;
  final LayerLink layerLink;
  final VoidCallback onDismiss;

  const _PreviewCard({
    required this.linkText,
    required this.note,
    required this.layerLink,
    required this.onDismiss,
  });

  @override
  State<_PreviewCard> createState() => _PreviewCardState();
}

class _PreviewCardState extends State<_PreviewCard> {
  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      top: 0,
      child: CompositedTransformFollower(
        link: widget.layerLink,
        targetAnchor: Alignment.bottomLeft,
        followerAnchor: Alignment.topLeft,
        offset: const Offset(0, 8),
        child: MouseRegion(
          onExit: (_) => widget.onDismiss(),
          child: _buildCard(),
        ),
      ),
    );
  }

  Widget _buildCard() {
    final hasNote = widget.note != null;
    final preview = hasNote
        ? _extractPreview(widget.note!.rawMarkdown)
        : '找不到名为 "${widget.linkText}" 的笔记';

    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(8),
      color: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AeroColors.bgElevated,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AeroColors.divider, width: 0.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // 标题行
            Row(
              children: [
                Icon(
                  hasNote ? Icons.description : Icons.link_off,
                  size: 14,
                  color: hasNote ? AeroColors.accentGreen : AeroColors.textMuted,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    hasNote ? widget.note!.title : widget.linkText,
                    style: TextStyle(
                      color: hasNote
                          ? AeroColors.textPrimary
                          : AeroColors.textMuted,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // 预览内容
            Container(
              constraints: const BoxConstraints(maxHeight: 120),
              child: Text(
                preview,
                style: TextStyle(
                  color: hasNote
                      ? AeroColors.textSecondary
                      : AeroColors.textMuted,
                  fontSize: 12,
                  height: 1.4,
                ),
                maxLines: 5,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            // 标签
            if (hasNote && widget.note!.tags.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: widget.note!.tags.take(5).map((tag) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AeroColors.accentGreen.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '#$tag',
                      style: const TextStyle(
                        color: AeroColors.accentGreen,
                        fontSize: 11,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// 提取内容预览（前 200 字符，跳过标题行）
  String _extractPreview(String markdown) {
    final lines = markdown.split('\n');
    final contentLines = lines.where((l) => !l.startsWith('#')).toList();
    final preview = contentLines.join('\n').trim();
    if (preview.isEmpty) return '（空笔记）';
    return preview.length > 200 ? '${preview.substring(0, 200)}…' : preview;
  }
}
