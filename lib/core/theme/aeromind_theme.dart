import 'package:flutter/material.dart';

/// AeroMind 暗黑极客主题系统
/// ─────────────────────────────
/// 深炭背景 + 冷调蓝紫高亮 + 精细边框阴影
class AeroColors {
  AeroColors._();

  // ── 基础背景层级 ──
  static const Color bgDeep       = Color(0xFF1E1E1E);
  static const Color bgSurface    = Color(0xFF252526);
  static const Color bgElevated   = Color(0xFF2D2D2D);
  static const Color bgHover      = Color(0xFF333337);
  static const Color bgInput      = Color(0xFF1E1E1E);

  // 向后兼容别名
  static const Color surface       = bgSurface;
  static const Color surfaceVariant = bgElevated;

  // ── 主色/强调色 ──
  static const Color primary      = Color(0xFF569CD6);
  static const Color accentBlue   = primary;
  static const Color accentPurple = Color(0xFFC586C0);
  static const Color accentCyan   = Color(0xFF4EC9B0);
  static const Color accentOrange = Color(0xFFCE9178);
  static const Color accentGreen  = Color(0xFF6A9955);
  static const Color accentRed    = Color(0xFFF48771);
  static const Color accentYellow = Color(0xFFDCDCAA);

  // ── 边框与分割线 ──
  static const Color border       = Color(0xFF3E3E42);
  static const Color borderActive = Color(0xFF569CD6);
  static const Color divider      = Color(0xFF3E3E42);

  // ── 状态色 ──
  static const Color success      = Color(0xFF4EC9B0);
  static const Color warning      = Color(0xFFDCDCAA);
  static const Color error        = Color(0xFFF48771);
  static const Color info         = Color(0xFF569CD6);

  // ── AI 实体高亮色 (半透明底) ──
  static const Color entityConcept   = Color(0x20569CD6);
  static const Color entityPerson    = Color(0x20C586C0);
  static const Color entityTask      = Color(0x204EC9B0);
  static const Color entityQuote     = Color(0x20CE9178);
  static const Color entityReference = Color(0x206A9955);

  // ── 文字 ──
  static const Color textPrimary   = Color(0xFFD4D4D4);
  static const Color textSecondary = Color(0xFF808080);
  static const Color textMuted     = Color(0xFF5A5A5A);
  static const Color textLink      = Color(0xFF569CD6);
  static const Color textOnAccent  = Color(0xFFFFFFFF);

  // ── 阴影 ──
  static const Color shadow        = Color(0x4D000000);
}

/// AeroMind 核心主题构建
class AeroTheme {
  AeroTheme._();

  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AeroColors.bgDeep,
        colorScheme: const ColorScheme.dark(
          surface: AeroColors.bgSurface,
          primary: AeroColors.accentBlue,
          secondary: AeroColors.accentPurple,
          outline: AeroColors.border,
        ),
        textTheme: const TextTheme(
          headlineMedium: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: AeroColors.textPrimary,
            letterSpacing: -0.5,
          ),
          titleMedium: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: AeroColors.textPrimary,
          ),
          bodyMedium: TextStyle(
            fontSize: 14,
            height: 1.7,
            color: AeroColors.textPrimary,
          ),
          bodySmall: TextStyle(
            fontSize: 12,
            color: AeroColors.textSecondary,
          ),
          labelSmall: TextStyle(
            fontSize: 11,
            color: AeroColors.textMuted,
            letterSpacing: 0.5,
          ),
        ),
        dividerTheme: const DividerThemeData(
          color: AeroColors.divider,
          thickness: 1,
          space: 0,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: AeroColors.bgElevated,
          foregroundColor: AeroColors.textPrimary,
          shape: Border(
            bottom: BorderSide(color: AeroColors.divider, width: 1),
          ),
        ),
        iconTheme: const IconThemeData(
          color: AeroColors.textSecondary,
          size: 16,
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AeroColors.accentBlue,
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AeroColors.textPrimary,
            side: const BorderSide(color: AeroColors.border),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: AeroColors.accentBlue,
            foregroundColor: AeroColors.textOnAccent,
          ),
        ),
        textSelectionTheme: const TextSelectionThemeData(
          cursorColor: AeroColors.accentBlue,
          selectionColor: Color(0x33569CD6),
          selectionHandleColor: AeroColors.accentBlue,
        ),
        scrollbarTheme: ScrollbarThemeData(
          thumbColor: WidgetStateProperty.all(AeroColors.bgHover),
          thickness: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.hovered)) {
              return 8;
            }
            return 6;
          }),
          radius: const Radius.circular(3),
        ),
        splashFactory: InkRipple.splashFactory,
        snackBarTheme: const SnackBarThemeData(
          backgroundColor: AeroColors.bgElevated,
          contentTextStyle: TextStyle(color: AeroColors.textPrimary),
          behavior: SnackBarBehavior.floating,
        ),
      );

  /// 面板卡片装饰 (含精细边框 + 阴影)
  static BoxDecoration get paneDecoration => BoxDecoration(
        color: AeroColors.bgSurface,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AeroColors.border, width: 0.5),
        boxShadow: const [
          BoxShadow(
            color: AeroColors.shadow,
            blurRadius: 12,
            offset: Offset(2, 0),
          ),
        ],
      );

  /// 堆叠标题栏装饰
  static BoxDecoration get stackedTitleDecoration => const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          right: BorderSide(color: AeroColors.border, width: 0.5),
          bottom: BorderSide(color: AeroColors.border, width: 0.5),
        ),
      );
}
