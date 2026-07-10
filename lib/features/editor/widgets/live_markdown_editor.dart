import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/settings_provider.dart';
import '../services/syntax_highlighter.dart';

/// Live Preview 编辑器 — Obsidian 风格所见即所得
///
/// 核心机制：
///   - 非光标行渲染为富文本（隐藏 Markdown 语法）
///   - 光标所在行显示原始 Markdown，可编辑
///   - 点击任一行自动切换到编辑模式
class LiveMarkdownEditor extends ConsumerStatefulWidget {
  final TextEditingController controller;
  final ScrollController? scrollController;

  const LiveMarkdownEditor({
    super.key,
    required this.controller,
    this.scrollController,
  });

  @override
  ConsumerState<LiveMarkdownEditor> createState() => _LiveMarkdownEditorState();
}

class _LiveMarkdownEditorState extends ConsumerState<LiveMarkdownEditor> {
  late final ScrollController _scrollController;

  int _cursorLine = 0;
  final List<TextEditingController> _lineControllers = [];
  final List<FocusNode> _lineFocusNodes = [];
  bool _updatingFromLines = false;
  bool _updatingFromController = false;

  double get _fontSize => ref.watch(settingsProvider.select((s) => s.fontSize));

  @override
  void initState() {
    super.initState();
    _scrollController = widget.scrollController ?? ScrollController();
    _rebuildLineControllers();
    widget.controller.addListener(_onControllerChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChanged);
    if (widget.scrollController == null) _scrollController.dispose();
    for (final fn in _lineFocusNodes) {
      fn.dispose();
    }
    for (final lc in _lineControllers) {
      lc.dispose();
    }
    super.dispose();
  }

  List<String> get _lines => widget.controller.text.split('\n');

  void _onControllerChanged() {
    if (_updatingFromLines) return;
    _updatingFromController = true;
    final lines = _lines;
    if (lines.length != _lineControllers.length) {
      _rebuildLineControllers();
    } else {
      for (int i = 0; i < lines.length; i++) {
        if (lines[i] != _lineControllers[i].text) {
          _lineControllers[i].text = lines[i];
        }
      }
    }
    _updatingFromController = false;
    if (mounted) setState(() {});
  }

  void _rebuildLineControllers() {
    final lines = _lines;
    for (final fn in _lineFocusNodes) {
      fn.dispose();
    }
    for (final lc in _lineControllers) {
      lc.dispose();
    }
    _lineFocusNodes.clear();
    _lineControllers.clear();
    for (int i = 0; i < lines.length; i++) {
      _lineControllers.add(TextEditingController(text: lines[i]));
      _lineFocusNodes.add(FocusNode());
    }
    if (_cursorLine >= lines.length) {
      _cursorLine = lines.length - 1;
    }
    if (_cursorLine < 0) _cursorLine = 0;
  }

  void _syncToController() {
    if (_updatingFromController) return;
    _updatingFromLines = true;
    final text = List.generate(
      _lineControllers.length,
      (i) => _lineControllers[i].text,
    ).join('\n');
    widget.controller.text = text;
    _updatingFromLines = false;
  }

  void _focusLine(int lineIndex, {int? offset}) {
    setState(() {
      _cursorLine = lineIndex;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (lineIndex < _lineFocusNodes.length) {
        _lineFocusNodes[lineIndex].requestFocus();
        if (offset != null) {
          final safeOffset = offset.clamp(
            0,
            _lineControllers[lineIndex].text.length,
          );
          _lineControllers[lineIndex].selection = TextSelection.collapsed(
            offset: safeOffset,
          );
        }
      }
    });
  }

