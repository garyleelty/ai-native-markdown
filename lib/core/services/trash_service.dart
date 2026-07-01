/// ══════════════════════════════════════════════════
/// TrashService — 回收站管理
/// ══════════════════════════════════════════════════
/// 删除笔记时移入回收站，支持恢复和彻底删除。
/// 超过 [retentionDays] 天的回收站项目自动清理。
/// ──────────────────────────────────────────────────

import 'package:hive_flutter/hive_flutter.dart';
import '../models/note_model.dart';
import '../services/hive_service.dart';

class TrashService {
  /// 回收站保留天数
  static const int retentionDays = 30;

  static Box<NoteModel> get _box => HiveService.trashBox;

  /// 将笔记移入回收站
  static Future<void> moveToTrash(NoteModel note) async {
    // 在 id 中编码删除时间：原ID_trash_timestamp
    final trashId = '${note.id}_trash_${DateTime.now().millisecondsSinceEpoch}';
    final trashedNote = note.copyWith(
      id: trashId,
      filePath: note.filePath, // 保留原始路径信息
    );
    await _box.put(trashId, trashedNote);
  }

  /// 获取回收站所有笔记（按删除时间倒序）
  static List<NoteModel> getAllTrashed() {
    final results = _box.values.toList();
    results.sort((NoteModel a, NoteModel b) {
      final aTime = _getDeletedTime(a.id);
      final bTime = _getDeletedTime(b.id);
      return bTime.compareTo(aTime);
    });
    return results;
  }

  /// 从回收站恢复笔记
  static Future<NoteModel?> restore(String trashId) async {
    final note = _box.get(trashId);
    if (note == null) return null;

    // 恢复原始 ID
    final originalId = _getOriginalId(trashId);
    final restored = note.copyWith(
      id: originalId,
      updatedAt: DateTime.now(),
    );

    await _box.delete(trashId);
    return restored;
  }

  /// 彻底删除回收站中的笔记
  static Future<void> deletePermanently(String trashId) async {
    await _box.delete(trashId);
  }

  /// 清空回收站
  static Future<void> emptyTrash() async {
    await _box.clear();
  }

  /// 自动清理过期项目（应用启动时调用）
  static Future<void> cleanExpired() async {
    final cutoff = DateTime.now().subtract(const Duration(days: retentionDays));
    final keysToDelete = <String>[];

    for (final key in _box.keys) {
      final trashId = key as String;
      final deletedTime = _getDeletedTime(trashId);
      if (deletedTime.isBefore(cutoff)) {
        keysToDelete.add(trashId);
      }
    }

    for (final key in keysToDelete) {
      await _box.delete(key);
    }
  }

  /// 从 trashId 中提取删除时间
  static DateTime _getDeletedTime(String trashId) {
    final parts = trashId.split('_trash_');
    if (parts.length == 2) {
      final ms = int.tryParse(parts[1]);
      if (ms != null) return DateTime.fromMillisecondsSinceEpoch(ms);
    }
    return DateTime.now();
  }

  /// 从 trashId 中提取原始 ID
  static String _getOriginalId(String trashId) {
    final parts = trashId.split('_trash_');
    return parts.first;
  }
}
