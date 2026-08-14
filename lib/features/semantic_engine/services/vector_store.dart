/// ══════════════════════════════════════════════════
/// VectorStore — Hive 向量持久化
/// ══════════════════════════════════════════════════
/// 语义引擎的向量存储层:
///   - 以 noteId 为 key 存储 {modelId, vector, updatedAt}
///   - 提供 upsert / get / remove / getAll / clear
///   - 反序列化失败静默回退 (返回 null，跳过损坏记录)
/// ──────────────────────────────────────────────────
library;

import 'package:hive_flutter/hive_flutter.dart';
import '../../../core/services/hive_service.dart';

/// 向量记录
class NoteVectorRecord {
  final String noteId;
  final String modelId;
  final List<double> vector;
  final DateTime updatedAt;
  const NoteVectorRecord({
    required this.noteId,
    required this.modelId,
    required this.vector,
    required this.updatedAt,
  });

  Map<String, dynamic> toMap() => {
        'modelId': modelId,
        'vector': vector,
        'updatedAt': updatedAt.toIso8601String(),
      };

  static NoteVectorRecord? fromMap(String noteId, dynamic raw) {
    if (raw is! Map) return null;
    final vec = raw['vector'];
    if (vec is! List || !vec.every((e) => e is num)) return null;
    try {
      final updatedAt = DateTime.tryParse(raw['updatedAt'] as String? ?? '');
      if (updatedAt == null) return null;
      return NoteVectorRecord(
        noteId: noteId,
        modelId: raw['modelId'] as String? ?? '',
        vector: vec.map((e) => (e as num).toDouble()).toList(),
        updatedAt: updatedAt,
      );
    } on TypeError {
      return null;
    }
  }
}

/// Hive 持久化向量
class VectorStore {
  Box<dynamic> get _box => HiveService.vectorBox;

  Future<void> upsert(NoteVectorRecord record) =>
      _box.put(record.noteId, record.toMap());

  Future<NoteVectorRecord?> get(String noteId) async {
    final raw = await _box.get(noteId);
    return NoteVectorRecord.fromMap(noteId, raw);
  }

  Future<void> remove(String noteId) => _box.delete(noteId);

  Future<List<NoteVectorRecord>> getAll() async {
    final out = <NoteVectorRecord>[];
    for (final key in _box.keys) {
      final rec = NoteVectorRecord.fromMap(key as String, await _box.get(key));
      if (rec != null) out.add(rec);
    }
    return out;
  }

  Future<void> clear() => _box.clear();
}