  bool _handleLineKeyEvent(int lineIndex, KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final ctrl = _lineControllers[lineIndex];
    final selection = ctrl.selection;

    // Enter: 换行
    if (event.logicalKey == LogicalKeyboardKey.enter) {
      if (HardwareKeyboard.instance.isShiftPressed) return false;

      final beforeCursor = ctrl.text.substring(0, selection.baseOffset);
      final afterCursor = ctrl.text.substring(selection.extentOffset);

      var newLinePrefix = '';

      // 任务列表延续 (优先级最高)
      final taskMatch = RegExp(r'^(\s*)([-*+])\s\[([ xX])\]\s').firstMatch(beforeCursor);
      if (taskMatch != null) {
        final indent = taskMatch.group(1)!;
        final marker = taskMatch.group(2)!;
        newLinePrefix = '$indent$marker [ ] ';
        // 空任务项：移除标记
        if (beforeCursor.trim().replaceAll(RegExp(r'\[[ xX]\]'), '').trim() == marker &&
            afterCursor.isEmpty) {
          ctrl.text = '';
          _syncToController();
          return true;
        }
      }
      // 普通列表延续
      else if (RegExp(r'^(\s*)([-*+]|\d+\.)\s').hasMatch(beforeCursor)) {
        final listMatch = RegExp(r'^(\s*)([-*+]|\d+\.)\s').firstMatch(beforeCursor)!;
        final indent = listMatch.group(1)!;
        final marker = listMatch.group(2)!;
        if (RegExp(r'^\d+\.$').hasMatch(marker)) {
          final num = int.parse(marker.replaceAll('.', '')) + 1;
          newLinePrefix = '$indent$num. ';
        } else {
          newLinePrefix = '$indent$marker ';
        }
        // 空列表项：移除标记
        if (beforeCursor.trim() == marker && afterCursor.isEmpty) {
          ctrl.text = '';
          _syncToController();
          return true;
        }
      }
      // 引用延续
      else if (RegExp(r'^(\s*)>\s?').hasMatch(beforeCursor)) {
        final quoteMatch = RegExp(r'^(\s*)>\s?').firstMatch(beforeCursor)!;
        final indent = quoteMatch.group(1)!;
        newLinePrefix = '$indent> ';
        // 空引用：移除标记
        if (beforeCursor.trim() == '>' && afterCursor.isEmpty) {
          ctrl.text = '';
          _syncToController();
          return true;
        }
      }

      // 分割成两行
      ctrl.text = beforeCursor;
      final newLineText = newLinePrefix + afterCursor;

      _lineControllers.insert(
        lineIndex + 1,
        TextEditingController(text: newLineText),
      );
      _lineFocusNodes.insert(lineIndex + 1, FocusNode());

      setState(() {
        _cursorLine = lineIndex + 1;
      });

      _syncToController();

      WidgetsBinding.instance.addPostFrameCallback((_) {
        _lineFocusNodes[lineIndex + 1].requestFocus();
        _lineControllers[lineIndex + 1].selection = TextSelection.collapsed(
          offset: newLinePrefix.length,
        );
      });
      return true;
    }

    // Backspace at start: 合并到上一行
    if (event.logicalKey == LogicalKeyboardKey.backspace &&
        selection.baseOffset == 0 &&
        selection.extentOffset == 0) {
      if (lineIndex == 0) return false;

      final prevLine = _lineControllers[lineIndex - 1].text;
      final currentLine = _lineControllers[lineIndex].text;
      final newText = prevLine + currentLine;
      final caretPos = prevLine.length;

      _lineControllers[lineIndex - 1].text = newText;
      _lineControllers[lineIndex].dispose();
      _lineFocusNodes[lineIndex].dispose();
      _lineControllers.removeAt(lineIndex);
      _lineFocusNodes.removeAt(lineIndex);

      setState(() {
        _cursorLine = lineIndex - 1;
      });

      _syncToController();

      WidgetsBinding.instance.addPostFrameCallback((_) {
        _lineFocusNodes[lineIndex - 1].requestFocus();
        _lineControllers[lineIndex - 1].selection = TextSelection.collapsed(
          offset: caretPos,
        );
      });
      return true;
    }

    // Arrow Up
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      if (lineIndex > 0) {
        final off = selection.baseOffset;
        _focusLine(lineIndex - 1, offset: off);
        return true;
      }
      return false;
    }

