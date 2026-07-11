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
  static const Color textSecondary = Color(0xFF9D9D9D);
  static const Color textMuted     = Color(0xFF7A7A7A);
  static const Color textLink      = Color(0xFF569CD6);
  static const Color textOnAccent  = Color(0xFFFFFFFF);

  // ── 阴影 ──
  static const Color shadow        = Color(0x4D000000);
}

/// AeroMind 设计系统基础常量
/// ─────────────────────────────
/// 间距、圆角、边框、字号、图标尺寸等设计原子
class AeroSpacing {
  AeroSpacing._();

  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
}

class AeroRadius {
  AeroRadius._();

  static const double xs = 3;
  static const double sm = 4;
  static const double md = 6;
  static const double lg = 8;
  static const double xl = 12;
  static const double pill = 999;
}

class AeroBorderWidth {
  AeroBorderWidth._();

  static const double thin = 0.5;
  static const double base = 1;
  static const double thick = 2;
}

class AeroIconSize {
  AeroIconSize._();

  static const double sm = 14;
  static const double md = 16;
  static const double lg = 18;
  static const double xl = 20;
}

class AeroAnimation {
  AeroAnimation._();

  static const Duration fast = Duration(milliseconds: 120);
  static const Duration normal = Duration(milliseconds: 150);
  static const Duration slow = Duration(milliseconds: 200);
  static const Curve curve = Curves.easeOutCubic;
  static const Duration tooltipWait = Duration(milliseconds: 600);
}

class AeroShadows {
  AeroShadows._();

  static List<BoxShadow> get sm => const [
        BoxShadow(
          color: AeroColors.shadow,
          blurRadius: 8,
          offset: Offset(0, 2),
        ),
      ];

  static List<BoxShadow> get md => const [
        BoxShadow(
          color: AeroColors.shadow,
          blurRadius: 16,
          offset: Offset(0, 4),
        ),
      ];

  static List<BoxShadow> get lg => const [
        BoxShadow(
          color: Color(0x66000000),
          blurRadius: 24,
          offset: Offset(0, 8),
        ),
      ];
}

/// 扩展文本主题：代码等宽字体样式
class AeroTextTheme extends ThemeExtension<AeroTextTheme> {
  final TextStyle codeLarge;
  final TextStyle codeMedium;
  final TextStyle codeSmall;

  const AeroTextTheme({
    required this.codeLarge,
    required this.codeMedium,
    required this.codeSmall,
  });

  @override
  ThemeExtension<AeroTextTheme> copyWith({
    TextStyle? codeLarge,
    TextStyle? codeMedium,
    TextStyle? codeSmall,
  }) {
    return AeroTextTheme(
      codeLarge: codeLarge ?? this.codeLarge,
      codeMedium: codeMedium ?? this.codeMedium,
      codeSmall: codeSmall ?? this.codeSmall,
    );
  }

