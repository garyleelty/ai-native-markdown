/// ══════════════════════════════════════════════════
/// ExportPlugin — 多格式导出插件 (内置)
/// ══════════════════════════════════════════════════
/// 演示 exporter 扩展点:
///   - 导出为纯文本
///   - 导出为 HTML
///   - 导出为 JSON 格式
/// ──────────────────────────────────────────────────
library;

import 'dart:convert';
import 'package:flutter/services.dart';
import '../plugin/base_plugin.dart';
import '../plugin/plugin_manifest.dart';
import '../plugin/plugin_api.dart';
import '../models/note_model.dart';

/// 多格式导出插件
class ExportPlugin extends BasePlugin {
  @override
  PluginManifest get manifest => const PluginManifest(
        id: 'com.aeromind.export',
        name: '多格式导出',
        version: '1.0.0',
        description: '将笔记导出为纯文本、HTML 或 JSON 格式',
        author: 'AeroMind',
        extensionTypes: ['command', 'exporter'],
        category: '工具',
        iconCodePoint: 0xe2c6, // Icons.file_download
        isBuiltIn: true,
      );

  @override
  Future<void> onActivate(PluginContext ctx) async {
    // 注册存储中的导出设置
    final defaultFormat = ctx.storage.getString('default_format') ?? 'plain';
    await ctx.storage.putString('default_format', defaultFormat);
  }

  @override
  List<PluginCommand> getCommands() {
    return [
      PluginCommand(
        id: 'plugin.export.plain',
        name: '导出为纯文本',
        description: '移除 Markdown 语法，导出纯文本',
        iconCodePoint: 0xe2c6,
        pluginId: manifest.id,
        action: () async => _export((note) => exportAsPlainText(note), '纯文本'),
      ),
      PluginCommand(
        id: 'plugin.export.html',
        name: '导出为 HTML',
        description: '将 Markdown 渲染为 HTML 并导出',
        iconCodePoint: 0xe2c6,
        pluginId: manifest.id,
        action: () async => _export((note) => exportAsHtml(note), 'HTML'),
      ),
      PluginCommand(
        id: 'plugin.export.json',
        name: '导出为 JSON',
        description: '导出笔记的完整结构化数据',
        iconCodePoint: 0xe2c6,
        pluginId: manifest.id,
        action: () async => _export((note) => exportAsJson(note), 'JSON'),
      ),
    ];
  }

  /// 通用导出流程：获取活动笔记 → 转换 → 复制到剪贴板 → 通知
  Future<void> _export(
    String Function(NoteModel) converter,
    String formatLabel,
  ) async {
    final api = context?.api;
    if (api == null) return;
    final noteId = api.activeNoteId;
    if (noteId == null) {
      api.showNotification('没有打开的笔记', type: NotificationType.warning);
      return;
    }
    final note = await api.getNote(noteId);
    if (note == null) {
      api.showNotification('笔记不存在', type: NotificationType.error);
      return;
    }
    final output = converter(note);
    await Clipboard.setData(ClipboardData(text: output));
    api.showNotification(
      '已复制 $formatLabel 到剪贴板 (${output.length} 字符)',
      type: NotificationType.success,
    );
  }

  /// 导出为纯文本
  static String exportAsPlainText(NoteModel note) {
    // 移除 Markdown 语法
    String text = note.rawMarkdown;
    text = text.replaceAll(RegExp(r'^#{1,6}\s+', multiLine: true), '');
    text = text.replaceAll(RegExp(r'\*\*(.+?)\*\*'), r'$1');
    text = text.replaceAll(RegExp(r'\*(.+?)\*'), r'$1');
    text = text.replaceAll(RegExp(r'`(.+?)`'), r'$1');
    text = text.replaceAllMapped(RegExp(r'```[\s\S]*?```'), (match) {
      final block = match.group(0)!;
      final lines = block.split('\n');
      if (lines.length >= 3) {
        return lines.sublist(1, lines.length - 1).join('\n');
      }
      return block;
    });
    text = text.replaceAll(RegExp(r'\[(.+?)\]\(.+?\)'), r'$1');
    text = text.replaceAll(RegExp(r'\[\[(.+?)\]\]'), r'$1');
    return text.trim();
  }

  /// 导出为 HTML
  static String exportAsHtml(NoteModel note) {
    final buffer = StringBuffer();
    buffer.writeln('<!DOCTYPE html>');
    buffer.writeln('<html lang="zh-CN">');
    buffer.writeln('<head>');
    buffer.writeln('  <meta charset="UTF-8">');
    buffer.writeln('  <title>${_escapeHtml(note.title)}</title>');
    buffer.writeln('  <style>');
    buffer.writeln('    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }');
    buffer.writeln('    h1 { border-bottom: 1px solid #eee; padding-bottom: 8px; }');
    buffer.writeln('    blockquote { border-left: 3px solid #ddd; padding-left: 12px; color: #666; }');
    buffer.writeln('    code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }');
    buffer.writeln('    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }');
    buffer.writeln('    a { color: #569CD6; }');
    buffer.writeln('  </style>');
    buffer.writeln('</head>');
    buffer.writeln('<body>');
    buffer.writeln(_markdownToSimpleHtml(note.rawMarkdown));
    buffer.writeln('</body>');
    buffer.writeln('</html>');
    return buffer.toString();
  }

