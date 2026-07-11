/// ══════════════════════════════════════════════════
/// VersionHistoryPanel — 版本历史面板
/// ══════════════════════════════════════════════════
/// 展示某篇笔记的历史版本时间线，支持查看与恢复。
/// ──────────────────────────────────────────────────
library;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/services/version_service.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/empty_state.dart';

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
            backgroundColor: AeroColors.bgElevated,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(
            content: Text('恢复失败：$e'),
            duration: const Duration(seconds: 3),
            backgroundColor: AeroColors.bgElevated,
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
      color: AeroColors.bgSurface,
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
                      color: AeroColors.accentBlue,
                      strokeWidth: 2,
                    ),
                  );
                }
                if (snapshot.hasError) {
                  return _buildEmptyState('加载失败：${snapshot.error}');
                }
                final versions = snapshot.data ?? const [];
                if (versions.isEmpty) {
                  return const EmptyState(
                    icon: Icons.history,
                    title: '暂无历史版本',
                    subtitle: '保存笔记后会自动生成历史快照',
                    iconColor: AeroColors.accentPurple,
                  );
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
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: AeroBorderWidth.thin),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.history,
            size: AeroIconSize.md,
            color: AeroColors.accentPurple,
          ),
          const SizedBox(width: AeroSpacing.sm),
          const Text(
            '版本历史',
            style: TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close, size: AeroIconSize.md, color: AeroColors.textSecondary),
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
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: AeroSpacing.md),
      itemCount: versions.length,
      separatorBuilder: (_, __) => const SizedBox(height: AeroSpacing.sm),
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
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.circular(AeroRadius.md),
        border: Border.all(
          color: isExpanded ? AeroColors.accentPurple : AeroColors.border,
          width: isExpanded ? AeroBorderWidth.base : AeroBorderWidth.thin,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AeroRadius.md),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: AeroSpacing.sm + 2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(),
                const SizedBox(height: AeroSpacing.xs + 2),
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
                  const SizedBox(height: AeroSpacing.sm + 2),
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
            color: isLatest ? AeroColors.accentPurple : AeroColors.textMuted,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: AeroSpacing.sm),
        // 时间
        Text(
          dateFormatter.format(version.savedAt),
          style: TextStyle(
            color: isLatest ? AeroColors.accentPurple : AeroColors.textSecondary,
            fontSize: 12,
            fontWeight: isLatest ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
        if (isLatest) ...[
          const SizedBox(width: AeroSpacing.xs + 2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: AeroColors.accentPurple.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AeroRadius.xs),
            ),
            child: const Text(
              '最新',
              style: TextStyle(
                color: AeroColors.accentPurple,
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
      padding: const EdgeInsets.all(AeroSpacing.sm + 2),
      decoration: BoxDecoration(
        color: AeroColors.bgSurface,
        borderRadius: BorderRadius.circular(AeroRadius.sm),
        border: Border.all(color: AeroColors.border, width: AeroBorderWidth.thin),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.article_outlined,
                size: 12,
                color: AeroColors.textMuted,
              ),
              SizedBox(width: 4),
              Text(
                '完整内容预览',
                style: TextStyle(
                  color: AeroColors.textMuted,
                  fontSize: 10,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: AeroSpacing.xs + 2),
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
                  color: AeroColors.accentPurple,
                ),
              )
            : const Icon(
                Icons.restore,
                size: 13,
                color: AeroColors.accentPurple,
              ),
        label: Text(
          isRestoring ? '恢复中' : '恢复',
          style: const TextStyle(
            color: AeroColors.accentPurple,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          minimumSize: const Size(0, 26),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AeroRadius.sm),
            side: BorderSide(
              color: AeroColors.accentPurple.withValues(alpha: onPressed == null ? 0.3 : 0.5),
              width: AeroBorderWidth.thin,
            ),
          ),
        ),
      ),
    );
  }
}
