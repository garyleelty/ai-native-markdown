/// ══════════════════════════════════════════════════
/// VersionHistoryPanel — 版本历史面板
/// ══════════════════════════════════════════════════
/// 展示某篇笔记的历史版本时间线，支持查看与恢复。
/// ──────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/services/version_service.dart';
import '../../../core/theme/aeromind_theme.dart';

/// 版本历史面板
///
/// 通过 [VersionService.getVersions] 读取 [noteId] 对应的所有快照，
/// 以时间线形式展示。每条版本可展开查看完整内容预览，并支持一键恢复。
class VersionHistoryPanel extends StatefulWidget {
  /// 目标笔记 ID
  final String noteId;

  /// 关闭按钮回调
  final VoidCallback onClose;

  /// 恢复版本回调，参数为恢复的内容
  final void Function(String content)? onRestore;

  const VersionHistoryPanel({
    super.key,
    required this.noteId,
    required this.onClose,
    this.onRestore,
  });

  @override
  State<VersionHistoryPanel> createState() => _VersionHistoryPanelState();
}

class _VersionHistoryPanelState extends State<VersionHistoryPanel> {
  /// 适配 FutureBuilder：getVersions 本身是同步方法，包裹成 Future
  late final Future<List<VersionSnapshot>> _versionsFuture;

  /// 当前展开的版本 ID（null 表示全部折叠）
  String? _expandedVersionId;

  /// 正在恢复的版本 ID（用于禁用按钮 + loading 态）
  String? _restoringVersionId;

  static final DateFormat _dateFormatter = DateFormat('yyyy-MM-dd HH:mm');

  @override
  void initState() {
    super.initState();
    _versionsFuture = _loadVersions();
  }

  Future<List<VersionSnapshot>> _loadVersions() {
    // VersionService.getVersions 是同步方法，这里包裹成 Future
    // 以便 FutureBuilder 统一处理加载态
    return Future.value(VersionService.getVersions(widget.noteId));
  }

  Future<void> _handleRestore(VersionSnapshot version) async {
    setState(() => _restoringVersionId = version.id);
    try {
      final content = await VersionService.restoreVersion(version.id);
      widget.onRestore?.call(content);
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(
            content: Text('已恢复到 ${_dateFormatter.format(version.savedAt)} 的版本'),
            duration: const Duration(seconds: 2),
            backgroundColor: AeroColors.surfaceVariant,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(
            content: Text('恢复失败：$e'),
            duration: const Duration(seconds: 3),
            backgroundColor: AeroColors.surfaceVariant,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _restoringVersionId = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AeroColors.surface,
      child: Column(
        children: [
          _buildTitleBar(),
          Expanded(
            child: FutureBuilder<List<VersionSnapshot>>(
              future: _versionsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(
                    child: CircularProgressIndicator(
                      color: AeroColors.accent,
                      strokeWidth: 2,
                    ),
                  );
                }
                if (snapshot.hasError) {
                  return _buildEmptyState('加载失败：${snapshot.error}');
                }
                final versions = snapshot.data ?? const [];
                if (versions.isEmpty) {
                  return _buildEmptyState('暂无版本历史');
                }
                return _buildTimeline(versions);
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── 标题栏 ────────────────────────────────────────
  Widget _buildTitleBar() {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        color: AeroColors.surfaceVariant,
        border: Border(
          bottom: BorderSide(color: AeroColors.border, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.history,
            size: 16,
            color: AeroColors.accent,
          ),
          const SizedBox(width: 8),
          const Text(
            '版本历史',
            style: TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close, size: 18, color: AeroColors.textPrimary),
            tooltip: '关闭',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            splashRadius: 16,
            onPressed: widget.onClose,
          ),
        ],
      ),
    );
  }

  // ── 时间线 ────────────────────────────────────────
  Widget _buildTimeline(List<VersionSnapshot> versions) {
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      itemCount: versions.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final version = versions[index];
        final isExpanded = _expandedVersionId == version.id;
        final isRestoring = _restoringVersionId == version.id;
        final isLatest = index == 0;
        return _VersionTile(
          version: version,
          isExpanded: isExpanded,
          isLatest: isLatest,
          isRestoring: isRestoring,
          dateFormatter: _dateFormatter,
          onTap: () {
            setState(() {
              _expandedVersionId = isExpanded ? null : version.id;
            });
          },
          onRestore: () => _handleRestore(version),
        );
      },
    );
  }

  // ── 空状态 ────────────────────────────────────────
  Widget _buildEmptyState(String message) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.history_toggle_off,
            size: 32,
            color: AeroColors.textMuted,
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

/// 单条版本卡片
class _VersionTile extends StatelessWidget {
  final VersionSnapshot version;
  final bool isExpanded;
  final bool isLatest;
  final bool isRestoring;
  final DateFormat dateFormatter;
  final VoidCallback onTap;
  final VoidCallback onRestore;

  const _VersionTile({
    required this.version,
    required this.isExpanded,
    required this.isLatest,
    required this.isRestoring,
    required this.dateFormatter,
    required this.onTap,
    required this.onRestore,
  });

  /// 内容预览（前 100 字符）
  String get _preview {
    final content = version.content;
    if (content.length <= 100) return content;
    return '${content.substring(0, 100)}…';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AeroColors.surfaceVariant,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: isExpanded ? AeroColors.accent : AeroColors.border,
          width: isExpanded ? 1 : 0.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(6),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(),
                const SizedBox(height: 6),
                Text(
                  _preview,
                  maxLines: isExpanded ? null : 2,
                  overflow: isExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AeroColors.textPrimary,
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
                if (isExpanded) ...[
                  const SizedBox(height: 10),
                  _buildExpandedContent(),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        // 时间线圆点
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: isLatest ? AeroColors.accent : AeroColors.textMuted,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        // 时间
        Text(
          dateFormatter.format(version.savedAt),
          style: TextStyle(
            color: isLatest ? AeroColors.accent : AeroColors.textSecondary,
            fontSize: 12,
            fontWeight: isLatest ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
        if (isLatest) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: AeroColors.accent.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text(
              '最新',
              style: TextStyle(
                color: AeroColors.accent,
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
        const Spacer(),
        // 恢复按钮
        _RestoreButton(
          onPressed: isRestoring ? null : onRestore,
          isRestoring: isRestoring,
        ),
      ],
    );
  }

  Widget _buildExpandedContent() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AeroColors.surface,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: AeroColors.border, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.article_outlined,
                size: 12,
                color: AeroColors.textMuted,
              ),
              const SizedBox(width: 4),
              const Text(
                '完整内容预览',
                style: TextStyle(
                  color: AeroColors.textMuted,
                  fontSize: 10,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            version.content,
            style: const TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 12,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

/// 恢复按钮（带 loading 态）
class _RestoreButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final bool isRestoring;

  const _RestoreButton({
    required this.onPressed,
    required this.isRestoring,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 26,
      child: TextButton.icon(
        onPressed: onPressed,
        icon: isRestoring
            ? const SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  color: AeroColors.accent,
                ),
              )
            : const Icon(
                Icons.restore,
                size: 13,
                color: AeroColors.accent,
              ),
        label: Text(
          isRestoring ? '恢复中' : '恢复',
          style: const TextStyle(
            color: AeroColors.accent,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          minimumSize: const Size(0, 26),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(4),
            side: BorderSide(
              color: AeroColors.accent.withValues(alpha: onPressed == null ? 0.3 : 0.5),
              width: 0.5,
            ),
          ),
        ),
      ),
    );
  }
}
