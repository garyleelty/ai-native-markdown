import 'dart:io';
import 'package:path/path.dart' as p;

/// 原生平台日记存储实现
/// 使用 dart:io 的 File/Directory API
class DailyNoteStorage {
  /// 检查日记文件是否存在
  Future<bool> exists(String filePath) async {
    return File(filePath).exists();
  }

  /// 读取日记内容
  Future<String> readAsString(String filePath) async {
    return File(filePath).readAsString();
  }

  /// 写入日记内容
  Future<void> writeAsString(String filePath, String content) async {
    await File(filePath).writeAsString(content);
  }

  /// 获取文件状态信息
  Future<_FileStat> stat(String filePath) async {
    final s = await File(filePath).stat();
    return _FileStat(changed: s.changed, modified: s.modified);
  }

  /// 确保目录存在
  Future<void> createDir(String dirPath, {bool recursive = false}) async {
    final dir = Directory(dirPath);
    if (!await dir.exists()) {
      await dir.create(recursive: recursive);
    }
  }

  /// 获取目录路径
  String dirname(String filePath) => p.dirname(filePath);

  /// 列出目录中匹配前缀的文件
  Future<List<String>> listFiles(String dirPath, String prefix) async {
    final dir = Directory(dirPath);
    if (!await dir.exists()) return [];

    final results = <String>[];
    await for (final entity in dir.list()) {
      if (entity is File && entity.path.endsWith('.md')) {
        final filename = p.basenameWithoutExtension(entity.path);
        if (filename.startsWith(prefix)) {
          results.add(entity.path);
        }
      }
    }
    results.sort((a, b) => b.compareTo(a));
    return results;
  }
}

/// 文件状态信息
class _FileStat {
  final DateTime changed;
  final DateTime modified;

  const _FileStat({required this.changed, required this.modified});
}