    // Arrow Down
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      if (lineIndex < _lineControllers.length - 1) {
        final off = selection.baseOffset;
        _focusLine(lineIndex + 1, offset: off);
        return true;
      }
      return false;
    }

    // Arrow Left at start → 上一行末尾
    if (event.logicalKey == LogicalKeyboardKey.arrowLeft &&
        selection.isCollapsed &&
        selection.baseOffset == 0) {
      if (lineIndex > 0) {
        final prevLen = _lineControllers[lineIndex - 1].text.length;
        _focusLine(lineIndex - 1, offset: prevLen);
        return true;
      }
      return false;
    }

    // Arrow Right at end → 下一行开头
    if (event.logicalKey == LogicalKeyboardKey.arrowRight &&
        selection.isCollapsed &&
        selection.baseOffset == ctrl.text.length) {
      if (lineIndex < _lineControllers.length - 1) {
        _focusLine(lineIndex + 1, offset: 0);
        return true;
      }
      return false;
    }

    return false;
  }

  @override
  Widget build(BuildContext context) {
    final lineCount = _lineControllers.length;

    // 预扫描：构建每行所在的代码块信息
    // key = lineIndex, value = (语言 or null) ; 不在代码块中的行不在 map 中
    final codeBlockLang = <int, String?>{};
    final codeBlockStart = <int, int>{}; // 行 → 起始行
    bool inBlock = false;
    String? lang;
    int blockStartLine = -1;
    for (int i = 0; i < lineCount; i++) {
      final text = _lineControllers[i].text;
      final trimmed = text.trimLeft();
      if (trimmed.startsWith('```')) {
        if (!inBlock) {
          // 进入代码块
          inBlock = true;
          lang = trimmed.substring(3).trim();
          if (lang.isEmpty) lang = null;
          blockStartLine = i;
          codeBlockLang[i] = lang;
          codeBlockStart[i] = blockStartLine;
        } else {
          // 退出代码块
          inBlock = false;
          codeBlockLang[i] = lang;
          codeBlockStart[i] = blockStartLine;
          lang = null;
        }
      } else if (inBlock) {
        codeBlockLang[i] = lang;
        codeBlockStart[i] = blockStartLine;
      }
    }

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () {
        if (_lineControllers.isNotEmpty) {
          _focusLine(_cursorLine);
        }
      },
      child: SingleChildScrollView(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: List.generate(lineCount, (index) {
            return _buildLine(
              index,
              _lineControllers[index].text,
              codeBlockLang[index],
              codeBlockStart[index],
            );
          }),
        ),
      ),
    );
  }

  Widget _buildLine(
    int lineIndex,
    String lineText, [
    String? codeLang,
    int? codeBlockStartLine,
  ]) {
    final isEditing = lineIndex == _cursorLine;
    final inCodeBlock = codeLang != null || codeBlockStartLine != null;
    final isCodeFence = lineText.trimLeft().startsWith('```');

    // 在代码块中（非起始/结束围栏行）应用语法高亮
    if (inCodeBlock && !isCodeFence && !isEditing) {
      return GestureDetector(
        onTap: () => _focusLine(lineIndex),
        child: MouseRegion(
          cursor: SystemMouseCursors.text,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 0),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
              color: AeroColors.bgDeep,
              child: RichText(
                text: SyntaxHighlighter.highlight(
                  lineText,
                  codeLang ?? '',
                ),
              ),
            ),
          ),
        ),
      );
    }
    // 代码块围栏行（```）显示为语言标签
    if (isCodeFence && !isEditing) {
      final lang = lineText.trimLeft().substring(3).trim();
      return GestureDetector(
        onTap: () => _focusLine(lineIndex),
        child: MouseRegion(
          cursor: SystemMouseCursors.text,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            color: AeroColors.bgDeep,
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: AeroColors.accentCyan.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    lang.isEmpty ? 'code' : lang,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AeroColors.accentCyan,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (isEditing) {
      return Focus(
        focusNode: _lineFocusNodes[lineIndex],
        onKeyEvent: (node, event) {
          final handled = _handleLineKeyEvent(lineIndex, event);
          return handled ? KeyEventResult.handled : KeyEventResult.ignored;
        },
        child: TextField(
          controller: _lineControllers[lineIndex],
          focusNode: _lineFocusNodes[lineIndex],
          maxLines: null,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontSize: _fontSize,
                fontFamily: inCodeBlock ? 'monospace' : null,
              ),
          decoration: const InputDecoration(
            border: InputBorder.none,
            contentPadding: EdgeInsets.symmetric(vertical: 2),
            isDense: true,
          ),
          onChanged: (value) {
            _syncToController();
          },
        ),
      );
    } else {
      return GestureDetector(
        onTap: () => _focusLine(lineIndex),
        child: MouseRegion(
          cursor: SystemMouseCursors.text,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: _buildRenderedLine(lineText),
          ),
        ),
      );
    }
  }

  Widget _buildRenderedLine(String line) {
    final blockType = _detectBlockType(line);

    switch (blockType) {
      case _BlockType.heading1:
      case _BlockType.heading2:
      case _BlockType.heading3:
      case _BlockType.heading4:
      case _BlockType.heading5:
      case _BlockType.heading6:
        return _buildHeading(line, blockType);
      case _BlockType.bulletList:
        return _buildBulletList(line);
      case _BlockType.numberedList:
        return _buildNumberedList(line);
      case _BlockType.taskList:
        return _buildTaskList(line);
      case _BlockType.quote:
        return _buildQuote(line);
      case _BlockType.horizontalRule:
        return _buildHorizontalRule();
      case _BlockType.codeBlock:
        return _buildCodeLine(line);
      case _BlockType.paragraph:
        return _buildParagraph(line);
    }
  }

  _BlockType _detectBlockType(String line) {
    final trimmed = line.trimLeft();
    if (trimmed.isEmpty) return _BlockType.paragraph;
    if (RegExp(r'^#{1,6}\s').hasMatch(trimmed)) {
      final level = trimmed.indexOf(' ');
      return _BlockType.values[level.clamp(0, 5)];
    }
    if (RegExp(r'^[-*+]\s').hasMatch(trimmed)) {
      if (RegExp(r'^[-*+]\s\[([ xX])\]\s').hasMatch(trimmed)) {
        return _BlockType.taskList;
      }
      return _BlockType.bulletList;
    }
    if (RegExp(r'^\d+\.\s').hasMatch(trimmed)) {
      return _BlockType.numberedList;
    }
    if (trimmed.startsWith('>')) {
      return _BlockType.quote;
    }
    if (RegExp(r'^-{3,}|^\*{3,}|^_{3,}').hasMatch(trimmed)) {
      return _BlockType.horizontalRule;
    }
    if (trimmed.startsWith('```')) {
      return _BlockType.codeBlock;
    }
    return _BlockType.paragraph;
  }

  Widget _buildHeading(String line, _BlockType type) {
    final level = type.index + 1;
    final text = line.replaceFirst(RegExp(r'^#{1,6}\s'), '');

    final fontSizes = [24.0, 20.0, 18.0, 16.0, 15.0, 14.0];
    final fontSize = fontSizes[(level - 1).clamp(0, 5)];

    return Padding(
      padding: EdgeInsets.only(top: level <= 2 ? 12 : 8, bottom: 4),
      child: Text.rich(
        _parseInlineMarkdown(text,
            baseStyle: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              color: AeroColors.textPrimary,
            )),
        style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _buildBulletList(String line) {
    final indent = line.indexOf(RegExp(r'[-*+]'));
    final text = line.replaceFirst(RegExp(r'^\s*[-*+]\s'), '');
    final indentPadding = indent * 16.0;

    return Padding(
      padding: EdgeInsets.only(left: indentPadding, top: 2, bottom: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(width: 8),
          const Text('•',
              style: TextStyle(
                fontSize: 14,
                color: AeroColors.textSecondary,
              )),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(_parseInlineMarkdown(text)),
          ),
        ],
      ),
    );
  }

  Widget _buildNumberedList(String line) {
    final indent = line.indexOf(RegExp(r'\d'));
    final match = RegExp(r'^(\s*)(\d+\.)\s').firstMatch(line);
    final number = match?.group(2) ?? '1.';
    final text = line.replaceFirst(RegExp(r'^\s*\d+\.\s'), '');
    final indentPadding = indent * 16.0;

    return Padding(
      padding: EdgeInsets.only(left: indentPadding, top: 2, bottom: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(number,
              style: const TextStyle(
                fontSize: 14,
                color: AeroColors.textSecondary,
              )),
          const SizedBox(width: 6),
          Expanded(
            child: Text.rich(_parseInlineMarkdown(text)),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskList(String line) {
    final match = RegExp(r'^(\s*)[-*+]\s\[([ xX])\]\s').firstMatch(line);
    final indent = match?.group(1)?.length ?? 0;
    final isChecked = match?.group(2)?.toLowerCase() == 'x';
    final text = line.replaceFirst(RegExp(r'^\s*[-*+]\s\[([ xX])\]\s'), '');
    final indentPadding = indent * 16.0;

    return Padding(
      padding: EdgeInsets.only(left: indentPadding, top: 2, bottom: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isChecked ? Icons.check_box : Icons.check_box_outline_blank,
            size: 16,
            color: isChecked ? AeroColors.accentGreen : AeroColors.textMuted,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text.rich(
              _parseInlineMarkdown(
                text,
                baseStyle: TextStyle(
                  decoration: isChecked ? TextDecoration.lineThrough : null,
                  color: isChecked ? AeroColors.textMuted : AeroColors.textPrimary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuote(String line) {
    final text = line.replaceFirst(RegExp(r'^>\s?'), '');

    return Container(
      padding: const EdgeInsets.only(left: 12, top: 4, bottom: 4),
      decoration: const BoxDecoration(
        border: Border(
          left: BorderSide(color: AeroColors.accentPurple, width: 3),
        ),
      ),
      margin: const EdgeInsets.symmetric(vertical: 2),
      child: Text.rich(
        _parseInlineMarkdown(
          text,
          baseStyle: const TextStyle(
            fontStyle: FontStyle.italic,
            color: AeroColors.textSecondary,
          ),
        ),
        style: const TextStyle(
          fontStyle: FontStyle.italic,
          color: AeroColors.textSecondary,
        ),
      ),
    );
  }

  Widget _buildHorizontalRule() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 12),
      height: 1,
      color: AeroColors.border,
    );
  }

  Widget _buildCodeLine(String line) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AeroColors.bgDeep,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        line,
        style: const TextStyle(
          fontFamily: 'monospace',
          fontSize: 13,
          color: AeroColors.textSecondary,
        ),
      ),
    );
  }

  Widget _buildParagraph(String line) {
    if (line.isEmpty) {
      return const SizedBox(height: 12);
    }
    return Text.rich(_parseInlineMarkdown(line));
  }

  TextSpan _parseInlineMarkdown(String text, {TextStyle? baseStyle}) {
    final defaultStyle = baseStyle ??
        TextStyle(
          fontSize: _fontSize,
          height: 1.6,
          color: AeroColors.textPrimary,
        );

    if (text.isEmpty) {
      return TextSpan(style: defaultStyle, text: '');
    }

    // 安全网：解析过程中任何异常都降级为纯文本，避免渲染崩溃
    try {
      return _parseInlineMarkdownImpl(text, defaultStyle);
    } catch (_) {
      return TextSpan(style: defaultStyle, text: text);
    }
  }

  TextSpan _parseInlineMarkdownImpl(String text, TextStyle defaultStyle) {
    final spans = <InlineSpan>[];
    int cursor = 0;

    final patterns = <_InlinePattern>[
      _InlinePattern(regex: RegExp(r'`([^`]+)`'), type: _InlineType.code),
      _InlinePattern(regex: RegExp(r'\*\*\*([^*]+)\*\*\*'), type: _InlineType.boldItalic),
      _InlinePattern(regex: RegExp(r'\*\*([^*]+)\*\*'), type: _InlineType.bold),
      _InlinePattern(regex: RegExp(r'__([^_]+)__'), type: _InlineType.bold),
      _InlinePattern(regex: RegExp(r'\*([^*]+)\*'), type: _InlineType.italic),
      _InlinePattern(regex: RegExp(r'~~([^~]+)~~'), type: _InlineType.strikethrough),
      _InlinePattern(regex: RegExp(r'\[\[([^\]]+)\]\]'), type: _InlineType.wikiLink),
      _InlinePattern(regex: RegExp(r'#(\w+)'), type: _InlineType.tag),
      _InlinePattern(regex: RegExp(r'\[([^\]]+)\]\(([^)]+)\)'), type: _InlineType.link),
    ];

    while (cursor < text.length) {
      int earliestStart = text.length;
      _InlinePattern? earliestPattern;
      RegExpMatch? earliestMatch;

      for (final pattern in patterns) {
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
        spans.add(TextSpan(text: text.substring(cursor)));
        break;
      }

      if (earliestStart > cursor) {
        spans.add(TextSpan(text: text.substring(cursor, earliestStart)));
      }

      final content = earliestMatch.group(1) ?? '';

      switch (earliestPattern.type) {
        case _InlineType.bold:
          spans.add(TextSpan(
            text: content,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ));
          break;
        case _InlineType.italic:
          spans.add(TextSpan(
            text: content,
            style: const TextStyle(fontStyle: FontStyle.italic),
          ));
          break;
        case _InlineType.boldItalic:
          spans.add(TextSpan(
            text: content,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontStyle: FontStyle.italic,
            ),
          ));
          break;
        case _InlineType.strikethrough:
          spans.add(TextSpan(
            text: content,
            style: const TextStyle(decoration: TextDecoration.lineThrough),
          ));
          break;
        case _InlineType.code:
          // 使用 TextSpan 而非 WidgetSpan，避免 Flutter Web 在渲染
          // 含中文等非 ASCII 文本时的 "Invalid array length" 崩溃
          spans.add(TextSpan(
            text: content,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 13,
              color: AeroColors.accentOrange,
              backgroundColor: AeroColors.bgDeep,
            ),
          ));
          break;
        case _InlineType.wikiLink:
          spans.add(TextSpan(
            text: content,
            style: TextStyle(
              color: AeroColors.accentGreen,
              decoration: TextDecoration.underline,
              decorationColor: AeroColors.accentGreen.withValues(alpha: 0.3),
            ),
          ));
          break;
        case _InlineType.tag:
          spans.add(TextSpan(
            text: '#$content',
            style: const TextStyle(
              color: AeroColors.accentBlue,
            ),
          ));
          break;
        case _InlineType.link:
          spans.add(TextSpan(
            text: content,
            style: const TextStyle(
              color: AeroColors.accentBlue,
              decoration: TextDecoration.underline,
            ),
          ));
          break;
      }

      cursor = earliestStart + earliestMatch.group(0)!.length;
    }

    return TextSpan(
      style: defaultStyle,
      children: spans.isEmpty ? [TextSpan(text: text)] : spans,
    );
  }
}

enum _BlockType {
  heading1,
  heading2,
  heading3,
  heading4,
  heading5,
  heading6,
  bulletList,
  numberedList,
  taskList,
  quote,
  horizontalRule,
  codeBlock,
  paragraph,
}

enum _InlineType {
  bold,
  italic,
  boldItalic,
  strikethrough,
  code,
  wikiLink,
  tag,
  link,
}

class _InlinePattern {
  final RegExp regex;
  final _InlineType type;

  _InlinePattern({
    required Object regex,
    required this.type,
  }) : regex = regex is RegExp ? regex : RegExp(regex as String);
}
