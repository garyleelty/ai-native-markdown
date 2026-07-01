import 'mermaid_encoder_io.dart' if (dart.library.html) 'mermaid_encoder_web.dart';

/// ══════════════════════════════════════════════════
/// MermaidService — Mermaid 图表服务
/// ══════════════════════════════════════════════════
/// 功能:
///   1. 从 Markdown 中提取 ```mermaid 代码块
///   2. 通过 mermaid.ink API 渲染为图片 URL
///   3. 支持替换/增强 Markdown 中的图表块
/// ──────────────────────────────────────────────────

class MermaidService {
  static final MermaidService _instance = MermaidService._();
  factory MermaidService() => _instance;
  MermaidService._();

  /// Mermaid 代码块正则
  static final RegExp mermaidBlockPattern = RegExp(
    r'```mermaid\s*\n(.*?)\n```',
    dotAll: true,
  );

  /// 从 Markdown 内容中提取所有 Mermaid 代码块
  List<MermaidBlock> extractBlocks(String markdown) {
    final blocks = <MermaidBlock>[];
    for (final match in mermaidBlockPattern.allMatches(markdown)) {
      blocks.add(MermaidBlock(
        code: match.group(1)?.trim() ?? '',
        startOffset: match.start,
        endOffset: match.end,
      ));
    }
    return blocks;
  }

  /// 检测内容是否包含 Mermaid 代码块
  bool hasMermaidBlocks(String markdown) {
    return mermaidBlockPattern.hasMatch(markdown);
  }

  /// 将 Mermaid 代码转换为渲染图片 URL
  String renderToUrl(String mermaidCode) {
    return MermaidEncoder.encodeToUrl(mermaidCode.trim());
  }

  /// 处理 Markdown 内容：将 Mermaid 块替换为图片
  ///
  /// 策略：在 Mermaid 代码块后追加图片链接，
  /// 这样在纯文本编辑器中也保留原始代码。
  String enhanceMarkdown(String markdown) {
    return markdown.replaceAllMapped(mermaidBlockPattern, (match) {
      final code = match.group(1)?.trim() ?? '';
      final url = renderToUrl(code);
      return '${match.group(0)}\n\n![Mermaid 图表]($url)\n';
    });
  }
}

/// Mermaid 代码块提取结果
class MermaidBlock {
  /// 原始 Mermaid 代码
  final String code;

  /// 在原文中的起始位置
  final int startOffset;

  /// 在原文中的结束位置
  final int endOffset;

  /// 渲染后的图片 URL (异步获取)
  String? imageUrl;

  MermaidBlock({
    required this.code,
    required this.startOffset,
    required this.endOffset,
    this.imageUrl,
  });

  /// 获取渲染 URL
  String get renderUrl => imageUrl ?? MermaidService().renderToUrl(code);

  /// 图表类型 (如 graph, sequenceDiagram, classDiagram 等)
  String get diagramType {
    final firstLine = code.trimLeft().split('\n').first.trim();
    // 移除可能的参数
    final parts = firstLine.split(' ');
    return parts.isNotEmpty ? parts.first : 'unknown';
  }
}
