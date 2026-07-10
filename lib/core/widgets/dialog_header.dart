import 'package:flutter/material.dart';
import '../theme/aeromind_theme.dart';

class DialogHeader extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String? badgeText;
  final Color? badgeColor;
  final VoidCallback? onClose;
  final double height;

  const DialogHeader({
    super.key,
    required this.icon,
    required this.title,
    this.iconColor = AeroColors.accentBlue,
    this.badgeText,
    this.badgeColor,
    this.onClose,
    this.height = 44,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: iconColor),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (badgeText != null) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: (badgeColor ?? iconColor).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                badgeText!,
                style: TextStyle(
                  color: badgeColor ?? iconColor,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
          const Spacer(),
          if (onClose != null)
            _CloseButton(onPressed: onClose!),
        ],
      ),
    );
  }
}

class _CloseButton extends StatefulWidget {
  final VoidCallback onPressed;

  const _CloseButton({required this.onPressed});

  @override
  State<_CloseButton> createState() => _CloseButtonState();
}

class _CloseButtonState extends State<_CloseButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onPressed,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: _isHovered
                ? AeroColors.accentRed.withValues(alpha: 0.85)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Icon(
            Icons.close,
            size: 16,
            color: _isHovered
                ? Colors.white
                : AeroColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
