import 'package:flutter/material.dart';
import '../theme/aeromind_theme.dart';

class InputDialog extends StatefulWidget {
  final String title;
  final String? initialValue;
  final String hintText;
  final String confirmText;
  final String cancelText;
  final IconData? icon;
  final Color? iconColor;
  final bool autofocus;
  final TextInputType? keyboardType;
  final String? Function(String value)? validator;

  const InputDialog({
    super.key,
    required this.title,
    this.initialValue,
    this.hintText = '请输入...',
    this.confirmText = '确定',
    this.cancelText = '取消',
    this.icon,
    this.iconColor,
    this.autofocus = true,
    this.keyboardType,
    this.validator,
  });

  @override
  State<InputDialog> createState() => _InputDialogState();
}

class _InputDialogState extends State<InputDialog> {
  late final TextEditingController _controller;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text;
    if (widget.validator != null) {
      final error = widget.validator!(value);
      if (error != null) {
        setState(() => _errorText = error);
        return;
      }
    }
    Navigator.of(context).pop(value);
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = widget.iconColor ?? AeroColors.primary;
    return AlertDialog(
      backgroundColor: AeroColors.bgElevated,
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
          if (widget.icon != null) ...[
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AeroRadius.md),
              ),
              child: Icon(widget.icon!, size: AeroIconSize.lg, color: accentColor),
            ),
            const SizedBox(width: AeroSpacing.md),
          ],
          Expanded(
            child: Text(
              widget.title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AeroColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
      content: TextField(
        controller: _controller,
        autofocus: widget.autofocus,
        keyboardType: widget.keyboardType,
        style: const TextStyle(
          color: AeroColors.textPrimary,
          fontSize: 14,
        ),
        decoration: InputDecoration(
          hintText: widget.hintText,
          hintStyle: const TextStyle(color: AeroColors.textMuted),
          errorText: _errorText,
          isDense: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AeroRadius.md),
            borderSide: const BorderSide(color: AeroColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AeroRadius.md),
            borderSide:
                const BorderSide(color: AeroColors.border, width: AeroBorderWidth.thin),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AeroRadius.md),
            borderSide:
                const BorderSide(color: AeroColors.accentBlue, width: AeroBorderWidth.base),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AeroSpacing.md,
            vertical: AeroSpacing.sm,
          ),
        ),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(widget.cancelText),
        ),
        FilledButton(
          onPressed: _submit,
          child: Text(widget.confirmText),
        ),
      ],
    );
  }
}

Future<String?> showInputDialog(
  BuildContext context, {
  required String title,
  String? initialValue,
  String hintText = '请输入...',
  String confirmText = '确定',
  String cancelText = '取消',
  IconData? icon,
  Color? iconColor,
  bool autofocus = true,
  TextInputType? keyboardType,
  String? Function(String value)? validator,
}) {
  return showDialog<String>(
    context: context,
    builder: (context) => InputDialog(
      title: title,
      initialValue: initialValue,
      hintText: hintText,
      confirmText: confirmText,
      cancelText: cancelText,
      icon: icon,
      iconColor: iconColor,
      autofocus: autofocus,
      keyboardType: keyboardType,
      validator: validator,
    ),
  );
}
