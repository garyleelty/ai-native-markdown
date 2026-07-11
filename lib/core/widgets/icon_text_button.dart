import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';

enum IconTextButtonVariant {
  subtle,
  filled,
  outlined,
  ghost,
}

class IconTextButton extends StatefulWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final String? tooltip;
  final IconTextButtonVariant variant;
  final Color? color;
  final double iconSize;
  final double fontSize;
  final EdgeInsetsGeometry? padding;

  const IconTextButton({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.tooltip,
    this.variant = IconTextButtonVariant.subtle,
    this.color,
    this.iconSize = 14,
    this.fontSize = 11,
    this.padding,
  });

  @override
  State<IconTextButton> createState() => _IconTextButtonState();
}

class _IconTextButtonState extends State<IconTextButton> {
  bool _isHovering = false;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = widget.color ?? AeroColors.accentBlue;
    final canTap = widget.onTap != null;

    final (bgColor, borderColor, textColor, iconColor) = _getColors(
      effectiveColor,
      canTap,
    );

    final child = MouseRegion(
      cursor: canTap ? SystemMouseCursors.click : SystemMouseCursors.basic,
      onEnter: canTap ? (_) => setState(() => _isHovering = true) : null,
      onExit: canTap ? (_) => setState(() => _isHovering = false) : null,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: AeroAnimation.fast,
          curve: AeroAnimation.curve,
          padding: widget.padding ??
              const EdgeInsets.symmetric(
                horizontal: AeroSpacing.sm,
                vertical: AeroSpacing.xs,
              ),
          decoration: BoxDecoration(
            color: _isHovering ? bgColor.$2 : bgColor.$1,
            borderRadius: BorderRadius.circular(AeroRadius.sm),
            border: Border.all(
              color: _isHovering ? borderColor.$2 : borderColor.$1,
              width: AeroBorderWidth.thin,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                widget.icon,
                size: widget.iconSize,
                color: _isHovering ? iconColor.$2 : iconColor.$1,
              ),
              const SizedBox(width: AeroSpacing.xs),
              Text(
                widget.label,
                style: TextStyle(
                  color: _isHovering ? textColor.$2 : textColor.$1,
                  fontSize: widget.fontSize,
                  fontWeight:
                      _isHovering ? FontWeight.w500 : FontWeight.w400,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (widget.tooltip != null) {
      return Tooltip(
        message: widget.tooltip!,
        waitDuration: AeroAnimation.tooltipWait,
        child: child,
      );
    }
    return child;
  }

  (
    (Color, Color),
    (Color, Color),
    (Color, Color),
    (Color, Color),
  ) _getColors(Color effectiveColor, bool canTap) {
    if (!canTap) {
      final disabled = AeroColors.textMuted.withValues(alpha: 0.5);
      return (
        (AeroColors.bgDeep, AeroColors.bgDeep),
        (AeroColors.border, AeroColors.border),
        (disabled, disabled),
        (disabled, disabled),
      );
    }

    switch (widget.variant) {
      case IconTextButtonVariant.subtle:
        return (
          (AeroColors.bgDeep, effectiveColor.withValues(alpha: 0.12)),
          (AeroColors.border, effectiveColor.withValues(alpha: 0.3)),
          (AeroColors.textPrimary, effectiveColor),
          (effectiveColor, effectiveColor),
        );
      case IconTextButtonVariant.filled:
        return (
          (effectiveColor, effectiveColor.withValues(alpha: 0.85)),
          (effectiveColor, effectiveColor),
          (Colors.white, Colors.white),
          (Colors.white, Colors.white),
        );
      case IconTextButtonVariant.outlined:
        return (
          (Colors.transparent, effectiveColor.withValues(alpha: 0.08)),
          (effectiveColor.withValues(alpha: 0.5), effectiveColor),
          (effectiveColor, effectiveColor),
          (effectiveColor, effectiveColor),
        );
      case IconTextButtonVariant.ghost:
        return (
          (Colors.transparent, effectiveColor.withValues(alpha: 0.1)),
          (Colors.transparent, Colors.transparent),
          (AeroColors.textSecondary, effectiveColor),
          (AeroColors.textSecondary, effectiveColor),
        );
    }
  }
}

class TextOnlyButton extends StatefulWidget {
  final String label;
  final VoidCallback? onTap;
  final String? tooltip;
  final Color? color;
  final double fontSize;
  final FontWeight fontWeight;
  final EdgeInsetsGeometry? padding;

  const TextOnlyButton({
    super.key,
    required this.label,
    this.onTap,
    this.tooltip,
    this.color,
    this.fontSize = 11,
    this.fontWeight = FontWeight.w400,
    this.padding,
  });

  @override
  State<TextOnlyButton> createState() => _TextOnlyButtonState();
}

class _TextOnlyButtonState extends State<TextOnlyButton> {
  bool _isHovering = false;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = widget.color ?? AeroColors.accentBlue;
    final canTap = widget.onTap != null;

    final child = MouseRegion(
      cursor: canTap ? SystemMouseCursors.click : SystemMouseCursors.basic,
      onEnter: canTap ? (_) => setState(() => _isHovering = true) : null,
      onExit: canTap ? (_) => setState(() => _isHovering = false) : null,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: AeroAnimation.fast,
          curve: AeroAnimation.curve,
          padding: widget.padding ??
              const EdgeInsets.symmetric(
                horizontal: AeroSpacing.sm,
                vertical: AeroSpacing.xs,
              ),
          decoration: BoxDecoration(
            color: _isHovering
                ? effectiveColor.withValues(alpha: 0.12)
                : effectiveColor.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(AeroRadius.xs),
          ),
          child: Text(
            widget.label,
            style: TextStyle(
              color: _isHovering
                  ? effectiveColor
                  : effectiveColor.withValues(alpha: 0.9),
              fontSize: widget.fontSize,
              fontWeight:
                  _isHovering ? FontWeight.w500 : widget.fontWeight,
            ),
          ),
        ),
      ),
    );

    if (widget.tooltip != null) {
      return Tooltip(
        message: widget.tooltip!,
        waitDuration: AeroAnimation.tooltipWait,
        child: child,
      );
    }
    return child;
  }
}
