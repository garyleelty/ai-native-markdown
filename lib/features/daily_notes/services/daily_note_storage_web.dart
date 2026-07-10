import '../../../../core/models/note_model.dart';
import '../../../../core/services/hive_service.dart';

/// Web 端日记存储实现
/// 使用 Hive 替代文件系统
class DailyNoteStorage {
  /// 检查日记文件是否存在
  Future<bool> exists(String filePath) async {
    final id = _pathToId(filePath);
    return HiveService.noteBox.containsKey(id);
  }

  /// 读取日记内容
  Future<String> readAsString(String filePath) async {
    final id = _pathToId(filePath);
    final note = await HiveService.noteBox.get(id);
    return note?.rawMarkdown ?? '';
  }

  /// 写入日记内容
  Future<void> writeAsString(String filePath, String content) async {
    final id = _pathToId(filePath);
    final existing = await HiveService.noteBox.get(id);
    final now = DateTime.now();
    final note = NoteModel(
      id: id,
      title: _extractTitle(filePath),
      rawMarkdown: content,
      filePath: filePath,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    );
    await HiveService.noteBox.put(id, note);
  }

  /// 获取文件状态信息
  Future<DailyNoteFileStat> stat(String filePath) async {
    final id = _pathToId(filePath);
    final note = await HiveService.noteBox.get(id);
    return DailyNoteFileStat(
      changed: note?.createdAt ?? DateTime.now(),
      modified: note?.updatedAt ?? DateTime.now(),
    );
  }

  /// 确保目录存在 (Web 端无需操作)
  Future<void> createDir(String dirPath, {bool recursive = false}) async {
    // Hive 不需要目录结构
  }

  /// 获取目录路径
  String dirname(String filePath) {
    final lastSlash = filePath.lastIndexOf('/');
    return lastSlash > 0 ? filePath.substring(0, lastSlash) : '';
  }

  /// 列出目录中匹配前缀的文件
  Future<List<String>> listFiles(String dirPath, String prefix) async {
    final results = <String>[];
    for (final key in HiveService.noteBox.keys) {
      if (key is String && key.startsWith('daily_$prefix')) {
        final datePart = key.substring(6);
        final filename = '$datePart.md';
        results.add('$dirPath/$filename');
      }
    }
    results.sort((a, b) => b.compareTo(a));
    return results;
  }

  /// 路径 → Hive ID
  String _pathToId(String filePath) {
    final filename = filePath.split('/').last;
    final datePart = filename
        .replaceAll('.md', '')
        .replaceAll(RegExp(r'-[一二三四五六日]$'), '');
    return 'daily_$datePart';
  }

  /// 从路径提取标题
  String _extractTitle(String filePath) {
    final filename = filePath.split('/').last.replaceAll('.md', '');
    return filename;
  }
}

/// 文件状态信息
class DailyNoteFileStat {
  final DateTime changed;
  final DateTime modified;

  const DailyNoteFileStat({required this.changed, required this.modified});
}
