/// ══════════════════════════════════════════════════
/// SyntaxHighlighter — 轻量级代码语法高亮
/// ══════════════════════════════════════════════════
/// 基于正则的简易语法高亮器，支持常见语言：
///   - Dart / JavaScript / TypeScript / Python / JSON / Bash
///   - Markdown 源码模式高亮
///   - 未识别语言退化为纯文本（无高亮）
///
/// 输出为 TextSpan 树，可直接用于 RichText / Text.rich。
/// ──────────────────────────────────────────────────
library;

import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';

class SyntaxHighlighter {
  SyntaxHighlighter._();

  /// Markdown 基础语法高亮样式
  static const TextStyle _mdBaseStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.textPrimary,
  );

  static const TextStyle _mdHeadingStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.accentBlue,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle _mdWikiLinkStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.accentGreen,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle _mdTagStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.accentCyan,
  );

  static const TextStyle _mdTaskStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.accentOrange,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle _mdCodeStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.accentOrange,
    fontFamily: 'monospace',
    backgroundColor: AeroColors.bgDeep,
  );

  static const TextStyle _mdBoldStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.textPrimary,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle _mdItalicStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.textPrimary,
    fontStyle: FontStyle.italic,
  );

  static const TextStyle _mdLinkStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.accentBlue,
    decoration: TextDecoration.underline,
  );

  static const TextStyle _mdQuoteStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.textSecondary,
    fontStyle: FontStyle.italic,
  );

  static const TextStyle _mdListStyle = TextStyle(
    fontSize: 14,
    height: 1.7,
    color: AeroColors.accentPurple,
    fontWeight: FontWeight.w600,
  );

  /// 解析 Markdown 文本生成带高亮的 TextSpan
  static TextSpan highlightMarkdown(String text, {TextStyle? baseStyle}) {
    final style = baseStyle ?? _mdBaseStyle;
    final spans = <InlineSpan>[];

    final patterns = <_MdPattern>[
      _MdPattern(regex: RegExp(r'^#{1,6}\s.*$', multiLine: true), type: _MdTokenType.heading),
      _MdPattern(regex: RegExp(r'\[\[([^\]]+)\]\]'), type: _MdTokenType.wikiLink),
      _MdPattern(regex: RegExp(r'#(\w+)'), type: _MdTokenType.tag),
      _MdPattern(regex: RegExp(r'^- \[[ xX]\]', multiLine: true), type: _MdTokenType.task),
      _MdPattern(regex: RegExp(r'`([^`]+)`'), type: _MdTokenType.code),
      _MdPattern(regex: RegExp(r'\*\*([^*]+)\*\*'), type: _MdTokenType.bold),
      _MdPattern(regex: RegExp(r'__([^_]+)__'), type: _MdTokenType.bold),
      _MdPattern(regex: RegExp(r'\*([^*]+)\*'), type: _MdTokenType.italic),
      _MdPattern(regex: RegExp(r'_([^_]+)_'), type: _MdTokenType.italic),
      _MdPattern(regex: RegExp(r'^>\s?.*$', multiLine: true), type: _MdTokenType.quote),
      _MdPattern(regex: RegExp(r'^[-*+]\s', multiLine: true), type: _MdTokenType.listBullet),
      _MdPattern(regex: RegExp(r'^\d+\.\s', multiLine: true), type: _MdTokenType.listNumber),
      _MdPattern(regex: RegExp(r'\[([^\]]+)\]\(([^)]+)\)'), type: _MdTokenType.link),
    ];

    final lines = text.split('\n');
    for (int lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      final line = lines[lineIdx];
      if (lineIdx > 0) {
        spans.add(const TextSpan(text: '\n'));
      }
      _highlightLine(line, spans, patterns, style);
    }

    return TextSpan(style: style, children: spans);
  }

  static void _highlightLine(String line, List<InlineSpan> spans, List<_MdPattern> patterns, TextStyle baseStyle) {
    int cursor = 0;

    _MdTokenType? lineType;
    int lineTypeEnd = 0;

    if (RegExp(r'^#{1,6}\s').hasMatch(line)) {
      lineType = _MdTokenType.heading;
      lineTypeEnd = line.indexOf(' ');
    } else if (line.startsWith('>')) {
      lineType = _MdTokenType.quote;
      lineTypeEnd = line.startsWith('> ') ? 2 : 1;
    } else if (RegExp(r'^- \[[ xX]\]').hasMatch(line)) {
      lineType = _MdTokenType.task;
      lineTypeEnd = 5;
    } else if (RegExp(r'^[-*+]\s').hasMatch(line)) {
      lineType = _MdTokenType.listBullet;
      lineTypeEnd = 2;
    } else if (RegExp(r'^\d+\.\s').hasMatch(line)) {
      lineType = _MdTokenType.listNumber;
      final match = RegExp(r'^(\d+\.)\s').firstMatch(line);
      lineTypeEnd = match != null ? match.end : 3;
    }

    if (lineType != null && lineTypeEnd > 0) {
      final marker = line.substring(0, lineTypeEnd);
      final markerStyle = _getMdStyle(lineType);
      spans.add(TextSpan(text: marker, style: markerStyle));
      cursor = lineTypeEnd;
    }

    final remainingText = line.substring(cursor);
    _highlightInline(remainingText, spans, patterns, lineType, baseStyle);
  }

  static void _highlightInline(String text, List<InlineSpan> spans, List<_MdPattern> patterns, _MdTokenType? lineType, TextStyle baseStyle) {
    int cursor = 0;
    final lineBaseStyle = lineType == _MdTokenType.quote ? _mdQuoteStyle : baseStyle;

    while (cursor < text.length) {
      int earliestStart = text.length;
      _MdPattern? earliestPattern;
      RegExpMatch? earliestMatch;

      for (final pattern in patterns) {
        if (pattern.type == _MdTokenType.heading ||
            pattern.type == _MdTokenType.quote ||
            pattern.type == _MdTokenType.task ||
            pattern.type == _MdTokenType.listBullet ||
            pattern.type == _MdTokenType.listNumber) {
          continue;
        }
        final match = pattern.regex.firstMatch(text.substring(cursor));
        if (match != null) {
          final absStart = cursor + match.start;
          if (absStart < earliestStart) {
            earliestStart = absStart;
            earliestPattern = pattern;
            earliestMatch = match;
          }
        }
      }

      if (earliestPattern == null || earliestMatch == null) {
        spans.add(TextSpan(text: text.substring(cursor), style: lineBaseStyle));
        break;
      }

      if (earliestStart > cursor) {
        spans.add(TextSpan(text: text.substring(cursor, earliestStart), style: lineBaseStyle));
      }

      final matchedText = earliestMatch.group(0)!;
      final content = earliestMatch.group(1) ?? '';

      switch (earliestPattern.type) {
        case _MdTokenType.wikiLink:
          spans.add(TextSpan(text: matchedText, style: _mdWikiLinkStyle));
          break;
        case _MdTokenType.tag:
          spans.add(TextSpan(text: matchedText, style: _mdTagStyle));
          break;
        case _MdTokenType.code:
          spans.add(TextSpan(text: matchedText, style: _mdCodeStyle));
          break;
        case _MdTokenType.bold:
          spans.add(TextSpan(text: content, style: _mdBoldStyle));
          break;
        case _MdTokenType.italic:
          spans.add(TextSpan(text: content, style: _mdItalicStyle));
          break;
        case _MdTokenType.link:
          spans.add(TextSpan(text: matchedText, style: _mdLinkStyle));
          break;
        default:
          spans.add(TextSpan(text: matchedText, style: lineBaseStyle));
      }

      cursor = earliestStart + matchedText.length;
    }
  }

  static TextStyle _getMdStyle(_MdTokenType type) {
    switch (type) {
      case _MdTokenType.heading:
        return _mdHeadingStyle;
      case _MdTokenType.wikiLink:
        return _mdWikiLinkStyle;
      case _MdTokenType.tag:
        return _mdTagStyle;
      case _MdTokenType.task:
        return _mdTaskStyle;
      case _MdTokenType.code:
        return _mdCodeStyle;
      case _MdTokenType.bold:
        return _mdBoldStyle;
      case _MdTokenType.italic:
        return _mdItalicStyle;
      case _MdTokenType.link:
        return _mdLinkStyle;
      case _MdTokenType.quote:
        return _mdQuoteStyle;
      case _MdTokenType.listBullet:
      case _MdTokenType.listNumber:
        return _mdListStyle;
    }
  }

  /// 识别代码语言并返回带高亮的 TextSpan
  static TextSpan highlight(String code, String language) {
    final lang = language.toLowerCase().trim();
    switch (lang) {
      case 'dart':
        return _highlightDart(code);
      case 'javascript':
      case 'js':
      case 'jsx':
      case 'typescript':
      case 'ts':
      case 'tsx':
        return _highlightJs(code);
      case 'python':
      case 'py':
        return _highlightPython(code);
      case 'json':
        return _highlightJson(code);
      case 'bash':
      case 'sh':
      case 'shell':
      case 'zsh':
        return _highlightBash(code);
      case 'yaml':
      case 'yml':
        return _highlightYaml(code);
      default:
        return TextSpan(text: code, style: _codeStyle);
    }
  }

  // ── 公共样式 ──
  static const TextStyle _codeStyle = TextStyle(
    fontFamily: 'monospace',
    fontSize: 13,
    color: AeroColors.textPrimary,
    height: 1.5,
  );

  static const TextStyle _keywordStyle = TextStyle(
    fontFamily: 'monospace',
    fontSize: 13,
    color: AeroColors.accentPurple,
    fontWeight: FontWeight.w600,
    height: 1.5,
  );

  static const TextStyle _stringStyle = TextStyle(
    fontFamily: 'monospace',
    fontSize: 13,
    color: AeroColors.accentOrange,
    height: 1.5,
  );

  static const TextStyle _numberStyle = TextStyle(
    fontFamily: 'monospace',
    fontSize: 13,
    color: AeroColors.accentGreen,
    height: 1.5,
  );

  static const TextStyle _commentStyle = TextStyle(
    fontFamily: 'monospace',
    fontSize: 13,
    color: AeroColors.textMuted,
    fontStyle: FontStyle.italic,
    height: 1.5,
  );

  static const TextStyle _functionStyle = TextStyle(
    fontFamily: 'monospace',
    fontSize: 13,
    color: AeroColors.accentYellow,
    height: 1.5,
  );

  static const TextStyle _typeStyle = TextStyle(
    fontFamily: 'monospace',
    fontSize: 13,
    color: AeroColors.accentCyan,
    height: 1.5,
  );

  // ── Dart ──
  static TextSpan _highlightDart(String code) {
    final keywords = {
      'abstract', 'as', 'assert', 'async', 'await', 'break', 'case', 'catch',
      'class', 'const', 'continue', 'default', 'deferred', 'do', 'dynamic',
      'else', 'enum', 'export', 'extends', 'extension', 'external', 'factory',
      'false', 'final', 'finally', 'for', 'Function', 'get', 'hide', 'if',
      'implements', 'import', 'in', 'interface', 'is', 'library', 'late',
      'mixin', 'new', 'null', 'on', 'operator', 'part', 'rethrow', 'return',
      'set', 'show', 'static', 'super', 'switch', 'sync', 'this', 'throw',
      'true', 'try', 'typedef', 'var', 'void', 'while', 'with', 'yield',
    };
    return _tokenize(
      code,
      keywords: keywords,
      typePattern: RegExp(r'\b[A-Z][A-Za-z0-9_]*\b'),
      lineComment: '//',
      blockCommentStart: '/*',
      blockCommentEnd: '*/',
    );
  }

  // ── JavaScript / TypeScript ──
  static TextSpan _highlightJs(String code) {
    final keywords = {
      'abstract', 'any', 'as', 'async', 'await', 'break', 'case', 'catch',
      'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
      'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from',
      'function', 'get', 'if', 'implements', 'import', 'in', 'instanceof',
      'interface', 'let', 'new', 'null', 'of', 'private', 'protected', 'public',
      'readonly', 'return', 'set', 'static', 'super', 'switch', 'this', 'throw',
      'true', 'try', 'type', 'typeof', 'undefined', 'var', 'void', 'while',
      'yield', 'number', 'string', 'boolean', 'object',
    };
    return _tokenize(
      code,
      keywords: keywords,
      typePattern: RegExp(r'\b[A-Z][A-Za-z0-9_]*\b'),
      lineComment: '//',
      blockCommentStart: '/*',
      blockCommentEnd: '*/',
    );
  }

  // ── Python ──
  static TextSpan _highlightPython(String code) {
    final keywords = {
      'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
      'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
      'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
      'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
      'self', 'cls',
    };
    return _tokenize(
      code,
      keywords: keywords,
      typePattern: RegExp(r'\b[A-Z][A-Za-z0-9_]*\b'),
      lineComment: '#',
      blockCommentStart: null,
      blockCommentEnd: null,
    );
  }

  // ── JSON ──
  static TextSpan _highlightJson(String code) {
    final spans = <InlineSpan>[];
    final pattern = RegExp(
      r'"(?:\\.|[^"\\])*"' // 字符串
      r'|'
      r'\b(?:true|false|null)\b' // 字面量
      r'|'
      r'-?\d+\.?\d*(?:[eE][+-]?\d+)?' // 数字
      r'|'
      r'[\[\]{}:,]' // 标点
    );
    int cursor = 0;
    for (final match in pattern.allMatches(code)) {
      if (match.start > cursor) {
        spans.add(TextSpan(
            text: code.substring(cursor, match.start), style: _codeStyle));
      }
      final token = match.group(0)!;
      if (token.startsWith('"')) {
        // 判断是 key（后面跟冒号）还是 value
        final after = match.end;
        final nextNonSpace = code.substring(after).trimLeft();
        if (nextNonSpace.startsWith(':')) {
          spans.add(TextSpan(text: token, style: _functionStyle));
        } else {
          spans.add(TextSpan(text: token, style: _stringStyle));
        }
      } else if (token == 'true' || token == 'false' || token == 'null') {
        spans.add(TextSpan(text: token, style: _keywordStyle));
      } else if (RegExp(r'^-?\d').hasMatch(token)) {
        spans.add(TextSpan(text: token, style: _numberStyle));
      } else {
        spans.add(TextSpan(text: token, style: _typeStyle));
      }
      cursor = match.end;
    }
    if (cursor < code.length) {
      spans.add(TextSpan(text: code.substring(cursor), style: _codeStyle));
    }
    return TextSpan(children: spans, style: _codeStyle);
  }

  // ── Bash / Shell ──
  static TextSpan _highlightBash(String code) {
    final keywords = {
      'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case',
      'esac', 'in', 'function', 'return', 'break', 'continue', 'exit', 'local',
      'export', 'unset', 'echo', 'printf', 'read', 'source', 'alias',
    };
    return _tokenize(
      code,
      keywords: keywords,
      typePattern: null,
      lineComment: '#',
      blockCommentStart: null,
      blockCommentEnd: null,
    );
  }

  // ── YAML ──
  static TextSpan _highlightYaml(String code) {
    final spans = <InlineSpan>[];
    for (final line in code.split('\n')) {
      // key: value
      final match = RegExp(r'^(\s*)([A-Za-z_][\w\-]*)(\s*:\s*)(.*)$').firstMatch(line);
      if (match != null) {
        if (spans.isNotEmpty) spans.add(const TextSpan(text: '\n'));
        spans.add(TextSpan(text: match.group(1), style: _codeStyle));
        spans.add(TextSpan(text: match.group(2), style: _functionStyle));
        spans.add(TextSpan(text: match.group(3), style: _codeStyle));
        final value = match.group(4)!;
        if (value.startsWith('#')) {
          spans.add(TextSpan(text: value, style: _commentStyle));
        } else if (value.startsWith('"') || value.startsWith("'")) {
          spans.add(TextSpan(text: value, style: _stringStyle));
        } else if (value == 'true' || value == 'false' || value == 'null') {
          spans.add(TextSpan(text: value, style: _keywordStyle));
        } else {
          spans.add(TextSpan(text: value, style: _stringStyle));
        }
      } else if (line.trimLeft().startsWith('#')) {
        if (spans.isNotEmpty) spans.add(const TextSpan(text: '\n'));
        spans.add(TextSpan(text: line, style: _commentStyle));
      } else {
        if (spans.isNotEmpty) spans.add(const TextSpan(text: '\n'));
        spans.add(TextSpan(text: line, style: _codeStyle));
      }
    }
    return TextSpan(children: spans, style: _codeStyle);
  }

  // ── 通用分词器 ──
  static TextSpan _tokenize(
    String code, {
    required Set<String> keywords,
    RegExp? typePattern,
    String? lineComment,
    String? blockCommentStart,
    String? blockCommentEnd,
  }) {
    final spans = <InlineSpan>[];
    int i = 0;

    while (i < code.length) {
      // 行注释
      if (lineComment != null && code.startsWith(lineComment, i)) {
        final end = code.indexOf('\n', i);
        final stop = end == -1 ? code.length : end;
        spans.add(TextSpan(
          text: code.substring(i, stop),
          style: _commentStyle,
        ));
        i = stop;
        continue;
      }
      // 块注释
      if (blockCommentStart != null && blockCommentEnd != null &&
          code.startsWith(blockCommentStart, i)) {
        final end = code.indexOf(blockCommentEnd, i + blockCommentStart.length);
        final stop = end == -1 ? code.length : end + blockCommentEnd.length;
        spans.add(TextSpan(
          text: code.substring(i, stop),
          style: _commentStyle,
        ));
        i = stop;
        continue;
      }
      // 字符串
      if (code[i] == '"' || code[i] == "'") {
        final quote = code[i];
        int j = i + 1;
        while (j < code.length && code[j] != quote) {
          if (code[j] == '\\' && j + 1 < code.length) {
            j += 2;
          } else {
            j++;
          }
        }
        spans.add(TextSpan(
          text: code.substring(i, j + 1),
          style: _stringStyle,
        ));
        i = j + 1;
        continue;
      }
      // 数字
      if (RegExp(r'\d').hasMatch(code[i])) {
        int j = i;
        while (j < code.length && RegExp(r'[\d.eE+\-xXa-fA-F]').hasMatch(code[j])) {
          j++;
        }
        spans.add(TextSpan(
          text: code.substring(i, j),
          style: _numberStyle,
        ));
        i = j;
        continue;
      }
      // 标识符
      if (RegExp(r'[A-Za-z_$]').hasMatch(code[i])) {
        int j = i;
        while (j < code.length && RegExp(r'[A-Za-z0-9_$]').hasMatch(code[j])) {
          j++;
        }
        final word = code.substring(i, j);
        if (keywords.contains(word)) {
          spans.add(TextSpan(text: word, style: _keywordStyle));
        } else if (typePattern != null && typePattern.hasMatch(word)) {
          spans.add(TextSpan(text: word, style: _typeStyle));
        } else if (j < code.length && code[j] == '(') {
          spans.add(TextSpan(text: word, style: _functionStyle));
        } else {
          spans.add(TextSpan(text: word, style: _codeStyle));
        }
        i = j;
        continue;
      }
      // 其他字符
      spans.add(TextSpan(text: code[i], style: _codeStyle));
      i++;
    }
    return TextSpan(children: spans, style: _codeStyle);
  }
}

