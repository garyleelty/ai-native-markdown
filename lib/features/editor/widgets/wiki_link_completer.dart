import 'dart:ui';
import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../quick_switcher/services/fuzzy_matcher.dart';

class WikiLinkSuggestion {
  final String noteId;
  final String title;
  final List<MatchRange> matchedRanges;

  const WikiLinkSuggestion({
    required this.noteId,
    required this.title,
    this.matchedRanges = const [],
  });
}

/// ══════════════════════════════════════════════════
/// 双向链接补全面板 — "Frosted Carbon" 设计
/// ══════════════════════════════════════════════════
/// 浮动玻璃面板，碳纤维深度，选中项如灯丝发光。
/// 入场动画：scale + opacity + translateY，180ms。
/// 选中态：左强调条 + 水平渐变聚光灯 + 字重提升。
/// 悬停态：柔和背景染色。
class WikiLinkCompleter extends StatefulWidget {
  final String query;
  final int selectedIndex;
  final List<WikiLinkSuggestion> suggestions;
  final bool loading;
  final void Function(String title) onSelected;

  const WikiLinkCompleter({
    super.key,
    required this.query,
    required this.selectedIndex,
    required this.suggestions,
    this.loading = false,
    required this.onSelected,
  });

  @override
  State<WikiLinkCompleter> createState() => _WikiLinkCompleterState();
}

