/// 知识图谱 — 图边模型
/// ─────────────────────────────
/// 表示两篇笔记之间的链接关系。
/// strength 根据双向链接的引用次数归一化到 0..1。
class GraphEdge {
  /// 源节点 ID
  final String sourceId;

  /// 目标节点 ID
  final String targetId;

  /// 连接强度 0..1
  /// - 0.0: 弱连接（仅单向引用一次）
  /// - 1.0: 强连接（双向多次引用）
  final double strength;

  /// 边的可选标签（如关系类型描述）
  final String? label;

  const GraphEdge({
    required this.sourceId,
    required this.targetId,
    this.strength = 0.5,
    this.label,
  });

  /// 根据双向链接的引用次数计算连接强度
  /// backlinkCount: 源->目标 + 目标->源 的引用总次数
  /// maxExpected: 预期最大引用次数（用于归一化）
  static double computeStrength(int backlinkCount, {int maxExpected = 10}) {
    if (backlinkCount <= 0) return 0.1;
    return (backlinkCount / maxExpected).clamp(0.1, 1.0);
  }

  /// 反转方向（用于检测重复边）
  GraphEdge reverse() {
    return GraphEdge(
      sourceId: targetId,
      targetId: sourceId,
      strength: strength,
      label: label,
    );
  }

  /// 判断两条边是否连接相同的两个节点（忽略方向）
  bool connectsSameNodes(GraphEdge other) {
    return (sourceId == other.sourceId && targetId == other.targetId) ||
        (sourceId == other.targetId && targetId == other.sourceId);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GraphEdge &&
          sourceId == other.sourceId &&
          targetId == other.targetId;

  @override
  int get hashCode => sourceId.hashCode ^ targetId.hashCode;

  @override
  String toString() => 'GraphEdge($sourceId -> $targetId, s=${strength.toStringAsFixed(2)})';
}
