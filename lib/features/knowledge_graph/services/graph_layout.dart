import 'dart:math';
import '../models/graph_node.dart';
import '../models/graph_edge.dart';

/// 力导向布局算法引擎
/// ─────────────────────────────
/// 经典 Force-Directed Layout 实现：
///   1. 节点间斥力 — Coulomb 定律: F = k_r / d^2
///   2. 边的引力 — 胡克定律弹簧力: F = k_a * (d - restLength)
///   3. 中心引力 — 防止节点飞散到画布外
///   4. 阻尼 — 每帧衰减速度，最终收敛到平衡态
///
/// 每帧调用 simulate() 一次，返回更新后的节点坐标。
class GraphLayoutEngine {
  /// 斥力系数（节点间相互排斥）
  final double repulsionStrength;

  /// 引力系数（沿边的弹簧力）
  final double attractionStrength;

  /// 阻尼系数（速度衰减，0..1，越大衰减越快）
  final double damping;

  /// 中心引力系数（将节点拉向画布中心）
  final double centerGravity;

  /// 弹簧理想长度（像素）
  final double restLength;

  /// 单帧最大位移（防止爆炸）
  final double maxDisplacement;

  /// 速度收敛阈值（低于此值视为静止）
  final double convergenceThreshold;

  const GraphLayoutEngine({
    this.repulsionStrength = 5000.0,
    this.attractionStrength = 0.005,
    this.damping = 0.85,
    this.centerGravity = 0.01,
    this.restLength = 200.0,
    this.maxDisplacement = 10.0,
    this.convergenceThreshold = 0.1,
  });

  /// 模拟一步：计算所有力，更新节点位置和速度
  ///
  /// [nodes] 节点列表（会被原地修改坐标）
  /// [edges] 边列表
  /// [centerX], [centerY] 画布中心坐标（中心引力的目标点）
  ///
  /// 返回 true 表示已收敛（可以停止动画），false 表示还需继续
  bool simulateOneStep(
    List<GraphNode> nodes,
    List<GraphEdge> edges, {
    double centerX = 0.0,
    double centerY = 0.0,
  }) {
    if (nodes.isEmpty) return true;

    // 构建节点 ID 到索引的映射，加速查找
    final idToIndex = <String, int>{};
    for (int i = 0; i < nodes.length; i++) {
      idToIndex[nodes[i].nodeId] = i;
    }

    // 初始化力的累加器
    final fx = List<double>.filled(nodes.length, 0.0);
    final fy = List<double>.filled(nodes.length, 0.0);

    // ── 1. 计算节点间斥力（所有节点对） ──
    // Coulomb 定律: F = k_r / d^2，方向为从对方指向自身
    for (int i = 0; i < nodes.length; i++) {
      for (int j = i + 1; j < nodes.length; j++) {
        final dx = nodes[i].x - nodes[j].x;
        final dy = nodes[i].y - nodes[j].y;
        // 避免除零：最小距离 1 像素
        final distSq = max(dx * dx + dy * dy, 1.0);
        final dist = sqrt(distSq);

        // 斥力大小: F = k_r / d^2
        final force = repulsionStrength / distSq;

        // 力的方向（单位向量）乘以力的大小
        final forceX = (dx / dist) * force;
        final forceY = (dy / dist) * force;

        // 牛顿第三定律：作用力与反作用力
        fx[i] += forceX;
        fy[i] += forceY;
        fx[j] -= forceX;
        fy[j] -= forceY;
      }
    }

    // ── 2. 计算边的引力（弹簧力） ──
    // 胡克定律: F = k_a * (d - restLength)，方向从自身指向对方
    for (final edge in edges) {
      final i = idToIndex[edge.sourceId];
      final j = idToIndex[edge.targetId];
      if (i == null || j == null) continue;

      final dx = nodes[j].x - nodes[i].x;
      final dy = nodes[j].y - nodes[i].y;
      final dist = max(sqrt(dx * dx + dy * dy), 1.0);

      // 引力大小：与距离和理想长度的差成正比
      // strength 越大，边越"紧"
      final force =
          attractionStrength * (dist - restLength) * edge.strength;

      // 力的方向（从 i 指向 j 的单位向量）
      final forceX = (dx / dist) * force;
      final forceY = (dy / dist) * force;

      fx[i] += forceX;
      fy[i] += forceY;
      fx[j] -= forceX;
      fy[j] -= forceY;
    }

    // ── 3. 计算中心引力 ──
    // 将所有节点轻轻拉向画布中心，防止飞散
    for (int i = 0; i < nodes.length; i++) {
      fx[i] += (centerX - nodes[i].x) * centerGravity;
      fy[i] += (centerY - nodes[i].y) * centerGravity;
    }

    // ── 4. 更新速度和位置 ──
    double totalMovement = 0.0;
    for (int i = 0; i < nodes.length; i++) {
      // 速度叠加力（质量归一化为 1）
      nodes[i].vx = (nodes[i].vx + fx[i]) * damping;
      nodes[i].vy = (nodes[i].vy + fy[i]) * damping;

      // 限制最大位移，防止节点"弹射"
      final displacement =
          sqrt(nodes[i].vx * nodes[i].vx + nodes[i].vy * nodes[i].vy);
      if (displacement > maxDisplacement) {
        final scale = maxDisplacement / displacement;
        nodes[i].vx *= scale;
        nodes[i].vy *= scale;
      }

      // 更新位置
      nodes[i].x += nodes[i].vx;
      nodes[i].y += nodes[i].vy;

      // 累计总位移（用于判断收敛）
      totalMovement += displacement;
    }

    // ── 5. 判断是否收敛 ──
    // 平均位移低于阈值时认为布局稳定
    final avgMovement = totalMovement / nodes.length;
    return avgMovement < convergenceThreshold;
  }

  /// 批量模拟：一次性运行多步直到收敛或达到最大迭代次数
  ///
  /// [nodes] 节点列表
  /// [edges] 边列表
  /// [iterations] 最大迭代次数
  /// [centerX], [centerY] 画布中心坐标
  ///
  /// 返回实际迭代次数
  int simulate(
    List<GraphNode> nodes,
    List<GraphEdge> edges, {
    int iterations = 100,
    double centerX = 0.0,
    double centerY = 0.0,
  }) {
    for (int step = 0; step < iterations; step++) {
      final converged = simulateOneStep(
        nodes,
        edges,
        centerX: centerX,
        centerY: centerY,
      );
      if (converged) return step + 1;
    }
    return iterations;
  }

  /// 初始化节点位置：在给定区域内随机分布
  /// 使用极坐标随机化，避免初始重叠
  static void initializePositions(
    List<GraphNode> nodes, {
    double centerX = 0.0,
    double centerY = 0.0,
    double radius = 300.0,
  }) {
    final random = Random(42); // 固定种子，保证可重现
    for (int i = 0; i < nodes.length; i++) {
      // 均匀分布在圆形区域内
      final angle = 2 * pi * i / nodes.length + random.nextDouble() * 0.5;
      final r = radius * (0.3 + random.nextDouble() * 0.7);
      nodes[i].x = centerX + r * cos(angle);
      nodes[i].y = centerY + r * sin(angle);
      nodes[i].vx = 0.0;
      nodes[i].vy = 0.0;
    }
  }
}
