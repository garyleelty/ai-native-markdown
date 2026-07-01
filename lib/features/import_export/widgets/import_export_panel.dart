/// ══════════════════════════════════════════════════
/// ImportExportPanel — 导入导出面板
/// ══════════════════════════════════════════════════
/// 提供：
///   - 导出当前笔记为 纯文本 / HTML / JSON
///   - 导出全部笔记为 JSON
///   - 从 JSON 导入笔记（合并到本地存储）
/// ──────────────────────────────────────────────────

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import '../../../core/builtin_plugins/export_plugin.dart';
import '../../../core/models/note_model.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/note_provider.dart';

class ImportExportPanel extends ConsumerStatefulWidget {
  final String? activeNoteId;
  final VoidCallback onClose;

  const ImportExportPanel({
    super.key,
    this.activeNoteId,
    required this.onClose,
  });

  @override
  ConsumerState<ImportExportPanel> createState() => _ImportExportPanelState();
}

class _ImportExportPanelState extends ConsumerState<ImportExportPanel> {
  bool _busy = false;
  String? _status;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Material(
        color: Colors.black54,
        child: Center(
          child: Container(
            width: 480,
            constraints: const BoxConstraints(maxHeight: 560),
            decoration: BoxDecoration(
              color: AeroColors.bgSurface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AeroColors.border, width: 0.5),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      _Section(
                        title: '导出当前笔记',
                        subtitle: widget.activeNoteId == null
                            ? '当前没有打开的笔记'
                            : '将当前笔记导出到文件',
                        enabled: widget.activeNoteId != null,
                        children: [
                          _ActionRow(
                            icon: Icons.text_snippet_outlined,
                            label: '纯文本 (.txt)',
                            onTap: () => _exportCurrent('txt'),
                          ),
                          _ActionRow(
                            icon: Icons.html_outlined,
                            label: 'HTML (.html)',
                            onTap: () => _exportCurrent('html'),
                          ),
                          _ActionRow(
                            icon: Icons.data_object,
                            label: 'JSON (.json)',
                            onTap: () => _exportCurrent('json'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _Section(
                        title: '导出全部笔记',
                        subtitle: '将所有笔记打包为 JSON 文件',
                        children: [
                          _ActionRow(
                            icon: Icons.archive_outlined,
                            label: '导出全部为 JSON',
                            onTap: _exportAll,
                          ),
                          _ActionRow(
                            icon: Icons.content_copy,
                            label: '复制全部 JSON 到剪贴板',
                            onTap: _copyAllToClipboard,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _Section(
                        title: '从 JSON 导入',
                        subtitle: '从导出的 JSON 文件中恢复笔记（合并模式）',
                        children: [
                          _ActionRow(
                            icon: Icons.file_upload_outlined,
                            label: '选择 JSON 文件导入',
                            onTap: _importFromJson,
                          ),
                        ],
                      ),
                      if (_status != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AeroColors.bgElevated,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AeroColors.border, width: 0.5),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.info_outline,
                                  size: 14, color: AeroColors.accentCyan),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _status!,
                                  style: const TextStyle(
                                    color: AeroColors.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(8),
          topRight: Radius.circular(8),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.import_export,
              size: 18, color: AeroColors.accentBlue),
          const SizedBox(width: 8),
          const Text(
            '导入 / 导出',
            style: TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          if (_busy)
            const Padding(
              padding: EdgeInsets.only(right: 12),
              child: SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  color: AeroColors.accentBlue,
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.close,
                size: 16, color: AeroColors.textSecondary),
            onPressed: widget.onClose,
            splashRadius: 14,
          ),
        ],
      ),
    );
  }

  // ── 操作实现 ──

  Future<void> _exportCurrent(String format) async {
    if (widget.activeNoteId == null) return;
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(widget.activeNoteId!);
      if (note == null) {
        setState(() => _status = '未找到当前笔记');
        return;
      }
      String content;
      String ext;
      switch (format) {
        case 'txt':
          content = ExportPlugin.exportAsPlainText(note);
          ext = 'txt';
          break;
        case 'html':
          content = ExportPlugin.exportAsHtml(note);
          ext = 'html';
          break;
        default:
          content = ExportPlugin.exportAsJson(note);
          ext = 'json';
      }
      final safeTitle = _sanitizeFilename(note.title);
      final outputPath = await FilePicker.platform.saveFile(
        fileName: '$safeTitle.$ext',
      );
      if (outputPath == null) {
        setState(() => _status = '已取消导出');
        return;
      }
      // 复制到剪贴板作为兜底（移动端可能无法写文件）
      await Clipboard.setData(ClipboardData(text: content));
      setState(() => _status = '已导出「${note.title}.$ext」到剪贴板（${content.length} 字符）');
    } catch (e) {
      setState(() => _status = '导出失败：$e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _exportAll() async {
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final repo = ref.read(noteRepositoryProvider);
      final notes = await repo.getAllNotes();
      if (notes.isEmpty) {
        setState(() => _status = '没有可导出的笔记');
        return;
      }
      final jsonList = notes.map(_noteToJson).toList();
      final jsonStr = const JsonEncoder.withIndent('  ').convert(jsonList);
      await FilePicker.platform.saveFile(
        fileName: 'aeromind-export-${DateTime.now().millisecondsSinceEpoch}.json',
      );
      await Clipboard.setData(ClipboardData(text: jsonStr));
      setState(() => _status =
          '已导出 ${notes.length} 篇笔记到剪贴板（${jsonStr.length} 字符）');
    } catch (e) {
      setState(() => _status = '导出失败：$e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _copyAllToClipboard() async {
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final repo = ref.read(noteRepositoryProvider);
      final notes = await repo.getAllNotes();
      if (notes.isEmpty) {
        setState(() => _status = '没有可导出的笔记');
        return;
      }
      final jsonList = notes.map(_noteToJson).toList();
      final jsonStr = const JsonEncoder.withIndent('  ').convert(jsonList);
      await Clipboard.setData(ClipboardData(text: jsonStr));
      setState(() => _status = '已复制 ${notes.length} 篇笔记到剪贴板');
    } catch (e) {
      setState(() => _status = '失败：$e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _importFromJson() async {
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final result = await FilePicker.platform.pickFiles(
        dialogTitle: '选择 JSON 文件',
        type: FileType.custom,
        allowedExtensions: ['json'],
        withData: true,
      );
      if (result == null || result.files.isEmpty) {
        setState(() => _status = '未选择文件');
        return;
      }
      final bytes = result.files.first.bytes;
      if (bytes == null) {
        setState(() => _status = '文件内容为空');
        return;
      }
      final jsonStr = utf8.decode(bytes);
      final decoded = jsonDecode(jsonStr);
      final List list = decoded is List ? decoded : [decoded];
      final repo = ref.read(noteRepositoryProvider);
      int imported = 0;
      int skipped = 0;
      for (final item in list) {
        if (item is! Map) {
          skipped++;
          continue;
        }
        try {
          final note = _noteFromJson(item);
          await repo.saveNote(note);
          imported++;
        } catch (_) {
          skipped++;
        }
      }
      setState(() => _status = '已导入 $imported 篇笔记'
          '${skipped > 0 ? '（跳过 $skipped 条无效记录）' : ''}');
    } catch (e) {
      setState(() => _status = '导入失败：$e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Map<String, dynamic> _noteToJson(NoteModel n) {
    return {
      'id': n.id,
      'title': n.title,
      'rawMarkdown': n.rawMarkdown,
      'filePath': n.filePath,
      'folderPath': n.folderPath,
      'tags': n.tags,
      'createdAt': n.createdAt.toIso8601String(),
      'updatedAt': n.updatedAt.toIso8601String(),
    };
  }

  NoteModel _noteFromJson(Map<dynamic, dynamic> map) {
    final now = DateTime.now();
    return NoteModel(
      id: (map['id'] as String?) ?? 'imported_${now.millisecondsSinceEpoch}',
      title: (map['title'] as String?) ?? '未命名笔记',
      rawMarkdown: (map['rawMarkdown'] as String?) ??
          (map['content'] as String?) ??
          '',
      filePath: (map['filePath'] as String?) ?? '',
      folderPath: (map['folderPath'] as String?) ?? '',
      tags: ((map['tags'] as List?) ?? const [])
          .map((t) => t.toString())
          .toList(),
      createdAt: _parseDate(map['createdAt']) ?? now,
      updatedAt: _parseDate(map['updatedAt']) ?? now,
    );
  }

  DateTime? _parseDate(dynamic v) {
    if (v is String) return DateTime.tryParse(v);
    return null;
  }

  String _sanitizeFilename(String name) {
    return name.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_').trim();
  }
}

class _Section extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget> children;
  final bool enabled;

  const _Section({
    required this.title,
    this.subtitle,
    required this.children,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1.0 : 0.5,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AeroColors.accentBlue,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle!,
              style: const TextStyle(
                color: AeroColors.textMuted,
                fontSize: 11,
              ),
            ),
          ],
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: AeroColors.bgElevated,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AeroColors.border, width: 0.5),
            ),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: const BoxDecoration(
          border: Border(
            bottom: BorderSide(color: AeroColors.divider, width: 0.3),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: AeroColors.textSecondary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  color: AeroColors.textPrimary,
                  fontSize: 12,
                ),
              ),
            ),
            const Icon(Icons.chevron_right,
                size: 14, color: AeroColors.textMuted),
          ],
        ),
      ),
    );
  }
}
