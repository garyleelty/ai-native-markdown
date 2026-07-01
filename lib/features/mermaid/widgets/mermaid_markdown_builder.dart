import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:markdown/markdown.dart' as md;
import '../../../core/theme/aeromind_theme.dart';
import '../services/mermaid_service.dart';

/// ══════════════════════════════════════════════════
/// MermaidMarkdownBuilder — 自定义 Markdown 代码块构造器
/// ══════════════════════════════════════════════════
/// 拦截 ```mermaid 代码块，替换为图表渲染组件
/// ──────────────────────────────────────────────────

class MermaidMarkdownBuilder extends MarkdownElementBuilder {
  final MermaidService _service = MermaidService();

  @override
  Widget? visitElementAfter(md.Element element, TextStyle? preferredStyle) {
    // 仅处理 code 块
    if (element.tag != 'code') return null;

    // 检查是否有语言标记 (mermaid)
    final infoString = element.attributes['class'] ?? '';
    if (!infoString.contains('language-mermaid')) return null;

    // 提取代码内容
    final code = element.textContent.trim();

    // 渲染为 Mermaid 图表
    return MermaidInlineWidget(code: code);
  }
}

/// 内联 Mermaid 组件 (用于 Markdown 渲染中)
class MermaidInlineWidget extends StatefulWidget {
  final String code;
  const MermaidInlineWidget({super.key, required this.code});

  @override
  State<MermaidInlineWidget> createState() => _MermaidInlineWidgetState();
}

class _MermaidInlineWidgetState extends State<MermaidInlineWidget> {
  final _service = MermaidService();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 10),
      child: Image.network(
        _service.renderToUrl(widget.code),
        fit: BoxFit.contain,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return Container(
            height: 100,
            decoration: BoxDecoration(
              color: AeroColors.bgElevated,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AeroColors.border, width: 0.5),
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor:
                        AlwaysStoppedAnimation(AeroColors.accentBlue),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '渲染 Mermaid 图表...',
                  style: TextStyle(
                    fontSize: 10,
                    color: AeroColors.textMuted,
                  ),
                ),
              ],
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) {
          return Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AeroColors.bgElevated,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                  color: AeroColors.accentOrange.withOpacity(0.3), width: 0.5),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.account_tree_outlined,
                        size: 12, color: AeroColors.accentPurple),
                    const SizedBox(width: 5),
                    Text('Mermaid 图表',
                        style: TextStyle(
                            fontSize: 10,
                            color: AeroColors.textSecondary,
                            fontWeight: FontWeight.w500)),
                  ],
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AeroColors.bgSurface,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: SelectableText(
                    widget.code,
                    style: TextStyle(
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: AeroColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
