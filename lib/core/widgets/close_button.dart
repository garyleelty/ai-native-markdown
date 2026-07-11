import 'package:flutter/material.dart';
import '../theme/aeromind_theme.dart';

enum AeroCloseButtonSize { sm, md }

class AeroCloseButton extends StatefulWidget {
  final VoidCallback onPressed;
  final AeroCloseButtonSize size;
  final String? tooltip;

  const AeroCloseButton({
    super.key,
    required this.onPressed,
    this.size = AeroCloseButtonSize.md,
    this.tooltip = '关闭',
  });

  @override
  State<AeroCloseButton> createState() => _AeroCloseButtonState();
}

class _AeroCloseButtonState extends State<AeroCloseButton> {
  bool _isHovered = false;

  double get _buttonSize {
    switch (widget.size) {
      case AeroCloseButtonSize.sm:
        return 22;
      case AeroCloseButtonSize.md:
        return 24;
    }
  }

  double get _iconSize {
    switch (widget.size) {
      case AeroCloseButtonSize.sm:
        return AeroIconSize.sm;
      case AeroCloseButtonSize.md:
        return AeroIconSize.md;
    }
  }

  @override
  Widget build(BuildContext context) {
    final button = MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onPressed,
        behavior: HitTestBehavior.opaque,
        child: Semantics(
          button: true,
          label: widget.tooltip,
          child: AnimatedContainer(
            duration: AeroAnimation.fast,
            curve: AeroAnimation.curve,
            width: _buttonSize,
            height: _buttonSize,
            decoration: BoxDecoration(
              color: _isHovered
                  ? AeroColors.accentRed.withValues(alpha: 0.85)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(AeroRadius.sm),
            ),
            child: Icon(
              Icons.close,
              size: _iconSize,
              color: _isHovered
                  ? AeroColors.textOnAccent
                  : AeroColors.textSecondary,
            ),
          ),
        ),
      ),
    );

    if (widget.tooltip != null) {
      return Tooltip(
        message: widget.tooltip!,
        child: button,
      );
    }
    return button;
  }
}
