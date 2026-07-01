import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as p;
import '../models/note_model.dart';
import 'hive_service.dart';

/// ══════════════════════════════════════════════════
/// FilePickerService — 本地 .md 文件选取与导入
/// ══════════════════════════════════════════════════
/// 支持两种模式:
///   1. 导入模式: 选择文件 → 读取内容 → 存入 Hive → 返回 NoteModel
///   2. 直接打开: 选择文件 → 读取内容 → 返回临时 NoteModel (不存入 Hive)
/// ──────────────────────────────────────────────────
class FilePickerService {
  /// 选择并导入 .md 文件到 Hive
  ///
  /// 返回导入后的 NoteModel，如果用户取消选择则返回 null
  Future<NoteModel?> pickAndImport() async {
    final filePath = await _pickMdFile();
    if (filePath == null) return null;
    return importFromPath(filePath);
  }

  /// 选择并直接打开 .md 文件 (不存入 Hive)
  ///
  /// 返回临时 NoteModel，如果用户取消选择则返回 null
  Future<NoteModel?> pickAndOpen() async {
    final filePath = await _pickMdFile();
    if (filePath == null) return null;
    return openFromPath(filePath);
  }

  /// 从文件路径读取并导入
  Future<NoteModel?> importFromPath(String filePath) async {
    try {
      final fileContent = await File(filePath).readAsString();
      final title = _extractTitle(fileContent, filePath);

      final now = DateTime.now();
      final id = now.millisecondsSinceEpoch.toString();

      final note = NoteModel(
        id: id,
        title: title,
        rawMarkdown: fileContent,
        filePath: filePath,
        createdAt: now,
        updatedAt: now,
      );

      await HiveService.noteBox.put(id, note);
      return note;
    } catch (_) {
      return null;
    }
  }

  /// 从文件路径直接打开 (不存入 Hive)
  Future<NoteModel?> openFromPath(String filePath) async {
    try {
      final fileContent = await File(filePath).readAsString();
      final title = _extractTitle(fileContent, filePath);

      final now = DateTime.now();
      final id = 'file_${filePath.hashCode.toRadixString(36)}';

      return NoteModel(
        id: id,
        title: title,
        rawMarkdown: fileContent,
        filePath: filePath,
        createdAt: now,
        updatedAt: now,
      );
    } catch (_) {
      return null;
    }
  }

  /// 内部: 选择 .md 文件并返回文件路径
  Future<String?> _pickMdFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['md', 'markdown', 'txt'],
      withData: false,
      withReadStream: false,
    );

    if (result == null || result.files.isEmpty) return null;
    return result.files.first.path;
  }

  /// 从 Markdown 内容提取标题
  String _extractTitle(String content, String filePath) {
    final h1Match = RegExp(r'^#\s+(.+)$', multiLine: true).firstMatch(content);
    if (h1Match != null) return h1Match.group(1)!.trim();
    return p.basenameWithoutExtension(filePath);
  }
}