enum _MdTokenType {
  heading,
  wikiLink,
  tag,
  task,
  code,
  bold,
  italic,
  link,
  quote,
  listBullet,
  listNumber,
}

class _MdPattern {
  final RegExp regex;
  final _MdTokenType type;

  _MdPattern({required this.regex, required this.type});
}

/// Markdown 源码编辑器语法高亮控制器
///
/// 重写 [buildTextSpan] 方法，在 TextField 中实时应用 Markdown 语法高亮
class MarkdownHighlightController extends TextEditingController {
  MarkdownHighlightController({super.text});

  String _searchQuery = '';
  List<TextRange> _searchMatches = [];
  int _currentMatchIndex = -1;
  bool _caseSensitive = false;

  String get searchQuery => _searchQuery;
  List<TextRange> get searchMatches => List.unmodifiable(_searchMatches);
  int get currentMatchIndex => _currentMatchIndex;
  bool get caseSensitive => _caseSensitive;

  void updateSearch(String query, {bool caseSensitive = false}) {
    _searchQuery = query;
    _caseSensitive = caseSensitive;
    _updateMatches();
    notifyListeners();
  }

  void clearSearch() {
    _searchQuery = '';
    _searchMatches = [];
    _currentMatchIndex = -1;
    notifyListeners();
  }

