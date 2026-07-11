import 'package:flutter/material.dart';
import '../theme/aeromind_theme.dart';

enum ConfirmDialogType { info, warning, danger, success }

class ConfirmDialog extends StatelessWidget {
  final String title;
  final String? content;
  final String confirmText;
  final String cancelText;
  final ConfirmDialogType type;
  final bool isDestructive;
  final Widget? contentWidget;

  const ConfirmDialog({
    super.key,
    required this.title,
    this.content,
    this.confirmText = '确认',
    this.cancelText = '取消',
    this.type = ConfirmDialogType.info,
    this.isDestructive = false,
    this.contentWidget,
  });

  Color get _accentColor {
    if (isDestructive) return AeroColors.error;
    switch (type) {
      case ConfirmDialogType.danger:
        return AeroColors.error;
      case ConfirmDialogType.warning:
        return AeroColors.warning;
      case ConfirmDialogType.success:
        return AeroColors.success;
      case ConfirmDialogType.info:
        return AeroColors.primary;
    }
  }

  IconData get _icon {
    if (isDestructive) return Icons.warning_amber_rounded;
    switch (type) {
      case ConfirmDialogType.danger:
        return Icons.error_rounded;
      case ConfirmDialogType.warning:
        return Icons.warning_amber_rounded;
      case ConfirmDialogType.success:
        return Icons.check_circle_rounded;
      case ConfirmDialogType.info:
        return Icons.info_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      titlePadding: const EdgeInsets.fromLTRB(
        AeroSpacing.xl,
        AeroSpacing.xl,
        AeroSpacing.xl,
        AeroSpacing.md,
      ),
      contentPadding: const EdgeInsets.fromLTRB(
        AeroSpacing.xl,
        0,
        AeroSpacing.xl,
        AeroSpacing.xl,
      ),
      actionsPadding: const EdgeInsets.fromLTRB(
        AeroSpacing.xl,
        0,
        AeroSpacing.xl,
        AeroSpacing.xl,
      ),
      title: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: _accentColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AeroRadius.md),
            ),
            child: Icon(_icon, size: 18, color: _accentColor),
          ),
          const SizedBox(width: AeroSpacing.md),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AeroColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
      content: contentWidget ??
          (content != null
              ? Text(
                  content!,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.6,
                    color: AeroColors.textSecondary,
                  ),
                )
              : null),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(cancelText),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: FilledButton.styleFrom(
            backgroundColor: isDestructive ? AeroColors.error : _accentColor,
          ),
          child: Text(confirmText),
        ),
      ],
    );
  }
}

Future<bool?> showConfirmDialog(
  BuildContext context, {
  required String title,
  String? content,
  String confirmText = '确认',
  String cancelText = '取消',
  ConfirmDialogType type = ConfirmDialogType.info,
  bool isDestructive = false,
  Widget? contentWidget,
}) {
  return showDialog<bool>(
    context: context,
    builder: (context) => ConfirmDialog(
      title: title,
      content: content,
      confirmText: confirmText,
      cancelText: cancelText,
      type: type,
      isDestructive: isDestructive,
      contentWidget: contentWidget,
    ),
  );
}
