import '../models/note_model.dart';

/// 搜索匹配项
class SearchMatch {
  final int start;
  final int end;
  final String field; // title, content, tag

  const SearchMatch({
    required this.start,
    required this.end,
    required this.field,
  });
}

/// 搜索结果
class SearchResult {
  final NoteModel note;
  final List<SearchMatch> matches;
  final String preview;
  final double score;

  const SearchResult({
    required this.note,
    required this.matches,
    required this.preview,
    required this.score,
  });
}

/// 高级搜索解析结果
class ParsedSearchQuery {
  final String rawQuery;
  final String? titleFilter;
  final String? contentFilter;
  final String? tagFilter;
  final List<String> keywords;

  const ParsedSearchQuery({
    required this.rawQuery,
    this.titleFilter,
    this.contentFilter,
    this.tagFilter,
    this.keywords = const [],
  });

  bool get hasFilters =>
      titleFilter != null ||
      contentFilter != null ||
      tagFilter != null;
}

/// 搜索服务
class SearchService {
  /// 解析高级搜索语法
  ///
  /// 支持:
  /// - `title:关键词` - 仅搜索标题
  /// - `content:关键词` - 仅搜索正文
  /// - `tag:标签名` - 按标签搜索
  static ParsedSearchQuery parseQuery(String query) {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      return ParsedSearchQuery(rawQuery: '');
    }

    String? titleFilter;
    String? contentFilter;
    String? tagFilter;
    final keywords = <String>[];

    // 匹配高级语法: prefix:value
    final prefixPattern = RegExp(r'(\w+):([^\s]+)');
    final matches = prefixPattern.allMatches(trimmed);

    // 提取所有匹配的前缀语法
    final removedIndices = <int>[];
    for (final match in matches) {
      final prefix = match.group(1)!.toLowerCase();
      final value = match.group(2)!;

      switch (prefix) {
        case 'title':
        case 't':
          titleFilter = value;
          break;
        case 'content':
        case 'c':
          contentFilter = value;
          break;
        case 'tag':
          tagFilter = value;
          break;
        default:
          // 未知前缀，当作普通关键词
          keywords.add(value);
          continue;
      }
      removedIndices.add(match.start);
      removedIndices.add(match.end);
    }

    // 提取剩余的普通关键词
    final buffer = StringBuffer();
    for (int i = 0; i < trimmed.length; i++) {
      if (removedIndices.contains(i)) continue;
      buffer.write(trimmed[i]);
    }

    final remaining = buffer.toString().trim();
    if (remaining.isNotEmpty) {
      keywords.addAll(remaining.split(RegExp(r'\s+')).where((k) => k.isNotEmpty));
    }

