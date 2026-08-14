/// ════════════════════════════════════════════════════════════════════════════
/// 语义引擎: 余弦相似度与混合评分
library;

import 'dart:math';
import '../../../core/models/predictive_link.dart';

/// 计算两个向量的余弦相似度，返回 [0,1]
///
/// 向量维度不一致或存在零向量时返回 0。
double cosineSimilarity(List<double> a, List<double> b) {
  if (a.length != b.length || a.isEmpty) return 0;
  var dot = 0.0, na = 0.0, nb = 0.0;
  for (var i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na == 0 || nb == 0) return 0;
  return dot / (sqrt(na) * sqrt(nb));
}

/// L2 归一化向量
///
/// 零向量（模长为 0）原样返回。
List<double> l2Normalize(List<double> v) {
  var norm = 0.0;
  for (final x in v) {
    norm += x * x;
  }
  if (norm == 0) return v;
  final n = sqrt(norm);
  return v.map((x) => x / n).toList();
}

/// 混合评分结果
class SemanticScoringResult {
  final double semantic; // 语义相似度分
  final double tag; // 共同标签分
  final double title; // 标题/关键词分
  final double total; // 加权总分
  final String reason; // 推荐理由

  const SemanticScoringResult({
    required this.semantic,
    required this.tag,
    required this.title,
    required this.total,
    required this.reason,
  });
}

/// 语义 + 标签 + 标题/关键词 混合评分（权重 0.7 / 0.2 / 0.1）
class SemanticScoring {
  static const double semanticWeight = 0.7;
  static const double tagWeight = 0.2;
  static const double titleWeight = 0.1;
  static const double minThreshold = 0.05;

  /// 综合评分：向量语义相似度 + 标签交集 + 标题关键词命中
  static SemanticScoringResult score({
    required List<double> sourceVector,
    required List<double> targetVector,
    required List<String> sourceTags,
    required List<String> targetTags,
    required String sourceContent,
    required String targetTitle,
    required String targetContent,
  }) {
    final semantic = cosineSimilarity(sourceVector, targetVector);

    // 标签相似度 (Jaccard)
    double tagScore = 0;
    if (sourceTags.isNotEmpty && targetTags.isNotEmpty) {
      final common = sourceTags.where((t) => targetTags.contains(t)).length;
      tagScore = common / (sourceTags.length + targetTags.length - common);
    }

    // 标题关键词命中率
    double titleScore = 0;
    final srcWords =
        PredictiveLinkService.extractKeywords(sourceContent.toLowerCase());
    final titleWords =
        PredictiveLinkService.extractKeywords(targetTitle.toLowerCase());
    if (titleWords.isNotEmpty && srcWords.isNotEmpty) {
      final hit = titleWords.where((w) => srcWords.contains(w)).length;
      titleScore = hit / titleWords.length;
    }

    final total = (semantic * semanticWeight) +
        (tagScore * tagWeight) +
        (titleScore * titleWeight);

    final reasons = <String>[
      if (semantic > 0.25) '语义相关',
      if (tagScore > 0) '共同标签',
      if (titleScore > 0) '标题关联',
    ];
    return SemanticScoringResult(
      semantic: semantic,
      tag: tagScore,
      title: titleScore,
      total: total,
      reason: reasons.isEmpty ? '相关笔记' : reasons.join(' · '),
    );
  }
}
