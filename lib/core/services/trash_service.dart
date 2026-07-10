/// ══════════════════════════════════════════════════
/// TrashService — 回收站管理
/// ══════════════════════════════════════════════════
/// 删除笔记时移入回收站，支持恢复和彻底删除。
/// 超过 [retentionDays] 天的回收站项目自动清理。
/// ──────────────────────────────────────────────────
library;

import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/note_model.dart';
import '../services/hive_service.dart';

class TrashService {
  static const _uuid = Uuid();

  static const int retentionDays = 30;

  static Box<NoteModel> get _box => HiveService.trashBox;

  static Future<void> moveToTrash(NoteModel note) async {
    final trashId = '${note.id}_trash_${_uuid.v4()}';
    final now = DateTime.now();
    final trashedNote = note.copyWith(
      id: trashId,
      filePath: note.filePath,
      updatedAt: now,
    );
    await _box.put(trashId, trashedNote);
  }

  static List<NoteModel> getAllTrashed() {
    final results = _box.values.toList();
    results.sort((NoteModel a, NoteModel b) {
      return b.updatedAt.compareTo(a.updatedAt);
    });
    return results;
  }

  static Future<NoteModel?> restore(String trashId) async {
    final note = _box.get(trashId);
    if (note == null) return null;

    final originalId = _getOriginalId(trashId);
    final restored = note.copyWith(
      id: originalId,
      updatedAt: DateTime.now(),
    );

    await _box.delete(trashId);
    return restored;
  }

  static Future<void> deletePermanently(String trashId) async {
    await _box.delete(trashId);
  }

  static Future<void> emptyTrash() async {
    await _box.clear();
  }

  static Future<void> cleanExpired() async {
    final cutoff = DateTime.now().subtract(const Duration(days: retentionDays));
    final keysToDelete = <String>[];

    for (final key in _box.keys) {
      final trashId = key as String;
      final note = _box.get(trashId);
      if (note != null && note.updatedAt.isBefore(cutoff)) {
        keysToDelete.add(trashId);
      }
    }

    for (final key in keysToDelete) {
      await _box.delete(key);
    }
  }

  static String _getOriginalId(String trashId) {
    final parts = trashId.split('_trash_');
    return parts.first;
  }
}
