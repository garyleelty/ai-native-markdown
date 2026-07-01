/// ══════════════════════════════════════════════════
/// MarkdownEnhancePlugin — Markdown 增强插件 (内置)
/// ══════════════════════════════════════════════════
/// 内容处理器插件，演示 contentProcessor 扩展点:
///   - 自动为裸 URL 生成 Markdown 链接
///   - 自动规范化标题层级
///   - 自动移除行尾空格
/// ──────────────────────────────────────────────────

import '../plugin/base_plugin.dart';
import '../plugin/plugin_manifest.dart';

/// Markdown 增强插件
class MarkdownEnhancePlugin extends BasePlugin {
  @override
  PluginManifest get manifest => const PluginManifest(
        id: 'com.aeromind.markdown-enhance',
        name: 'Markdown 增强',
        version: '1.0.0',
        description: '自动规范化 Markdown 格式：裸 URL 转链接、行尾空格清理',
        author: 'AeroMind',
        extensionTypes: ['contentProcessor'],
        category: '编辑器',
        iconCodePoint: 0xe3c9, // Icons.auto_fix_normal
      );

  @override
  Future<String?> processContent(String markdown, String noteId) async {
    String? result;
    final original = markdown;

    // 1. 移除行尾多余空格 (保留换行符)
    result = _trimTrailingSpaces(result ?? markdown);

    // 2. 裸 URL 转 Markdown 链接
    result = _linkifyUrls(result);

    // 3. 连续空行规范化 (最多保留两个换行)
    result = _normalizeBlankLines(result);

    // 如果内容未修改，返回 null 避免不必要的写入
    if (result == original) return null;
    return result;
  }

  /// 移除每行尾部的多余空格
  String _trimTrailingSpaces(String text) {
    return text.split('\n').map((line) => line.trimRight()).join('\n');
  }

  /// 将裸 URL 转为 Markdown 链接
  String _linkifyUrls(String text) {
    // 匹配不在 Markdown 链接中的裸 URL
    final urlPattern = RegExp(r'(?<!\]\()(?<!\()https?://[^\s\)]+(?!\))');
    return text.replaceAllMapped(urlPattern, (match) {
      final url = match.group(0)!;
      // 如果已经是链接的一部分，跳过
      return '[$url]($url)';
    });
  }

  /// 规范化连续空行
  String _normalizeBlankLines(String text) {
    return text.replaceAll(RegExp(r'\n{3,}'), '\n\n');
  }
}
