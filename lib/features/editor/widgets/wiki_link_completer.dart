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

class WikiLinkCompleter extends StatelessWidget {
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

  int get _totalItemCount => suggestions.isEmpty
      ? 1
      : suggestions.length + 1;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 320, maxHeight: 280),
      decoration: BoxDecoration(
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AeroColors.border, width: 1),
      ),
      child: _buildContent(context),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 10),
            Text('加载中...', style: TextStyle(color: AeroColors.textMuted, fontSize: 12)),
          ],
        ),
      );
    }

    if (suggestions.isEmpty) {
      return _CreateNewTile(
        title: query.isEmpty ? '创建新笔记' : '创建 "[[$query]]"',
        isSelected: selectedIndex == 0,
        onTap: () => onSelected(query),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(10, 6, 10, 4),
          child: Text(
            '双向链接',
            style: TextStyle(
              color: AeroColors.textMuted,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ),
        const Divider(height: 1, thickness: 0.5, color: AeroColors.border),
        Flexible(
          child: ListView.builder(
            padding: EdgeInsets.zero,
            shrinkWrap: true,
            itemCount: _totalItemCount,
            itemBuilder: (context, index) {
              if (index < suggestions.length) {
                final suggestion = suggestions[index];
                final isSelected = index == selectedIndex;
                return _SuggestionTile(
                  title: suggestion.title,
                  matchedRanges: suggestion.matchedRanges,
                  isSelected: isSelected,
                  onTap: () => onSelected(suggestion.title),
                );
              } else {
                return _CreateNewTile(
                  title: query.isEmpty ? '创建新笔记' : '创建 "[[$query]]"',
                  isSelected: index == selectedIndex,
                  onTap: () => onSelected(query),
                );
              }
            },
          ),
        ),
      ],
    );
  }
}

class _SuggestionTile extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        color: isSelected ? AeroColors.accentBlue.withValues(alpha: 0.12) : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Row(
          children: [
            Icon(
              Icons.description_outlined,
              size: 14,
              color: isSelected ? AeroColors.accentBlue : AeroColors.textMuted,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _HighlightedTitle(
                title: title,
                ranges: matchedRanges,
                isSelected: isSelected,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HighlightedTitle extends StatelessWidget {
  final String title;
  final List<MatchRange> ranges;
  final bool isSelected;

  const _HighlightedTitle({
    required this.title,
    required this.ranges,
    required this.isSelected,
  });

  @override
  Widget build(BuildContext context) {
    if (ranges.isEmpty) {
      return Text(
        title,
        style: TextStyle(
          fontSize: 12,
          color: isSelected ? AeroColors.textPrimary : AeroColors.textSecondary,
        ),
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
          backgroundColor: AeroColors.accentCyan.withValues(alpha: 0.12),
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
        style: TextStyle(
          fontSize: 12,
          color: isSelected ? AeroColors.textPrimary : AeroColors.textSecondary,
        ),
        children: spans,
      ),
    );
  }
}

class _CreateNewTile extends StatelessWidget {
  final String title;
  final bool isSelected;
  final VoidCallback onTap;

  const _CreateNewTile({
    required this.title,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        color: isSelected ? AeroColors.accentGreen.withValues(alpha: 0.1) : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Row(
          children: [
            Icon(
              Icons.add,
              size: 14,
              color: isSelected ? AeroColors.accentGreen : AeroColors.textMuted,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  color: isSelected ? AeroColors.accentGreen : AeroColors.textMuted,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
