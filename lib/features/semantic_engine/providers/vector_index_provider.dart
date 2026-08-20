/// ════════════════════════════════════════════════════════════════════════════
/// VectorIndexProvider — 内存向量索引与最近邻
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/note_model.dart';
import '../services/embedding_service.dart';
import '../services/semantic_scoring.dart';
import '../services/vector_store.dart';
import 'embedder_manager_provider.dart';

/// 嵌入器 Provider（生产用 OnnxEmbedder，测试 override）
///
/// 生产环境委托 EmbedderManager：模型就绪时返回已创建的真实嵌入器，
/// 创建中/未就绪时为 null（回退模式）。测试 override 为 FakeEmbedder。
final embedderProvider = Provider<Embedder?>((ref) {
  return ref.watch(embedderManagerProvider).current;
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
  /// 语义检索的余弦相似度最低阈值
  static const double minCosine = 0.15;

  @override
  VectorIndexState build() {
    // 启动时不阻塞，首次调用前 load()
    return VectorIndexState(store: VectorStore());
  }

  /// 从 Hive 加载全部向量到内存
  ///
  /// 记录中模型档位不一致（如中断的重索引）时 modelId 置空，
  /// 使 needsReindex 恒为 true，强制触发重嵌入。
  Future<void> load() async {
    final records = await state.store.getAll();
    final map = <String, List<double>>{};
    final modelIds = <String>{};
    for (final r in records) {
      map[r.noteId] = r.vector;
      if (r.modelId.isNotEmpty) modelIds.add(r.modelId);
    }
    final modelId = modelIds.length == 1 ? modelIds.first : null;
    state = VectorIndexState(modelId: modelId, vectors: map, store: state.store);
  }

  /// 返回某笔记的向量；未索引时返回 null
  List<double>? vectorOf(String noteId) => state.vectors[noteId];

  /// 模型档位与当前已索引模型不一致时需要重嵌入
  ///
  /// 空库（modelId 为 null）视为未索引，任何目标模型都触发重嵌入。
  bool needsReindex(String modelId) => state.modelId != modelId;

  /// 对文本嵌入并持久化到 Hive，同时更新内存索引
  ///
  /// 无嵌入器（回退模式）时跳过并返回 false；成功嵌入返回 true。
  /// 生产首次嵌入会等待 EmbedderManager 完成嵌入器创建。
  Future<bool> embedAndStore(
    String noteId,
    String text, {
    required String modelId,
  }) async {
    var embedder = ref.read(embedderProvider);
    // 生产首次嵌入：等待 EmbedderManager 完成嵌入器创建
    embedder ??= await ref.read(embedderManagerProvider).ready();
    if (embedder == null) return false;
    final v = List<double>.of(await embedder.embed(text));
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
    return true;
  }

  /// 删除某笔记的向量（内存 + Hive）
  Future<void> remove(String noteId) async {    await state.store.remove(noteId);
    final next = Map<String, List<double>>.from(state.vectors)..remove(noteId);
    state = VectorIndexState(
      modelId: state.modelId,
      vectors: next,
      store: state.store,
    );
  }

  /// 全量重嵌入：对全部笔记以指定模型档位重新嵌入并覆盖旧向量
  ///
  /// 无嵌入器（回退模式）时各条 embedAndStore 会跳过，仅上报进度。
  Future<void> reindexAll(
    List<NoteModel> notes,
    String modelId, {
    required void Function(int done, int total) onProgress,
  }) async {
    var done = 0;
    for (final note in notes) {
      await embedAndStore(note.id, '${note.title}\n${note.rawMarkdown}',
          modelId: modelId);
      done++;
      onProgress(done, notes.length);
    }
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
        .where((n) => n.score > minCosine)
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