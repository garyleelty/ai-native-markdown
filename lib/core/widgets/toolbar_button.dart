import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';

class ToolbarButton extends StatefulWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final double size;
  final double iconSize;
  final Color? hoverColor;
  final Color? iconColor;
  final Color? hoverIconColor;

  const ToolbarButton({
    super.key,
    required this.icon,
    required this.tooltip,
    this.onTap,
    this.size = 28,
    this.iconSize = 16,
    this.hoverColor,
    this.iconColor,
    this.hoverIconColor,
  });

  @override
  State<ToolbarButton> createState() => _ToolbarButtonState();
}

class _ToolbarButtonState extends State<ToolbarButton> {
  bool _isHovering = false;
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final effectiveHoverColor = widget.hoverColor ?? AeroColors.accentBlue.withValues(alpha: 0.12);
    final effectiveIconColor = widget.iconColor ?? AeroColors.textSecondary;
    final effectiveHoverIconColor = widget.hoverIconColor ?? AeroColors.textPrimary;

    final bgColor = widget.onTap == null
        ? Colors.transparent
        : _isPressed
            ? effectiveHoverColor.withValues(alpha: effectiveHoverColor.a * 1.5)
            : _isHovering
                ? effectiveHoverColor
                : Colors.transparent;

    final iconColor = widget.onTap == null
        ? AeroColors.textMuted
        : _isHovering
            ? effectiveHoverIconColor
            : effectiveIconColor;

    return Tooltip(
      message: widget.tooltip,
      waitDuration: AeroAnimation.tooltipWait,
      verticalOffset: AeroSpacing.lg,
      child: MouseRegion(
        cursor: widget.onTap == null ? SystemMouseCursors.basic : SystemMouseCursors.click,
        onEnter: widget.onTap != null ? (_) => setState(() => _isHovering = true) : null,
        onExit: widget.onTap != null
            ? (_) => setState(() {
                  _isHovering = false;
                  _isPressed = false;
                })
            : null,
        child: GestureDetector(
          onTapDown: widget.onTap != null ? (_) => setState(() => _isPressed = true) : null,
          onTapUp: widget.onTap != null ? (_) => setState(() => _isPressed = false) : null,
          onTapCancel: widget.onTap != null ? () => setState(() => _isPressed = false) : null,
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: AeroAnimation.fast,
            curve: AeroAnimation.curve,
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(AeroRadius.sm),
            ),
            child: Icon(
              widget.icon,
              size: widget.iconSize,
              color: iconColor,
            ),
          ),
        ),
      ),
    );
  }
}

class ToolbarGroup extends StatelessWidget {
  final List<Widget> children;
  final double spacing;

  const ToolbarGroup({
    super.key,
    required this.children,
    this.spacing = AeroSpacing.xs,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.xs),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }
}

class ToolbarDivider extends StatelessWidget {
  final double height;

  const ToolbarDivider({
    super.key,
    this.height = 16,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: AeroBorderWidth.base,
      height: height,
      color: AeroColors.border,
    );
  }
}

class EditorToolbar extends StatelessWidget {
  final Widget leading;
  final List<Widget> actions;
  final double height;

  const EditorToolbar({
    super.key,
    required this.leading,
    this.actions = const [],
    this.height = 36,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          bottom: BorderSide(color: AeroColors.border, width: AeroBorderWidth.thin),
        ),
      ),
      child: Row(
        children: [
          leading,
          const SizedBox(width: AeroSpacing.sm),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: actions,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
