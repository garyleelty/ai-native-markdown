import 'package:flutter/material.dart';

/// 知识图谱 — 图节点模型
/// ─────────────────────────────
/// 每个节点对应一篇笔记，在力导向布局中受斥力/引力驱动移动。
/// 节点大小根据连接数缩放，颜色根据标签映射到 AeroColors。
class GraphNode {
  /// 唯一标识，对应 NoteModel.id
  final String nodeId;

  /// 显示名称，对应 NoteModel.title
  final String label;

  /// 当前 x 坐标（画布坐标系）
  double x;

  /// 当前 y 坐标（画布坐标系）
  double y;

  /// 节点半径（像素），根据连接数动态计算
  double size;

  /// 节点填充颜色
  Color color;

  /// 与该节点相连的其他节点 ID 列表
  final List<String> connections;

  /// 关联标签列表
  final List<String> tags;

  /// 最后编辑时间
  final DateTime? lastEditedAt;

  /// 是否被选中（单击）
  bool isSelected;

  /// 是否处于悬停状态
  bool isHovered;

  /// 力导向布局用：x 方向速度
  double vx;

  /// 力导向布局用：y 方向速度
  double vy;

  GraphNode({
    required this.nodeId,
    required this.label,
    this.x = 0.0,
    this.y = 0.0,
    this.size = 20.0,
    this.color = const Color(0xFF569CD6),
    this.connections = const [],
    this.tags = const [],
    this.lastEditedAt,
    this.isSelected = false,
    this.isHovered = false,
    this.vx = 0.0,
    this.vy = 0.0,
  });

  /// 根据连接数计算节点大小
  /// 连接越多，节点越大（范围 16~48）
  static double computeSize(int connectionCount) {
    const double minSize = 16.0;
    const double maxSize = 48.0;
    const double growthRate = 3.0;
    return (minSize + connectionCount * growthRate).clamp(minSize, maxSize);
  }

  /// 根据标签列表选择节点颜色
  /// 优先取第一个标签对应的实体色，无标签时使用默认蓝色
  static Color colorFromTags(List<String> tags) {
    if (tags.isEmpty) return const Color(0xFF569CD6); // accentBlue

    // 标签到颜色的映射表
    const tagColorMap = <String, Color>{
      '概念': Color(0xFF569CD6), // accentBlue
      '人物': Color(0xFFC586C0), // accentPurple
      '任务': Color(0xFF4EC9B0), // accentCyan
      '引文': Color(0xFFCE9178), // accentOrange
      '引用': Color(0xFF6A9955), // accentGreen
      'idea': Color(0xFF569CD6),
      'person': Color(0xFFC586C0),
      'task': Color(0xFF4EC9B0),
      'quote': Color(0xFFCE9178),
      'reference': Color(0xFF6A9955),
    };

    for (final tag in tags) {
      final lower = tag.toLowerCase();
      for (final entry in tagColorMap.entries) {
        if (lower.contains(entry.key.toLowerCase())) {
          return entry.value;
        }
      }
    }
    return const Color(0xFF569CD6); // 默认蓝色
  }

  /// 创建副本（不可变模式的 copyWith）
  GraphNode copyWith({
    String? nodeId,
    String? label,
    double? x,
    double? y,
    double? size,
    Color? color,
    List<String>? connections,
    List<String>? tags,
    DateTime? lastEditedAt,
    bool? isSelected,
    bool? isHovered,
    double? vx,
    double? vy,
  }) {
    return GraphNode(
      nodeId: nodeId ?? this.nodeId,
      label: label ?? this.label,
      x: x ?? this.x,
      y: y ?? this.y,
      size: size ?? this.size,
      color: color ?? this.color,
      connections: connections ?? this.connections,
      tags: tags ?? this.tags,
      lastEditedAt: lastEditedAt ?? this.lastEditedAt,
      isSelected: isSelected ?? this.isSelected,
      isHovered: isHovered ?? this.isHovered,
      vx: vx ?? this.vx,
      vy: vy ?? this.vy,
    );
  }
}
