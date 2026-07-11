import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';

class ChipButton extends StatefulWidget {
  final IconData? icon;
  final String label;
  final String? subtitle;
  final VoidCallback? onTap;
  final Color? color;
  final double iconSize;

  const ChipButton({
    super.key,
    this.icon,
    required this.label,
    this.subtitle,
    this.onTap,
    this.color,
    this.iconSize = 12,
  });

  @override
  State<ChipButton> createState() => _ChipButtonState();
}

class _ChipButtonState extends State<ChipButton> {
  bool _isHovering = false;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = widget.color ?? AeroColors.accentGreen;
    final canTap = widget.onTap != null;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.xs),
      child: MouseRegion(
        cursor: canTap ? SystemMouseCursors.click : SystemMouseCursors.basic,
        onEnter: canTap ? (_) => setState(() => _isHovering = true) : null,
        onExit: canTap ? (_) => setState(() => _isHovering = false) : null,
        child: GestureDetector(
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: AeroAnimation.fast,
            curve: AeroAnimation.curve,
            padding: const EdgeInsets.symmetric(
              horizontal: AeroSpacing.md,
              vertical: AeroSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: _isHovering
                  ? effectiveColor.withValues(alpha: 0.12)
                  : AeroColors.bgSurface,
              borderRadius: BorderRadius.circular(AeroRadius.md),
              border: Border.all(
                color: _isHovering
                    ? effectiveColor.withValues(alpha: 0.5)
                    : effectiveColor.withValues(alpha: 0.25),
                width: AeroBorderWidth.thin,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.icon != null) ...[
                  Icon(
                    widget.icon,
                    size: widget.iconSize,
                    color: effectiveColor,
                  ),
                  const SizedBox(width: AeroSpacing.xs),
                ],
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.label,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: _isHovering
                                ? effectiveColor
                                : AeroColors.textPrimary,
                            fontSize: 12,
                            fontWeight:
                                _isHovering ? FontWeight.w500 : FontWeight.w400,
                          ),
                    ),
                    if (widget.subtitle != null)
                      Text(
                        widget.subtitle!,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              fontSize: 9,
                            ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class StatusBadge extends StatelessWidget {
  final String text;
  final IconData? icon;
  final Color color;

  const StatusBadge({
    super.key,
    required this.text,
    this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AeroSpacing.sm,
        vertical: AeroSpacing.xs / 2,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AeroRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: color),
            const SizedBox(width: AeroSpacing.xs),
          ],
          Text(
            text,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontSize: 10,
                  color: color,
                ),
          ),
        ],
      ),
    );
  }
}
