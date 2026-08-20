/// ══════════════════════════════════════════════════
/// SemanticSearchProvider — 语义搜索
/// ══════════════════════════════════════════════════
/// 查询语义搜索：模型就绪且查询词非空时返回 Top-K。
/// ──────────────────────────────────────────────────

library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'embedder_manager_provider.dart';
import 'model_status_provider.dart';
import 'vector_index_provider.dart';

/// 语义搜索结果（带分数）
class SemanticHit {
  final String noteId;
  final double score;
  const SemanticHit(this.noteId, this.score);
}

/// 查询语义搜索：模型就绪且查询词非空时返回 Top-K
final semanticSearchProvider =
    FutureProvider.family<List<SemanticHit>, String>((ref, query) async {
  if (query.trim().isEmpty) return const [];
  final status = ref.watch(modelStatusProvider);
  if (status.status != SemanticEngineStatus.ready) return const [];
  var embedder = ref.read(embedderProvider);
  // 生产首次搜索：等待嵌入器创建完成
  embedder ??= await ref.read(embedderManagerProvider.notifier).ready();
  if (embedder == null) return const [];
  final index = ref.read(vectorIndexProvider);
  if (index.vectors.isEmpty) return const [];

  final qv = await embedder.embed(query);
  final hits = await ref.read(vectorIndexProvider.notifier).search(qv, k: 8);
  return hits.map((h) => SemanticHit(h.noteId, h.score)).toList();
});