/// ════════════════════════════════════════════════════════════════════════════
/// VectorIndexProvider — 内存向量索引与最近邻
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/embedding_service.dart';
import '../services/semantic_scoring.dart';
import '../services/vector_store.dart';

/// 嵌入器 Provider（生产用 OnnxEmbedder，测试 override）
///
/// 默认返回 null（回退模式），由模型状态就绪后由外部创建并注入。
final embedderProvider = Provider<Embedder?>((ref) {
  return null;
});

/// 最近邻结果
class Neighbor {
  final String noteId;
  final double score;
  const Neighbor(this.noteId, this.score);
}

/// 向量索引状态：当前模型 + noteId -> 向量的内存映射
class VectorIndexState {
  final String? modelId;
  final Map<String, List<double>> vectors; // noteId -> vector
  final VectorStore store;
  const VectorIndexState({
    this.modelId,
    this.vectors = const {},
    required this.store,
  });
}

/// 内存向量索引 Notifier
class VectorIndexNotifier extends Notifier<VectorIndexState> {
  @override
  VectorIndexState build() {
    // 启动时不阻塞，首次调用前 load()
    return VectorIndexState(store: VectorStore());
  }

  /// 从 Hive 加载全部向量到内存
  Future<void> load() async {
    final records = await state.store.getAll();
    final map = <String, List<double>>{};
    String? modelId;
    for (final r in records) {
      map[r.noteId] = r.vector;
      modelId = r.modelId;
    }
    state = VectorIndexState(modelId: modelId, vectors: map, store: state.store);
  }

  /// 返回某笔记的向量；未索引时返回 null
  List<double>? vectorOf(String noteId) => state.vectors[noteId];

  /// 模型档位与当前已索引模型不一致时需要重嵌入
  bool needsReindex(String modelId) =>
      state.modelId != null && state.modelId != modelId;

  /// 对文本嵌入并持久化到 Hive，同时更新内存索引
  ///
  /// 无嵌入器（回退模式）时直接返回，不产生任何副作用。
  Future<void> embedAndStore(
    String noteId,
    String text, {
    required String modelId,
  }) async {
    final embedder = ref.read(embedderProvider);
    if (embedder == null) return;
    final v = await embedder.embed(text);
    await state.store.upsert(NoteVectorRecord(
      noteId: noteId,
      modelId: modelId,
      vector: v,
      updatedAt: DateTime.now(),
    ));
    state = VectorIndexState(
      modelId: modelId,
      vectors: {...state.vectors, noteId: v},
      store: state.store,
    );
  }

  /// 删除某笔记的向量（内存 + Hive）
  Future<void> remove(String noteId) async {
    await state.store.remove(noteId);
    final next = Map<String, List<double>>.from(state.vectors)..remove(noteId);
    state = VectorIndexState(
      modelId: state.modelId,
      vectors: next,
      store: state.store,
    );
  }

  /// 返回与指定笔记最相似的前 k 个邻居（推荐用）
  Future<List<Neighbor>> nearest(String noteId, {int k = 10}) async {
    final src = state.vectors[noteId];
    if (src == null) return const [];
    final scored = state.vectors.entries
        .where((e) => e.key != noteId)
        .map((e) => Neighbor(e.key, cosineSimilarity(src, e.value)))
        .where((n) => n.score >= 0)
        .toList()
      ..sort((a, b) => b.score.compareTo(a.score));
    return scored.take(k).toList();
  }

  /// 语义检索：按查询向量返回相似度高于阈值的笔记
  Future<List<Neighbor>> search(List<double> queryVector, {int k = 10}) async {
    final scored = state.vectors.entries
        .map((e) => Neighbor(e.key, cosineSimilarity(queryVector, e.value)))
        .where((n) => n.score > 0.15)
        .toList()
      ..sort((a, b) => b.score.compareTo(a.score));
    return scored.take(k).toList();
  }
}

/// 向量索引 Provider
final vectorIndexProvider =
    NotifierProvider<VectorIndexNotifier, VectorIndexState>(
  VectorIndexNotifier.new,
);