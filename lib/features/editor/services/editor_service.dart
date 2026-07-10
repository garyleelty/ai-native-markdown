/// ══════════════════════════════════════════════════
/// EditorService — 编辑器核心服务
/// ══════════════════════════════════════════════════
/// 提供编辑器层的业务逻辑:
///   - 自动保存 (debounce)
///   - 字数统计
///   - 内容格式化
///   - Markdown 快捷操作
/// ──────────────────────────────────────────────────
library;

import 'dart:async';

/// 编辑器统计信息
class EditorStats {
  /// 总字符数
  final int charCount;

  /// 总字数 (中文按字计算，英文按词计算)
  final int wordCount;

  /// 总行数
  final int lineCount;

  /// 段落数
  final int paragraphCount;

  /// 预估阅读时间 (分钟)
  final int readingTimeMinutes;

  const EditorStats({
    required this.charCount,
    required this.wordCount,
    required this.lineCount,
    required this.paragraphCount,
    required this.readingTimeMinutes,
  });

  @override
  String toString() =>
      '$wordCount 字 · $lineCount 行 · $readingTimeMinutes分钟阅读';
}

/// 编辑器服务
class EditorService {
  /// 计算文本统计信息
  ///
  /// 中文字符每个算一个词，英文按空格分词。
  static EditorStats computeStats(String markdown) {
    // 移除 Markdown 语法标记 (粗略统计)
    final plainText = _stripMarkdown(markdown);

    final charCount = plainText.length;
    final wordCount = _countWords(plainText);
    final lineCount = markdown.split('\n').length;
    final paragraphCount =
        markdown.split(RegExp(r'\n\s*\n')).where((p) => p.trim().isNotEmpty).length;

    // 中文平均阅读速度 ~400 字/分钟，英文 ~200 词/分钟
    final hasChinese = RegExp(r'[\u4e00-\u9fff]').hasMatch(plainText);
    final wordsPerMinute = hasChinese ? 400 : 200;
    final readingTimeMinutes = (wordCount / wordsPerMinute).ceil().clamp(1, 999);

    return EditorStats(
      charCount: charCount,
      wordCount: wordCount,
      lineCount: lineCount,
      paragraphCount: paragraphCount,
      readingTimeMinutes: readingTimeMinutes,
    );
  }

  /// 中英文混合分词计数
  static int _countWords(String text) {
    int count = 0;
    // 中文字符: 每个算一个词
    final chineseChars = RegExp(r'[\u4e00-\u9fff]');
    count += chineseChars.allMatches(text).length;

    // 英文/数字: 按空格分词
    final withoutChinese = text.replaceAll(chineseChars, ' ');
    final englishWords =
        withoutChinese.split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
    count += englishWords.length;

    return count;
  }

  /// 粗略移除 Markdown 语法
  static String _stripMarkdown(String md) {
    return md
        .replaceAll(RegExp(r'^#{1,6}\s+', multiLine: true), '') // 标题
        .replaceAll(RegExp(r'\*\*(.+?)\*\*'), r'$1') // 粗体
        .replaceAll(RegExp(r'\*(.+?)\*'), r'$1') // 斜体
        .replaceAll(RegExp(r'`(.+?)`'), r'$1') // 行内代码
        .replaceAll(RegExp(r'```[\s\S]*?```'), '') // 代码块
        .replaceAll(RegExp(r'\[(.+?)\]\(.+?\)'), r'$1') // 链接
        .replaceAll(RegExp(r'\[\[(.+?)\]\]'), r'$1') // wiki链接
        .replaceAll(RegExp(r'^>\s+', multiLine: true), '') // 引文
        .replaceAll(RegExp(r'^[-*]\s+', multiLine: true), '') // 列表
        .replaceAll(RegExp(r'^\d+\.\s+', multiLine: true), '') // 有序列表
        .replaceAll(RegExp(r'!\[.*?\]\(.+?\)'), '') // 图片
        .replaceAll(RegExp(r'---+'), '') // 水平线
        .trim();
  }

