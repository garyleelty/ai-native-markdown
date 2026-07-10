/// ══════════════════════════════════════════════════
/// SyntaxHighlighter — 轻量级代码语法高亮
/// ══════════════════════════════════════════════════
/// 基于正则的简易语法高亮器，支持常见语言：
///   - Dart / JavaScript / TypeScript / Python / JSON / Bash
///   - 未识别语言退化为纯文本（无高亮）
///
/// 输出为 TextSpan 树，可直接用于 RichText / Text.rich。
/// ──────────────────────────────────────────────────
library;

import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';

class SyntaxHighlighter {
  SyntaxHighlighter._();

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