  /// 导出为 JSON
  static String exportAsJson(NoteModel note) {
    final data = {
      'id': note.id,
      'title': note.title,
      'content': note.rawMarkdown,
      'filePath': note.filePath,
      'tags': note.tags,
      'backlinks': note.backlinks,
      'outgoingLinks': note.outgoingLinks,
      'entities': note.entities
          .map((e) => {
                'label': e.label,
                'type': e.type.name,
                'start': e.startOffset,
                'end': e.endOffset,
                'confidence': e.confidence,
              })
          .toList(),
      'createdAt': note.createdAt.toIso8601String(),
      'updatedAt': note.updatedAt.toIso8601String(),
    };
    return const JsonEncoder.withIndent('  ').convert(data);
  }

  static const _allowedUrlSchemes = ['http:', 'https:', 'ftp:', 'ftps:', 'mailto:', 'tel:', 'file:'];
  static const _htmlEscapeAttr = HtmlEscape(HtmlEscapeMode.attribute);
  static const _htmlEscapeElement = HtmlEscape(HtmlEscapeMode.element);

  static String _sanitizeUrl(String url) {
    final trimmed = url.trim();
    if (trimmed.isEmpty) return '#';
    try {
      final uri = Uri.parse(trimmed);
      if (uri.hasScheme && _allowedUrlSchemes.contains(uri.scheme.toLowerCase())) {
        return _htmlEscapeAttr.convert(trimmed);
      }
      if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./')) {
        return _htmlEscapeAttr.convert(trimmed);
      }
      return '#';
    } catch (_) {
      return '#';
    }
  }

  /// 简化的 Markdown → HTML 转换
  static String _markdownToSimpleHtml(String md) {
    final codeBlocks = <String>[];
    String html = md.replaceAllMapped(RegExp(r'```([\s\S]*?)```'), (m) {
      final placeholder = '\x00CODEBLOCK${codeBlocks.length}\x00';
      codeBlocks.add(m.group(1) ?? '');
      return placeholder;
    });

    final inlineCodes = <String>[];
    html = html.replaceAllMapped(RegExp(r'`([^`]+?)`'), (m) {
      final placeholder = '\x00INLINECODE${inlineCodes.length}\x00';
      inlineCodes.add(m.group(1) ?? '');
      return placeholder;
    });

    html = _escapeHtml(html);

    html = html.replaceAllMapped(
        RegExp(r'^######\s+(.+)$', multiLine: true),
        (m) => '<h6>${m.group(1)}</h6>');
    html = html.replaceAllMapped(
        RegExp(r'^#####\s+(.+)$', multiLine: true),
        (m) => '<h5>${m.group(1)}</h5>');
    html = html.replaceAllMapped(
        RegExp(r'^####\s+(.+)$', multiLine: true),
        (m) => '<h4>${m.group(1)}</h4>');
    html = html.replaceAllMapped(
        RegExp(r'^###\s+(.+)$', multiLine: true),
        (m) => '<h3>${m.group(1)}</h3>');
    html = html.replaceAllMapped(
        RegExp(r'^##\s+(.+)$', multiLine: true),
        (m) => '<h2>${m.group(1)}</h2>');
    html = html.replaceAllMapped(
        RegExp(r'^#\s+(.+)$', multiLine: true),
        (m) => '<h1>${m.group(1)}</h1>');

    html = html.replaceAllMapped(RegExp(r'\*\*(.+?)\*\*'), (m) => '<strong>${m.group(1)}</strong>');
    html = html.replaceAllMapped(RegExp(r'\*(.+?)\*'), (m) => '<em>${m.group(1)}</em>');

    html = html.replaceAllMapped(
        RegExp(r'\[(.+?)\]\((.+?)\)'), (m) {
      final text = m.group(1) ?? '';
      final url = m.group(2) ?? '';
      return '<a href="${_sanitizeUrl(url)}" rel="noopener noreferrer">$text</a>';
    });

    html = html.replaceAll('\n', '<br>\n');

    for (var i = 0; i < inlineCodes.length; i++) {
      final escapedCode = _escapeHtml(inlineCodes[i]);
      html = html.replaceAll('\x00INLINECODE$i\x00', '<code>$escapedCode</code>');
    }

    for (var i = 0; i < codeBlocks.length; i++) {
      final escapedCode = _escapeHtml(codeBlocks[i]);
      html = html.replaceAll('\x00CODEBLOCK$i\x00', '<pre><code>$escapedCode</code></pre>');
    }

    return html;
  }

  static String _escapeHtml(String text) {
    return _htmlEscapeElement.convert(text);
  }
}
