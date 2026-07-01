import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:path/path.dart' as p;
import '../models/note_model.dart';
import 'hive_service.dart';

/// ══════════════════════════════════════════════════
/// FileService — 笔记文件 CRUD
/// ══════════════════════════════════════════════════
/// Web 端: 仅使用 Hive 存储 (IndexedDB)
/// 桌面端: 文件系统 + Hive 双写
/// ──────────────────────────────────────────────────

class FileService {
  final String vaultRoot;

  FileService({required this.vaultRoot});

  /// 从文件路径生成确定性 ID
  String generateId(String filePath) {
    final relative = p.relative(filePath, from: vaultRoot);
    return relative.hashCode.toRadixString(36);
  }

  /// 从 Markdown 内容提取标题
  static String extractTitle(String content, String filePath) {
    final h1Match = RegExp(r'^#\s+(.+)$', multiLine: true).firstMatch(content);
    if (h1Match != null) return h1Match.group(1)!.trim();
    return p.basenameWithoutExtension(filePath);
  }

  /// 保存笔记到 Hive (Web + 桌面通用)
  Future<void> saveNote(NoteModel note) async {
    await HiveService.noteBox.put(note.id, note);
  }

  /// 从 Hive 获取笔记
  Future<NoteModel?> getNote(String id) async {
    return HiveService.noteBox.get(id);
  }

  /// 获取所有笔记
  Future<List<NoteModel>> getAllNotes() async {
    final notes = <NoteModel>[];
    for (final key in HiveService.noteBox.keys) {
      try {
        final note = await HiveService.noteBox.get(key);
        if (note != null) notes.add(note);
      } catch (_) {}
    }
    notes.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return notes;
  }

  /// 创建新笔记 (内存 + Hive)
  Future<NoteModel> createNote({
    String title = '新笔记',
    String content = '',
    String? filePath,
  }) async {
    final now = DateTime.now();
    final id = now.millisecondsSinceEpoch.toString();
    final path = filePath ?? '$vaultRoot/$id.md';

    final note = NoteModel(
      id: id,
      title: title,
      rawMarkdown: content,
      filePath: path,
      createdAt: now,
      updatedAt: now,
    );

    await HiveService.noteBox.put(id, note);
    return note;
  }

  /// 删除笔记
  Future<void> deleteNote(String id) async {
    await HiveService.noteBox.delete(id);
  }

  /// 导出笔记为字符串 (Web 端可用)
  String exportAsMarkdown(NoteModel note) => note.rawMarkdown;

  /// 导出为 JSON 字符串
  String exportAsJson(NoteModel note) {
    return '{"id":"${note.id}","title":"${note.title}","content":${_escapeJson(note.rawMarkdown)},"tags":${note.tags.map((t) => '"$t"').toList()}}';
  }

  String _escapeJson(String text) {
    return '"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"';
  }
}