  // ── Markdown 快捷操作 ──

  /// 在选中文本两侧添加标记
  static String wrapSelection(String text, String marker) {
    return '$marker$text$marker';
  }

  /// 将文本转为粗体
  static String bold(String text) => '**$text**';

  /// 将文本转为斜体
  static String italic(String text) => '*$text*';

  /// 将文本转为行内代码
  static String inlineCode(String text) => '`$text`';

  /// 将文本转为代码块
  static String codeBlock(String text, {String language = ''}) {
    return '```$language\n$text\n```';
  }

  /// 将文本转为 wiki 链接
  static String wikiLink(String text) => '[[$text]]';

  /// 将文本转为外部链接
  static String externalLink(String text, String url) => '[$text]($url)';

  /// 将文本转为引用
  static String blockquote(String text) {
    return text.split('\n').map((line) => '> $line').join('\n');
  }

  /// 将文本转为任务列表项
  static String taskItem(String text, {bool checked = false}) {
    return '- [${checked ? 'x' : ' '}] $text';
  }

  /// 将文本转为标题
  static String heading(String text, {int level = 1}) {
    assert(level >= 1 && level <= 6);
    return '${'#' * level} $text';
  }

  /// 插入水平分割线
  static String get horizontalRule => '\n---\n';

  // ── 内容转换 ──

  /// 提取 Markdown 中的所有标题
  static List<HeadingInfo> extractHeadings(String markdown) {
    final headings = <HeadingInfo>[];
    final pattern = RegExp(r'^(#{1,6})\s+(.+)$', multiLine: true);

    for (final match in pattern.allMatches(markdown)) {
      final level = match.group(1)!.length;
      final title = match.group(2)!.trim();
      headings.add(HeadingInfo(
        level: level,
        title: title,
        offset: match.start,
      ));
    }

    return headings;
  }

  /// 提取 Markdown 中的所有链接 (包括 wiki 链接)
  static List<LinkInfo> extractLinks(String markdown) {
    final links = <LinkInfo>[];

    // Wiki 链接 [[title]]
    final wikiPattern = RegExp(r'\[\[([^\]]+)\]\]');
    for (final match in wikiPattern.allMatches(markdown)) {
      links.add(LinkInfo(
        text: match.group(1)!,
        url: '',
        isWikiLink: true,
        offset: match.start,
      ));
    }

    // 标准链接 [text](url)
    final linkPattern = RegExp(r'\[([^\]]+)\]\(([^)]+)\)');
    for (final match in linkPattern.allMatches(markdown)) {
      links.add(LinkInfo(
        text: match.group(1)!,
        url: match.group(2)!,
        isWikiLink: false,
        offset: match.start,
      ));
    }

    return links;
  }
}

/// 标题信息
class HeadingInfo {
  final int level;
  final String title;
  final int offset;

  const HeadingInfo({
    required this.level,
    required this.title,
    required this.offset,
  });
}

/// 链接信息
class LinkInfo {
  final String text;
  final String url;
  final bool isWikiLink;
  final int offset;

  const LinkInfo({
    required this.text,
    required this.url,
    required this.isWikiLink,
    required this.offset,
  });
}

/// 自动保存管理器
class AutoSaveManager {
  Timer? _timer;
  final Duration delay;

  AutoSaveManager({this.delay = const Duration(seconds: 2)});

  /// 触发自动保存 (debounce)
  void trigger(Future<void> Function() saveAction) {
    _timer?.cancel();
    _timer = Timer(delay, () async {
      try {
        await saveAction();
      } catch (_) {
        // 保存失败静默处理
      }
    });
  }

  /// 取消待执行的保存
  void cancel() {
    _timer?.cancel();
  }

  /// 是否有待执行的保存
  bool get hasPending => _timer?.isActive ?? false;

  void dispose() {
    _timer?.cancel();
  }
}
