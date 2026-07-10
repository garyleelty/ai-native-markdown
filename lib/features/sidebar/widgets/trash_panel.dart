import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/note_model.dart';
import '../../../core/services/trash_service.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/note_provider.dart';

/// 回收站版本号 — 在恢复/删除后递增以触发 FutureBuilder 重建
final _trashVersionProvider = StateProvider<int>((ref) => 0);

/// 回收站面板
///
/// 展示已删除的笔记列表，支持恢复、彻底删除与清空。
/// 数据来源: [TrashService]；恢复的笔记通过 [noteRepositoryProvider] 落盘。
class TrashPanel extends ConsumerWidget {
  /// 恢复笔记后刷新笔记树
  final VoidCallback onRestore;

  /// 关闭面板
  final VoidCallback onClose;

  const TrashPanel({
    super.key,
    required this.onRestore,
    required this.onClose,
  });

  static final DateFormat _dateFormat = DateFormat('yyyy-MM-dd HH:mm');

  /// 从 trashId 中提取删除时间
  /// trashId 格式: <原ID>_trash_<毫秒时间戳>
  DateTime _extractDeletedTime(String trashId) {
    final parts = trashId.split('_trash_');
    if (parts.length == 2) {
      final ms = int.tryParse(parts[1]);
      if (ms != null) {
        return DateTime.fromMillisecondsSinceEpoch(ms);
      }
    }
    return DateTime.now();
  }

  /// 生成内容预览 (前 80 字符，压缩空白与换行)
  String _buildPreview(String markdown) {
    final cleaned = markdown
        .replaceAll(RegExp(r'\n+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (cleaned.isEmpty) return '（无内容）';
    if (cleaned.length <= 80) return cleaned;
    return '${cleaned.substring(0, 80)}…';
  }

  /// 异步加载回收站笔记 (配合 FutureBuilder)
  Future<List<NoteModel>> _loadTrashed() async {
    return TrashService.getAllTrashed();
  }

  // ── 操作 ──────────────────────────────────────────

  Future<void> _restoreNote(BuildContext context, WidgetRef ref, NoteModel note) async {
    try {
      final restored = await TrashService.restore(note.id);
      if (restored != null) {
        await ref.read(noteRepositoryProvider).saveNote(restored);
      }
      ref.read(_trashVersionProvider.notifier).state++;
      onRestore();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('恢复笔记失败: $e'), duration: const Duration(seconds: 2)),
        );
      }
    }
  }

  Future<void> _deletePermanently(
    BuildContext context,
    WidgetRef ref,
    String trashId,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text(
          '彻底删除',
          style: TextStyle(color: AeroColors.textPrimary, fontSize: 16),
        ),
        content: const Text(
          '此操作不可撤销，确定要彻底删除该笔记吗？',
          style: TextStyle(color: AeroColors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消', style: TextStyle(color: AeroColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('删除', style: TextStyle(color: AeroColors.accentOrange)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await TrashService.deletePermanently(trashId);
        ref.read(_trashVersionProvider.notifier).state++;
        onRestore();
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('彻底删除失败: $e'), duration: const Duration(seconds: 2)),
          );
        }
      }
    }
  }

  Future<void> _emptyTrash(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text(
          '清空回收站',
          style: TextStyle(color: AeroColors.textPrimary, fontSize: 16),
        ),
        content: const Text(
          '将永久删除回收站中的所有笔记，此操作不可撤销。',
          style: TextStyle(color: AeroColors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消', style: TextStyle(color: AeroColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('清空', style: TextStyle(color: AeroColors.accentOrange)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await TrashService.emptyTrash();
        ref.read(_trashVersionProvider.notifier).state++;
        onRestore();
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('清空回收站失败: $e'), duration: const Duration(seconds: 2)),
          );
        }
      }
    }
  }

  // ── 构建 ──────────────────────────────────────────

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 监听版本号以在恢复/删除后触发重建
    ref.watch(_trashVersionProvider);

    return Container(
      decoration: const BoxDecoration(
        color: AeroColors.bgSurface,
        border: Border(
          right: BorderSide(color: AeroColors.border, width: 0.5),
        ),
      ),
      child: Column(
        children: [
          _buildHeader(),
          const Divider(height: 1, color: AeroColors.divider),
          Expanded(
            child: FutureBuilder<List<NoteModel>>(
              future: _loadTrashed(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(
                      color: AeroColors.accentBlue,
                      strokeWidth: 2,
                    ),
                  );
                }
                if (snapshot.hasError) {
                  return _buildEmptyState('加载失败', Icons.error_outline);
                }
                final notes = snapshot.data ?? [];
                if (notes.isEmpty) {
                  return _buildEmptyState('回收站为空', Icons.delete_outline);
                }
                return ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: notes.length,
                  separatorBuilder: (_, __) => const Divider(
                    height: 1,
                    indent: 16,
                    endIndent: 16,
                    color: AeroColors.divider,
                  ),
                  itemBuilder: (context, index) =>
                      _buildNoteTile(context, ref, notes[index]),
                );
              },
            ),
          ),
          _buildFooter(context, ref),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(color: AeroColors.bgElevated),
      child: Row(
        children: [
          const Icon(Icons.delete_outline, size: 18, color: AeroColors.accentOrange),
          const SizedBox(width: 8),
          const Text(
            '回收站',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AeroColors.textPrimary,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close, size: 18, color: AeroColors.textSecondary),
            tooltip: '关闭',
            onPressed: onClose,
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(String message, IconData icon) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40, color: AeroColors.textMuted),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(fontSize: 13, color: AeroColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildNoteTile(BuildContext context, WidgetRef ref, NoteModel note) {
    final deletedTime = _extractDeletedTime(note.id);
    final preview = _buildPreview(note.rawMarkdown);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  note.title.isEmpty ? '无标题' : note.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AeroColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.schedule, size: 12, color: AeroColors.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      '删除于 ${_dateFormat.format(deletedTime)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AeroColors.textMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  preview,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    height: 1.4,
                    color: AeroColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => _restoreNote(context, ref, note),
                icon: const Icon(Icons.restore, size: 16, color: AeroColors.accentGreen),
                label: const Text(
                  '恢复',
                  style: TextStyle(color: AeroColors.accentGreen, fontSize: 12),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 30),
                ),
              ),
              TextButton.icon(
                onPressed: () => _deletePermanently(context, ref, note.id),
                icon: const Icon(Icons.delete_forever, size: 16, color: AeroColors.accentOrange),
                label: const Text(
                  '彻底删除',
                  style: TextStyle(color: AeroColors.accentOrange, fontSize: 12),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 30),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(top: BorderSide(color: AeroColors.border, width: 0.5)),
      ),
      padding: const EdgeInsets.all(12),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () => _emptyTrash(context, ref),
          icon: const Icon(Icons.delete_sweep, color: AeroColors.accentOrange),
          label: const Text(
            '清空回收站',
            style: TextStyle(
              color: AeroColors.accentOrange,
              fontWeight: FontWeight.w500,
            ),
          ),
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: AeroColors.accentOrange, width: 0.75),
            padding: const EdgeInsets.symmetric(vertical: 10),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ),
      ),
    );
  }
}
