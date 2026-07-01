/// ══════════════════════════════════════════════════
/// VersionService — 笔记版本历史管理
/// ══════════════════════════════════════════════════
/// 在自动保存时创建内容快照，支持查看和恢复历史版本。
/// 每篇笔记最多保留 [maxVersionsPerNote] 条快照。
/// ──────────────────────────────────────────────────

import 'package:hive_flutter/hive_flutter.dart';
import '../services/hive_service.dart';

/// 版本快照
class VersionSnapshot {
  final String id;
  final String noteId;
  final String content;
  final DateTime savedAt;

  const VersionSnapshot({
    required this.id,
    required this.noteId,
    required this.content,
    required this.savedAt,
  });

  factory VersionSnapshot.fromMap(Map<dynamic, dynamic> map) {
    return VersionSnapshot(
      id: map['id'] as String,
      noteId: map['noteId'] as String,
      content: map['content'] as String,
      savedAt: DateTime.fromMillisecondsSinceEpoch(map['savedAt'] as int),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'noteId': noteId,
      'content': content,
      'savedAt': savedAt.millisecondsSinceEpoch,
    };
  }
}

class VersionService {
  static const int maxVersionsPerNote = 20;

  static Box<dynamic> get _box => HiveService.versionBox;

  /// 保存快照（仅当内容变化时）
  static Future<void> saveSnapshot(String noteId, String content) async {
    // 获取该笔记最近的快照
    final versions = getVersions(noteId);
    if (versions.isNotEmpty && versions.first.content == content) {
      return; // 内容未变化
    }

    final now = DateTime.now();
    final id = '${noteId}_${now.millisecondsSinceEpoch}';
    final snapshot = VersionSnapshot(
      id: id,
      noteId: noteId,
      content: content,
      savedAt: now,
    );

    await _box.put(id, snapshot.toMap());

    // 清理超限的旧版本
    await _trimVersions(noteId);
  }

  /// 获取笔记的所有版本（按时间倒序）
  static List<VersionSnapshot> getVersions(String noteId) {
    final results = <VersionSnapshot>[];
    for (final key in _box.keys) {
      final raw = _box.get(key);
      if (raw is Map) {
        final snapshot = VersionSnapshot.fromMap(raw);
        if (snapshot.noteId == noteId) {
          results.add(snapshot);
        }
      }
    }
    results.sort((a, b) => b.savedAt.compareTo(a.savedAt));
    return results;
  }

  /// 恢复到指定版本
  static Future<String> restoreVersion(String versionId) async {
    final raw = _box.get(versionId);
    if (raw is Map) {
      return VersionSnapshot.fromMap(raw).content;
    }
    throw StateError('版本 $versionId 不存在');
  }

  /// 删除指定笔记的所有版本
  static Future<void> deleteAllVersions(String noteId) async {
    final keysToDelete = <String>[];
    for (final key in _box.keys) {
      final raw = _box.get(key);
      if (raw is Map && raw['noteId'] == noteId) {
        keysToDelete.add(key as String);
      }
    }
    for (final key in keysToDelete) {
      await _box.delete(key);
    }
  }

  /// 限制每篇笔记的版本数量
  static Future<void> _trimVersions(String noteId) async {
    final versions = getVersions(noteId);
    if (versions.length <= maxVersionsPerNote) return;

    final toDelete = versions.skip(maxVersionsPerNote).toList();
    for (final v in toDelete) {
      await _box.delete(v.id);
    }
  }
}