class _WikiLinkCompleterState extends State<WikiLinkCompleter>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 180),
    );
    _scale = Tween(begin: 0.96, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _opacity = Tween(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );
    _slide = Tween(begin: const Offset(0, 4), end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  int get _totalItemCount =>
      widget.suggestions.isEmpty ? 1 : widget.suggestions.length + 1;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, _slide.value.dy),
          child: Transform.scale(
            scale: _scale.value,
            alignment: Alignment.topLeft,
            child: Opacity(
              opacity: _opacity.value,
              child: child,
            ),
          ),
        );
      },
      child: _buildPanel(),
    );
  }

  Widget _buildPanel() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 340, maxHeight: 340),
          decoration: BoxDecoration(
            // 碳纤维渐变：顶部微亮 → 底部沉色
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFF333338),
                Color(0xFF2A2A2E),
              ],
            ),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AeroColors.border.withValues(alpha: 0.8), width: 1),
            // 顶部高光线
            boxShadow: const [
              BoxShadow(
                color: Color(0x66000000),
                blurRadius: 24,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: _buildContent(),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (widget.loading) {
      return _buildLoading();
    }

    if (widget.suggestions.isEmpty) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _CreateNewTile(
            title: widget.query.isEmpty ? '创建新笔记' : '创建 "[[${widget.query}]]"',
            isSelected: widget.selectedIndex == 0,
            isHovered: false,
            onTap: () => widget.onSelected(widget.query),
          ),
          const _KeyboardHints(),
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── 标题栏 ──
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 8, 14, 6),
          child: Row(
            children: [
              Text(
                '双向链接',
                style: TextStyle(
                  color: AeroColors.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: AeroColors.bgSurface.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '${widget.suggestions.length}',
                  style: TextStyle(
                    color: AeroColors.textSecondary,
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        // 渐变分割线（中间深，两端淡）
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Container(
            height: 0.5,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AeroColors.border.withValues(alpha: 0),
                  AeroColors.border,
                  AeroColors.border.withValues(alpha: 0),
                ],
              ),
            ),
          ),
        ),
        // ── 建议列表 ──
        Flexible(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 3),
            shrinkWrap: true,
            itemCount: _totalItemCount,
            itemBuilder: (context, index) {
              if (index < widget.suggestions.length) {
                final suggestion = widget.suggestions[index];
                final isSelected = index == widget.selectedIndex;
                return _SuggestionTile(
                  title: suggestion.title,
                  matchedRanges: suggestion.matchedRanges,
                  isSelected: isSelected,
                  onTap: () => widget.onSelected(suggestion.title),
                );
              } else {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Container(
                        height: 0.5,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AeroColors.border.withValues(alpha: 0),
                              AeroColors.border,
                              AeroColors.border.withValues(alpha: 0),
                            ],
                          ),
                        ),
                      ),
                    ),
                    _CreateNewTile(
                      title: widget.query.isEmpty ? '创建新笔记' : '创建 "[[${widget.query}]]"',
                      isSelected: index == widget.selectedIndex,
                      isHovered: false,
                      onTap: () => widget.onSelected(widget.query),
                    ),
                  ],
                );
              }
            },
          ),
        ),
        const _KeyboardHints(),
      ],
    );
  }

  Widget _buildLoading() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 13,
            height: 13,
            child: CircularProgressIndicator(
              strokeWidth: 1.5,
              color: AeroColors.accentBlue.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(width: 10),
          const Text(
            '搜索笔记...',
            style: TextStyle(
              color: AeroColors.textMuted,
              fontSize: 12,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════
// 建议项 Tile — 带渐变聚光灯选中效果
// ══════════════════════════════════════════════════
class _SuggestionTile extends StatefulWidget {
  final String title;
  final List<MatchRange> matchedRanges;
  final bool isSelected;
  final VoidCallback onTap;

  const _SuggestionTile({
    required this.title,
    required this.matchedRanges,
    required this.isSelected,
    required this.onTap,
  });

  @override
  State<_SuggestionTile> createState() => _SuggestionTileState();
}

class _SuggestionTileState extends State<_SuggestionTile> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    const accentColor = AeroColors.accentBlue;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          // 选中态：从左到右的渐变聚光灯
          decoration: BoxDecoration(
            gradient: widget.isSelected
                ? LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      accentColor.withValues(alpha: 0.18),
                      accentColor.withValues(alpha: 0.04),
                    ],
                  )
                : _isHovered
                    ? LinearGradient(colors: [
                        AeroColors.bgHover.withValues(alpha: 0.6),
                        AeroColors.bgHover.withValues(alpha: 0.2),
                      ])
                    : null,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Row(
            children: [
              // 左强调条 — 选中时发光
              AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 2.5,
                height: 18,
                decoration: BoxDecoration(
                  color: widget.isSelected ? accentColor : Colors.transparent,
                  borderRadius: BorderRadius.circular(2),
                  boxShadow: widget.isSelected
                      ? [
                          BoxShadow(
                            color: accentColor.withValues(alpha: 0.5),
                            blurRadius: 6,
                            spreadRadius: 0,
                          ),
                        ]
                      : null,
                ),
              ),
              const SizedBox(width: 10),
              Icon(
                Icons.article_outlined,
                size: 14,
                color: widget.isSelected
                    ? accentColor
                    : _isHovered
                        ? AeroColors.textSecondary
                        : AeroColors.textMuted,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _HighlightedTitle(
                  title: widget.title,
                  ranges: widget.matchedRanges,
                  isSelected: widget.isSelected,
                  isHovered: _isHovered,
                ),
              ),
              // 选中时右侧箭头指示
              if (widget.isSelected)
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Icon(
                    Icons.keyboard_return,
                    size: 11,
                    color: AeroColors.textMuted.withValues(alpha: 0.6),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════
// 匹配高亮标题
// ══════════════════════════════════════════════════
class _HighlightedTitle extends StatelessWidget {
  final String title;
  final List<MatchRange> ranges;
  final bool isSelected;
  final bool isHovered;

  const _HighlightedTitle({
    required this.title,
    required this.ranges,
    required this.isSelected,
    required this.isHovered,
  });

  @override
  Widget build(BuildContext context) {
    final baseColor = isSelected
        ? AeroColors.textPrimary
        : isHovered
            ? AeroColors.textPrimary.withValues(alpha: 0.85)
            : AeroColors.textSecondary;
    final baseWeight = isSelected ? FontWeight.w500 : FontWeight.w400;

    if (ranges.isEmpty) {
      return Text(
        title,
        style: TextStyle(fontSize: 12, color: baseColor, fontWeight: baseWeight),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      );
    }

    final spans = <TextSpan>[];
    int lastEnd = 0;
    for (final range in ranges) {
      if (range.start > lastEnd) {
        spans.add(TextSpan(text: title.substring(lastEnd, range.start)));
      }
      spans.add(TextSpan(
        text: title.substring(range.start, range.end),
        style: TextStyle(
          color: AeroColors.accentCyan,
          fontWeight: FontWeight.w600,
          backgroundColor: AeroColors.accentCyan.withValues(alpha: 0.20),
        ),
      ));
      lastEnd = range.end;
    }
    if (lastEnd < title.length) {
      spans.add(TextSpan(text: title.substring(lastEnd)));
    }

    return RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: TextStyle(fontSize: 12, color: baseColor, fontWeight: baseWeight),
        children: spans,
      ),
    );
  }
}

// ══════════════════════════════════════════════════
// 创建新笔记 Tile
// ══════════════════════════════════════════════════
class _CreateNewTile extends StatefulWidget {
  final String title;
  final bool isSelected;
  final bool isHovered;
  final VoidCallback onTap;

  const _CreateNewTile({
    required this.title,
    required this.isSelected,
    required this.isHovered,
    required this.onTap,
  });

  @override
  State<_CreateNewTile> createState() => _CreateNewTileState();
}

class _CreateNewTileState extends State<_CreateNewTile> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    const accentColor = AeroColors.accentGreen;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            gradient: widget.isSelected
                ? LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      accentColor.withValues(alpha: 0.14),
                      accentColor.withValues(alpha: 0.03),
                    ],
                  )
                : _isHovered
                    ? LinearGradient(colors: [
                        AeroColors.bgHover.withValues(alpha: 0.6),
                        AeroColors.bgHover.withValues(alpha: 0.2),
                      ])
                    : null,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 2.5,
                height: 18,
                decoration: BoxDecoration(
                  color: widget.isSelected ? accentColor : Colors.transparent,
                  borderRadius: BorderRadius.circular(2),
                  boxShadow: widget.isSelected
                      ? [
                          BoxShadow(
                            color: accentColor.withValues(alpha: 0.4),
                            blurRadius: 5,
                          ),
                        ]
                      : null,
                ),
              ),
              const SizedBox(width: 10),
              Icon(
                Icons.add,
                size: 14,
                color: widget.isSelected
                    ? accentColor
                    : _isHovered
                        ? AeroColors.textSecondary
                        : AeroColors.textMuted,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: widget.isSelected ? FontWeight.w500 : FontWeight.w400,
                    color: widget.isSelected
                        ? accentColor
                        : _isHovered
                            ? AeroColors.textSecondary
                            : AeroColors.textMuted,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (widget.isSelected)
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Icon(
                    Icons.keyboard_return,
                    size: 11,
                    color: AeroColors.textMuted.withValues(alpha: 0.6),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════
// 键盘快捷键提示底栏
// ══════════════════════════════════════════════════
class _KeyboardHints extends StatelessWidget {
  const _KeyboardHints();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 5, 14, 6),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: AeroColors.border.withValues(alpha: 0.5), width: 0.5),
        ),
      ),
      child: Row(
        children: [
          _HintKey(label: '↑↓', description: '导航'),
          const SizedBox(width: 12),
          _HintKey(label: '↵', description: '选择'),
          const SizedBox(width: 12),
          _HintKey(label: 'Esc', description: '关闭'),
        ],
      ),
    );
  }
}

class _HintKey extends StatelessWidget {
  final String label;
  final String description;

  const _HintKey({required this.label, required this.description});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
          decoration: BoxDecoration(
            // 键帽渐变：顶部微亮模拟物理按键
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFF3A3A3E),
                Color(0xFF2E2E32),
              ],
            ),
            borderRadius: BorderRadius.circular(3),
            border: Border.all(color: AeroColors.border.withValues(alpha: 0.6), width: 0.5),
            boxShadow: const [
              BoxShadow(
                color: Color(0x40000000),
                blurRadius: 2,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: AeroColors.textSecondary,
              height: 1.3,
              letterSpacing: 0.3,
            ),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          description,
          style: const TextStyle(
            fontSize: 9,
            color: AeroColors.textMuted,
            letterSpacing: 0.2,
          ),
        ),
      ],
    );
  }
}