  void setCurrentMatchIndex(int index) {
    if (_searchMatches.isEmpty) {
      _currentMatchIndex = -1;
    } else {
      _currentMatchIndex = index.clamp(0, _searchMatches.length - 1);
    }
    notifyListeners();
  }

  void _updateMatches() {
    _searchMatches = [];
    _currentMatchIndex = -1;
    if (_searchQuery.isEmpty) return;

    final content = text;
    final query = _caseSensitive ? _searchQuery : _searchQuery.toLowerCase();
    final lowerContent = _caseSensitive ? content : content.toLowerCase();

    int start = 0;
    while (true) {
      final index = lowerContent.indexOf(query, start);
      if (index == -1) break;
      _searchMatches.add(TextRange(start: index, end: index + query.length));
      start = index + query.length;
    }

    if (_searchMatches.isNotEmpty) {
      _currentMatchIndex = 0;
    }
  }

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    final baseStyle = style ?? const TextStyle(fontSize: 14, height: 1.7);

    TextSpan highlighted;
    if (!withComposing || value.composing.isCollapsed) {
      highlighted = SyntaxHighlighter.highlightMarkdown(text, baseStyle: baseStyle);
    } else {
      final composingRegion = value.composing;
      final beforeComposing = text.substring(0, composingRegion.start);
      final composingText = text.substring(composingRegion.start, composingRegion.end);
      final afterComposing = text.substring(composingRegion.end);

      highlighted = TextSpan(
        style: baseStyle,
        children: [
          if (beforeComposing.isNotEmpty)
            SyntaxHighlighter.highlightMarkdown(beforeComposing, baseStyle: baseStyle),
          TextSpan(
            text: composingText,
            style: baseStyle.copyWith(
              decoration: TextDecoration.underline,
              decorationColor: baseStyle.color?.withValues(alpha: 0.5),
            ),
          ),
          if (afterComposing.isNotEmpty)
            SyntaxHighlighter.highlightMarkdown(afterComposing, baseStyle: baseStyle),
        ],
      );
    }