    return ParsedSearchQuery(
      rawQuery: trimmed,
      titleFilter: titleFilter,
      contentFilter: contentFilter,
      tagFilter: tagFilter,
      keywords: keywords,
    );
  }

  /// 在笔记中搜索并返回详细结果
  static List<SearchResult> searchNotes(
    List<NoteModel> notes,
    String query,
  ) {
    final parsed = parseQuery(query);
    if (parsed.rawQuery.isEmpty) return [];

    final results = <SearchResult>[];

    for (final note in notes) {
      final matches = <SearchMatch>[];
      double score = 0;

      // 标题搜索
      if (parsed.titleFilter != null) {
        final titleMatches = _findMatches(
          note.title,
          parsed.titleFilter!,
          'title',
        );
        if (titleMatches.isNotEmpty) {
          matches.addAll(titleMatches);
          score += titleMatches.length * 10;
        } else {
          // 有 title: 过滤但标题不匹配，跳过
          continue;
        }
      }

      // 标签搜索
      if (parsed.tagFilter != null) {
        bool tagFound = false;
        for (final tag in note.tags) {
          if (tag.toLowerCase().contains(parsed.tagFilter!.toLowerCase())) {
            matches.add(SearchMatch(start: 0, end: tag.length, field: 'tag'));
            score += 8;
            tagFound = true;
            break;
          }
        }
        // 也搜索内容中的 #标签
        final tagPattern = RegExp(r'#(\w+)');
        final contentTagMatches = tagPattern.allMatches(note.rawMarkdown);
        for (final m in contentTagMatches) {
          final tagName = m.group(1)!;
          if (tagName.toLowerCase().contains(parsed.tagFilter!.toLowerCase())) {
            matches.add(SearchMatch(start: m.start, end: m.end, field: 'tag'));
            score += 5;
            tagFound = true;
          }
        }
        if (!tagFound) continue;
      }

      // 正文搜索
      if (parsed.contentFilter != null) {
        final contentMatches = _findMatches(
          note.rawMarkdown,
          parsed.contentFilter!,
          'content',
        );
        if (contentMatches.isNotEmpty) {
          matches.addAll(contentMatches);
          score += contentMatches.length * 3;
        } else {
          continue;
        }
      }

      // 普通关键词搜索（在标题和正文中）
      if (parsed.keywords.isNotEmpty) {
        for (final keyword in parsed.keywords) {
          // 标题匹配
          final titleMatch = _findMatches(note.title, keyword, 'title');
          if (titleMatch.isNotEmpty) {
            matches.addAll(titleMatch);
            score += titleMatch.length * 10;
          }
          // 正文匹配
          final contentMatch = _findMatches(note.rawMarkdown, keyword, 'content');
          if (contentMatch.isNotEmpty) {
            matches.addAll(contentMatch);
            score += contentMatch.length * 2;
          }
          // 标签匹配
          for (final tag in note.tags) {
            if (tag.toLowerCase().contains(keyword.toLowerCase())) {
              matches.add(const SearchMatch(start: 0, end: 0, field: 'tag'));
              score += 5;
              break;
            }
          }
        }
      }

      // 如果没有过滤条件也没有关键词，就不匹配
      if (!parsed.hasFilters && parsed.keywords.isEmpty) {
        continue;
      }

      if (matches.isNotEmpty) {
        final preview = _buildPreview(note.rawMarkdown, matches);
        results.add(SearchResult(
          note: note,
          matches: matches,
          preview: preview,
          score: score,
        ));
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score.compareTo(a.score));
    return results;
  }

  /// 查找字符串中的所有匹配
  static List<SearchMatch> _findMatches(
    String text,
    String keyword,
    String field,
  ) {
    final matches = <SearchMatch>[];
    final lowerText = text.toLowerCase();
    final lowerKeyword = keyword.toLowerCase();

    int startIndex = 0;
    while (true) {
      final index = lowerText.indexOf(lowerKeyword, startIndex);
      if (index == -1) break;
      matches.add(SearchMatch(
        start: index,
        end: index + keyword.length,
        field: field,
      ));
      startIndex = index + keyword.length;
      if (matches.length >= 10) break; // 最多 10 个匹配
    }

    return matches;
  }

  /// 构建搜索预览文本
  static String _buildPreview(String content, List<SearchMatch> matches) {
    if (matches.isEmpty) {
      return content.length > 80
          ? '${content.substring(0, 80)}...'
          : content;
    }

    // 找到第一个正文匹配
    final contentMatches = matches.where((m) => m.field == 'content').toList();
    if (contentMatches.isEmpty) {
      return content.length > 80
          ? '${content.substring(0, 80)}...'
          : content;
    }

    final firstMatch = contentMatches.first;
    final previewLength = 100;
    final halfLen = previewLength ~/ 2;

    int start = (firstMatch.start - halfLen).clamp(0, content.length);
    int end = (firstMatch.end + halfLen).clamp(0, content.length);

    // 调整以避免截断单词
    if (start > 0) {
      // 找最近的空格或换行
      final spaceBefore = content.lastIndexOf(RegExp(r'[\s\n]'), start);
      if (spaceBefore != -1 && start - spaceBefore < 20) {
        start = spaceBefore + 1;
      }
    }
    if (end < content.length) {
      final spaceAfter = content.indexOf(RegExp(r'[\s\n]'), end);
      if (spaceAfter != -1 && spaceAfter - end < 20) {
        end = spaceAfter;
      }
    }

    final prefix = start > 0 ? '...' : '';
    final suffix = end < content.length ? '...' : '';

    // 清理换行和多余空格
    var preview = content.substring(start, end);
    preview = preview.replaceAll('\n', ' ').replaceAll(RegExp(r'\s+'), ' ');

    return '$prefix$preview$suffix';
  }
}
