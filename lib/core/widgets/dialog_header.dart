import 'package:flutter/material.dart';
import '../theme/aeromind_theme.dart';
import 'close_button.dart';

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
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.lg),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AeroRadius.xl)),
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: AeroBorderWidth.thin),
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: AeroIconSize.lg, color: iconColor),
          const SizedBox(width: AeroSpacing.sm),
          Text(
            title,
            style: const TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (badgeText != null) ...[
            const SizedBox(width: AeroSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AeroSpacing.sm - 2,
                vertical: AeroSpacing.xs / 2,
              ),
              decoration: BoxDecoration(
                color: (badgeColor ?? iconColor).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(AeroRadius.sm),
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
            AeroCloseButton(onPressed: onClose!),
        ],
      ),
    );
  }
}
