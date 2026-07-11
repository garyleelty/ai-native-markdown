import 'package:flutter/material.dart';
import '../theme/aeromind_theme.dart';

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;
  final double iconSize;
  final Color? iconColor;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
    this.iconSize = AeroIconSize.xl + 8,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final color = iconColor ?? AeroColors.textMuted;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AeroSpacing.xxxl,
          vertical: AeroSpacing.xxl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: AeroSpacing.xxxl * 2,
              height: AeroSpacing.xxxl * 2,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AeroRadius.xl),
              ),
              child: Icon(
                icon,
                size: iconSize,
                color: color,
              ),
            ),
            const SizedBox(height: AeroSpacing.lg),
            Text(
              title,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AeroColors.textSecondary.withValues(alpha: 0.9),
              ),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AeroSpacing.xs + 2),
              Text(
                subtitle!,
                style: const TextStyle(
                  fontSize: 12,
                  color: AeroColors.textMuted,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[
              const SizedBox(height: AeroSpacing.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