    if (_searchQuery.isEmpty || _searchMatches.isEmpty) {
      return highlighted;
    }

    return _applySearchHighlight(highlighted, baseStyle);
  }

  TextSpan _applySearchHighlight(TextSpan span, TextStyle baseStyle) {
    final children = <InlineSpan>[];
    int currentOffset = 0;
    int matchIndex = 0;

    void processText(String text, TextStyle? style) {
      if (text.isEmpty) return;

      int textStart = currentOffset;
      final textEnd = currentOffset + text.length;

      while (matchIndex < _searchMatches.length) {
        final match = _searchMatches[matchIndex];
        if (match.start >= textEnd) break;
        if (match.end <= textStart) {
          matchIndex++;
          continue;
        }

        final relStart = (match.start - textStart).clamp(0, text.length);
        final relEnd = (match.end - textStart).clamp(0, text.length);

        if (relStart > 0) {
          children.add(TextSpan(text: text.substring(0, relStart), style: style));
        }

        final isCurrent = matchIndex == _currentMatchIndex;
        final bgColor = isCurrent
            ? AeroColors.accentOrange.withValues(alpha: 0.4)
            : AeroColors.accentYellow.withValues(alpha: 0.25);

        children.add(TextSpan(
          text: text.substring(relStart, relEnd),
          style: (style ?? baseStyle).copyWith(
            backgroundColor: bgColor,
          ),
        ));

        text = text.substring(relEnd);
        textStart += relEnd;
        matchIndex++;
      }

      if (text.isNotEmpty) {
        children.add(TextSpan(text: text, style: style));
      }

      currentOffset = textEnd;
    }

    void traverse(InlineSpan span) {
      if (span is TextSpan) {
        if (span.text != null) {
          processText(span.text!, span.style);
        }
        if (span.children != null) {
          for (final child in span.children!) {
            traverse(child);
          }
        }
      } else {
        children.add(span);
      }
    }

    traverse(span);

    return TextSpan(style: baseStyle, children: children);
  }
}
