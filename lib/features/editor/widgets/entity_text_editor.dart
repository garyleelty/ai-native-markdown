import 'package:flutter/material.dart';
import '../../../core/models/note_model.dart';
import '../../../core/theme/aeromind_theme.dart';

/// ══════════════════════════════════════════════════
/// EntityTextEditor
/// ══════════════════════════════════════════════════
/// 在普通 Text/EditableText 之上，叠加 AI 识别的实体高亮层。
///
/// 实现原理:
///   使用 CustomPainter 在文本底层绘制柔和下划线/背景色。
///   实体区间由 EntityHighlight 的 startOffset/endOffset 定义。
///   点击实体区间时弹出 AI 联想卡片。
///
/// 注意: 这是一个「阅读视图」组件，编辑视图在 NotePanel 中使用
///       EditableText + Overlay 实现。
/// ──────────────────────────────────────────────────

class EntityTextEditor extends StatelessWidget {
  final String text;
  final List<EntityHighlight> entities;
  final ValueChanged<EntityHighlight>? onEntityTap;
  /// wiki link 悬浮回调 (linkText → 显示预览卡片)
  final void Function(String linkText, LayerLink layerLink)? onWikiLinkHover;
  final VoidCallback? onWikiLinkExit;

  const EntityTextEditor({
    super.key,
    required this.text,
    required this.entities,
    this.onEntityTap,
    this.onWikiLinkHover,
    this.onWikiLinkExit,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapUp: (details) => _handleTap(context, details),
      child: CustomPaint(
        painter: _EntityHighlightPainter(
          text: text,
          entities: entities,
          textStyle: Theme.of(context).textTheme.bodyMedium!,
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text.rich(
            _buildTextSpan(context),
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      ),
    );
  }

  /// 构建带实体高亮的 TextSpan
  /// 修复: 处理实体区间重叠——按区间长度升序排序，
  /// 被包含在外层实体内的内层实体跳过，避免 WidgetSpan 重叠
  TextSpan _buildTextSpan(BuildContext context) {
    if (entities.isEmpty) {
      return TextSpan(text: text);
    }

    final spans = <InlineSpan>[];
    int cursor = 0;

    // 1. 按 startOffset 排序，startOffset 相同时短区间优先
    final sorted = [...entities]
      ..sort((a, b) {
        final cmp = a.startOffset.compareTo(b.startOffset);
        if (cmp != 0) return cmp;
        // 短区间优先，避免被长区间吞没
        final aLen = a.endOffset - a.startOffset;
        final bLen = b.endOffset - b.startOffset;
        return aLen.compareTo(bLen);
      });

    // 2. 去除被前一个区间完全包含的实体 (区间树的简化版)
    final deduped = <EntityHighlight>[];
    for (final entity in sorted) {
      if (deduped.isNotEmpty) {
        final prev = deduped.last;
        // 当前实体被前一个完全包含 → 跳过
        if (entity.startOffset >= prev.startOffset &&
            entity.endOffset <= prev.endOffset) {
          continue;
        }
        // 当前实体与前一个部分重叠但不被包含 → 截断前一个的 end
        // (保留前一个，但后续正常处理当前)
      }
      deduped.add(entity);
    }

    for (final entity in deduped) {
      final safeStart = entity.startOffset.clamp(0, text.length);
      final safeEnd = entity.endOffset.clamp(0, text.length);

      // 跳过已过游标的实体 (游标已前进越过)
      if (safeStart < cursor) continue;

      // 实体前的普通文本
      if (safeStart > cursor) {
        spans.add(TextSpan(
          text: text.substring(cursor, safeStart),
        ));
      }

      // 实体文本 (带下划线 + 颜色)
      if (safeStart < safeEnd) {
        spans.add(WidgetSpan(
          alignment: PlaceholderAlignment.baseline,
          baseline: TextBaseline.alphabetic,
          child: _EntityInlineWidget(
            entity: entity,
            text: text.substring(safeStart, safeEnd),
            onTap: onEntityTap != null
                ? () => onEntityTap!(entity)
                : null,
            onWikiLinkHover: onWikiLinkHover,
            onWikiLinkExit: onWikiLinkExit,
          ),
        ));
        cursor = safeEnd;
      }
    }

    // 尾部普通文本
    if (cursor < text.length) {
      spans.add(TextSpan(text: text.substring(cursor)));
    }

    return TextSpan(children: spans);
  }

  void _handleTap(BuildContext context, TapUpDetails details) {
    // 简化处理: 由 WidgetSpan 的 GestureDetector 直接处理
  }
}

/// 单个实体内联 Widget
class _EntityInlineWidget extends StatefulWidget {
  final EntityHighlight entity;
  final String text;
  final VoidCallback? onTap;
  final void Function(String linkText, LayerLink layerLink)? onWikiLinkHover;
  final VoidCallback? onWikiLinkExit;

  const _EntityInlineWidget({
    required this.entity,
    required this.text,
    this.onTap,
    this.onWikiLinkHover,
    this.onWikiLinkExit,
  });

  @override
  State<_EntityInlineWidget> createState() => _EntityInlineWidgetState();
}

class _EntityInlineWidgetState extends State<_EntityInlineWidget> {
  bool _isHovered = false;
  final LayerLink _layerLink = LayerLink();

  Color get _entityColor {
    switch (widget.entity.type) {
      case EntityType.concept:
        return AeroColors.accentBlue;
      case EntityType.person:
        return AeroColors.accentPurple;
      case EntityType.task:
        return AeroColors.accentCyan;
      case EntityType.quote:
        return AeroColors.accentOrange;
      case EntityType.reference:
        return AeroColors.accentGreen;
    }
 }

  Color get _entityBgColor {
    switch (widget.entity.type) {
      case EntityType.concept:
        return AeroColors.entityConcept;
      case EntityType.person:
        return AeroColors.entityPerson;
      case EntityType.task:
        return AeroColors.entityTask;
      case EntityType.quote:
        return AeroColors.entityQuote;
      case EntityType.reference:
        return AeroColors.entityReference;
    }
  }

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) {
        setState(() => _isHovered = true);
        // reference 类型触发悬浮预览
        if (widget.entity.type == EntityType.reference &&
            widget.onWikiLinkHover != null) {
          widget.onWikiLinkHover!(widget.text, _layerLink);
        }
      },
      onExit: (_) {
        setState(() => _isHovered = false);
        if (widget.entity.type == EntityType.reference &&
            widget.onWikiLinkExit != null) {
          widget.onWikiLinkExit!();
        }
      },
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        child: CompositedTransformTarget(
          link: _layerLink,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(vertical: 1, horizontal: 2),
            decoration: BoxDecoration(
              color: _isHovered
                  ? _entityColor.withValues(alpha: 0.15)
                  : _entityBgColor,
              borderRadius: BorderRadius.circular(3),
              border: Border(
                bottom: BorderSide(
                  color: _entityColor.withValues(alpha: 0.6),
                  width: 1.5,
                  style: BorderStyle.solid,
                ),
              ),
            ),
            child: Builder(
              builder: (context) => Text(
                widget.text,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: _isHovered ? _entityColor : AeroColors.textPrimary,
                      fontWeight: _isHovered ? FontWeight.w500 : FontWeight.w400,
                    ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 实体高亮底层绘制器 (柔和下划线/背景)
class _EntityHighlightPainter extends CustomPainter {
  final String text;
  final List<EntityHighlight> entities;
  final TextStyle textStyle;

  _EntityHighlightPainter({
    required this.text,
    required this.entities,
    required this.textStyle,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // 此处简化: 实际的文本布局偏移计算需要 TextPainter
    // 核心高亮逻辑已在 _EntityInlineWidget 中通过 WidgetSpan 实现
    // CustomPainter 预留给未来需要精确像素级渲染的场景
  }

  @override
  bool shouldRepaint(covariant _EntityHighlightPainter oldDelegate) {
    return oldDelegate.entities != entities || oldDelegate.text != text;
  }
}
