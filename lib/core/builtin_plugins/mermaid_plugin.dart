import 'package:flutter/services.dart';
import '../plugin/plugin_manifest.dart';
import '../plugin/base_plugin.dart';
import '../plugin/plugin_api.dart';
import '../../features/mermaid/services/mermaid_service.dart';

/// ══════════════════════════════════════════════════
/// MermaidRenderPlugin — 内置 Mermaid 图表插件
/// ══════════════════════════════════════════════════
/// 扩展点: contentProcessor
/// 功能:
///   1. 在 Markdown 渲染前处理 ```mermaid 代码块
///   2. 自动生成 mermaid.ink 渲染图片链接
///   3. 在侧边栏提供图表列表入口
///
/// 支持图表类型:
///   - flowchart / graph (流程图)
///   - sequenceDiagram (时序图)
///   - classDiagram (类图)
///   - stateDiagram (状态图)
///   - erDiagram (ER 图)
///   - gantt (甘特图)
///   - pie (饼图)
///   - gitGraph (Git 分支图)
/// ──────────────────────────────────────────────────

class MermaidRenderPlugin extends BasePlugin {
  static const String _id = 'builtin.mermaid-render';

  final MermaidService _service = MermaidService();

  @override
  PluginManifest get manifest => const PluginManifest(
        id: _id,
        name: 'Mermaid 图表渲染',
        version: '1.0.0',
        description: '自动识别和渲染 Markdown 中的 Mermaid 图表代码块',
        author: 'AeroMind',
        extensionTypes: ['contentProcessor'],
        iconCodePoint: 0xe3c4,
        category: 'editor',
        enabledByDefault: true,
      );

  @override
  Future<String?> processContent(String markdown, String noteId) async {
    if (!_service.hasMermaidBlocks(markdown)) return null;

    // 增强 Markdown: 在每个 Mermaid 块后追加渲染图片链接
    return _service.enhanceMarkdown(markdown);
  }

  @override
  List<PluginCommand> getCommands() {
    final pid = manifest.id;
    return [
      PluginCommand(
        id: '$pid.export-mermaid',
        name: '导出 Mermaid 图表为 SVG',
        description: '将当前笔记中的所有 Mermaid 图表导出为 SVG 链接',
        iconCodePoint: 0xe3c4,
        action: () async => _exportMermaidSvg(),
        pluginId: pid,
      ),
      PluginCommand(
        id: '$pid.toggle-render',
        name: '切换 Mermaid 渲染/源码',
        description: '在图表渲染和原始代码之间切换',
        iconCodePoint: 0xe8b8,
        action: () async => _toggleRenderMode(),
        pluginId: pid,
      ),
    ];
  }

  /// 提取当前笔记中的 Mermaid 图表，生成 SVG 链接并复制到剪贴板
  Future<void> _exportMermaidSvg() async {
    final api = context?.api;
    if (api == null) return;
    final noteId = api.activeNoteId;
    if (noteId == null) {
      api.showNotification('没有打开的笔记', type: NotificationType.warning);
      return;
    }
    final note = await api.getNote(noteId);
    if (note == null) return;

    final blocks = _service.extractBlocks(note.rawMarkdown);
    if (blocks.isEmpty) {
      api.showNotification('当前笔记没有 Mermaid 图表', type: NotificationType.warning);
      return;
    }

    final buffer = StringBuffer();
    buffer.writeln('# Mermaid 图表导出 — ${note.title}');
    buffer.writeln();
    for (var i = 0; i < blocks.length; i++) {
      final block = blocks[i];
      buffer.writeln('## 图表 ${i + 1} (${block.diagramType})');
      buffer.writeln();
      buffer.writeln('```mermaid');
      buffer.writeln(block.code);
      buffer.writeln('```');
      buffer.writeln();
      buffer.writeln('SVG 链接: ${block.renderUrl}');
      buffer.writeln();
    }
    final output = buffer.toString();
    await Clipboard.setData(ClipboardData(text: output));
    api.showNotification(
      '已导出 ${blocks.length} 个 Mermaid 图表链接到剪贴板',
      type: NotificationType.success,
    );
  }

  /// 切换 Mermaid 渲染模式（存储偏好并通知）
  Future<void> _toggleRenderMode() async {
    final api = context?.api;
    final ctx = context;
    if (api == null || ctx == null) return;

    final current = ctx.storage.getBool('render_enabled') ?? true;
    final next = !current;
    await ctx.storage.putBool('render_enabled', next);

    api.showNotification(
      next ? 'Mermaid 渲染已开启' : 'Mermaid 渲染已关闭 (仅显示源码)',
      type: NotificationType.info,
    );
  }
}