  @override
  ThemeExtension<AeroTextTheme> lerp(
    ThemeExtension<AeroTextTheme>? other,
    double t,
  ) {
    if (other is! AeroTextTheme) return this;
    return AeroTextTheme(
      codeLarge: TextStyle.lerp(codeLarge, other.codeLarge, t)!,
      codeMedium: TextStyle.lerp(codeMedium, other.codeMedium, t)!,
      codeSmall: TextStyle.lerp(codeSmall, other.codeSmall, t)!,
    );
  }
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
          error: AeroColors.error,
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
        // 扩展：代码字体样式（等宽字体）
        // 使用方式：Theme.of(context).extension<AeroTextTheme>()!.codeMedium
        extensions: const [
          AeroTextTheme(
            codeLarge: TextStyle(
              fontSize: 16,
              fontFamily: 'monospace',
              height: 1.6,
              color: AeroColors.textPrimary,
            ),
            codeMedium: TextStyle(
              fontSize: 14,
              fontFamily: 'monospace',
              height: 1.6,
              color: AeroColors.textPrimary,
            ),
            codeSmall: TextStyle(
              fontSize: 12,
              fontFamily: 'monospace',
              height: 1.5,
              color: AeroColors.textSecondary,
            ),
          ),
        ],
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
        tooltipTheme: TooltipThemeData(
          decoration: BoxDecoration(
            color: AeroColors.bgElevated,
            border: Border.all(color: AeroColors.border),
            borderRadius: BorderRadius.circular(AeroRadius.sm),
            boxShadow: AeroShadows.sm,
          ),
          textStyle: const TextStyle(
            fontSize: 12,
            color: AeroColors.textPrimary,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: AeroSpacing.sm,
            vertical: AeroSpacing.xs,
          ),
          waitDuration: const Duration(milliseconds: 500),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AeroColors.accentBlue,
            padding: const EdgeInsets.symmetric(
              horizontal: AeroSpacing.md,
              vertical: AeroSpacing.sm,
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AeroColors.textPrimary,
            side: const BorderSide(color: AeroColors.border),
            padding: const EdgeInsets.symmetric(
              horizontal: AeroSpacing.md,
              vertical: AeroSpacing.sm,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AeroRadius.md),
            ),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: AeroColors.accentBlue,
            foregroundColor: AeroColors.textOnAccent,
            padding: const EdgeInsets.symmetric(
              horizontal: AeroSpacing.md,
              vertical: AeroSpacing.sm,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AeroRadius.md),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AeroColors.bgInput,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AeroSpacing.md,
            vertical: AeroSpacing.sm,
          ),
          border: OutlineInputBorder(
            borderSide: const BorderSide(color: AeroColors.border),
            borderRadius: BorderRadius.circular(AeroRadius.sm),
          ),
          enabledBorder: OutlineInputBorder(
            borderSide: const BorderSide(color: AeroColors.border),
            borderRadius: BorderRadius.circular(AeroRadius.sm),
          ),
          focusedBorder: OutlineInputBorder(
            borderSide: const BorderSide(color: AeroColors.accentBlue, width: AeroBorderWidth.base),
            borderRadius: BorderRadius.circular(AeroRadius.sm),
          ),
          errorBorder: OutlineInputBorder(
            borderSide: const BorderSide(color: AeroColors.error),
            borderRadius: BorderRadius.circular(AeroRadius.sm),
          ),
          hintStyle: const TextStyle(color: AeroColors.textMuted),
          labelStyle: const TextStyle(color: AeroColors.textSecondary),
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
              return AeroSpacing.sm;
            }
            return 6;
          }),
          radius: Radius.circular(AeroRadius.xs),
        ),
        splashFactory: InkRipple.splashFactory,
        snackBarTheme: const SnackBarThemeData(
          backgroundColor: AeroColors.bgElevated,
          contentTextStyle: TextStyle(color: AeroColors.textPrimary),
          behavior: SnackBarBehavior.floating,
        ),
        dialogTheme: DialogThemeData(
          backgroundColor: AeroColors.bgElevated,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AeroRadius.xl),
            side: const BorderSide(color: AeroColors.border, width: AeroBorderWidth.thin),
          ),
          titleTextStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AeroColors.textPrimary,
          ),
          contentTextStyle: const TextStyle(
            fontSize: 14,
            color: AeroColors.textSecondary,
          ),
        ),
      );

  /// 面板卡片装饰 (含精细边框 + 阴影)
  static BoxDecoration get paneDecoration => BoxDecoration(
        color: AeroColors.bgSurface,
        borderRadius: BorderRadius.circular(AeroRadius.md),
        border: Border.all(color: AeroColors.border, width: AeroBorderWidth.thin),
        boxShadow: AeroShadows.sm,
      );

  /// 堆叠标题栏装饰
  static BoxDecoration get stackedTitleDecoration => const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          right: BorderSide(color: AeroColors.border, width: AeroBorderWidth.thin),
          bottom: BorderSide(color: AeroColors.border, width: AeroBorderWidth.thin),
        ),
      );
}
