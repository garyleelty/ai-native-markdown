/// ══════════════════════════════════════════════════
/// Graph Provider — 知识图谱
/// ══════════════════════════════════════════════════
/// 基于当前面板笔记 + 链接笔记构建图谱（最多 50 节点），
/// 使用力导向布局引擎布局，空数据时生成演示图。
/// ──────────────────────────────────────────────────

library;

import 'dart:ui';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/models/note_model.dart';
import '../features/knowledge_graph/models/graph_node.dart';
import '../features/knowledge_graph/models/graph_edge.dart';
import '../features/knowledge_graph/services/graph_layout.dart';

/// 笔记数据接口（用于图谱构建的通用抽象）
/// NoteModel 和其他数据源均可实现此接口
abstract class NoteData {
  String get id;
  String get title;
  List<String> get tags;
  List<String> get backlinks;
  List<String> get outgoingLinks;
  DateTime get updatedAt;
}

/// NoteModel 的 NoteData 适配扩展
extension NoteModelDataExtension on NoteModel {
  NoteData get asNoteData => _NoteModelAdapter(this);
}

class _NoteModelAdapter implements NoteData {
  final NoteModel _model;
  _NoteModelAdapter(this._model);

  @override String get id => _model.id;
  @override String get title => _model.title;
  @override List<String> get tags => _model.tags;
  @override List<String> get backlinks => _model.backlinks;
  @override List<String> get outgoingLinks => _model.outgoingLinks;
  @override DateTime get updatedAt => _model.updatedAt;
}

/// 知识图谱状态管理
/// ─────────────────────────────
/// 管理图谱的所有状态：节点、边、选中状态、视图变换、过滤条件。
/// 使用 Riverpod Notifier 模式，状态不可变 + copyWith。

// ── 状态类 ──

/// 图谱不可变状态
class GraphState {
  /// 所有节点
  final List<GraphNode> nodes;

  /// 所有边
  final List<GraphEdge> edges;

  /// 当前选中的节点 ID（null 表示未选中）
  final String? selectedNodeId;

  /// 当前悬停的节点 ID（null 表示未悬停）
  final String? hoveredNodeId;

  /// 缩放比例（1.0 = 100%）
  final double zoom;

  /// 平移偏移量（画布坐标系）
  final Offset panOffset;

  /// 过滤标签列表（空列表表示不过滤）
  final List<String> filterTags;

  /// 最小连接数过滤（0 表示不过滤）
  final int minConnections;

  /// 搜索关键词（过滤节点名称）
  final String searchQuery;

  /// 布局是否正在运行
  final bool isLayoutRunning;

  /// 图谱是否已初始化（已从笔记数据构建）
  final bool isInitialized;

  const GraphState({
    this.nodes = const [],
    this.edges = const [],
    this.selectedNodeId,
    this.hoveredNodeId,
    this.zoom = 1.0,
    this.panOffset = Offset.zero,
    this.filterTags = const [],
    this.minConnections = 0,
    this.searchQuery = '',
    this.isLayoutRunning = false,
    this.isInitialized = false,
  });

  /// 获取选中的节点（如果有的话）
  GraphNode? get selectedNode {
    if (selectedNodeId == null) return null;
    try {
      return nodes.firstWhere((n) => n.nodeId == selectedNodeId);
    } catch (_) {
      return null;
    }
  }

  /// 获取悬停的节点（如果有的话）
  GraphNode? get hoveredNode {
    if (hoveredNodeId == null) return null;
    try {
      return nodes.firstWhere((n) => n.nodeId == hoveredNodeId);
    } catch (_) {
      return null;
    }
  }

  /// 获取所有使用中的标签（用于图例）
  Set<String> get allTags {
    final tags = <String>{};
    for (final node in nodes) {
      tags.addAll(node.tags);
    }
    return tags;
  }

  /// 过滤后的可见节点
  List<GraphNode> get visibleNodes {
    return nodes.where((node) {
      // 标签过滤
      if (filterTags.isNotEmpty) {
        if (!node.tags.any((t) => filterTags.contains(t))) return false;
      }
      // 连接数过滤
      if (minConnections > 0) {
        if (node.connections.length < minConnections) return false;
      }
      // 搜索过滤
      if (searchQuery.isNotEmpty) {
        if (!node.label.toLowerCase().contains(searchQuery.toLowerCase())) {
          return false;
        }
      }
      return true;
    }).toList();
  }

  /// 过滤后的可见边（两端节点都可见时才显示）
  List<GraphEdge> get visibleEdges {
    final visibleIds = visibleNodes.map((n) => n.nodeId).toSet();
    return edges.where((e) {
      return visibleIds.contains(e.sourceId) && visibleIds.contains(e.targetId);
    }).toList();
  }

  GraphState copyWith({
    List<GraphNode>? nodes,
    List<GraphEdge>? edges,
    String? selectedNodeId,
    bool clearSelectedNodeId = false,
    String? hoveredNodeId,
    bool clearHoveredNodeId = false,
    double? zoom,
    Offset? panOffset,
    List<String>? filterTags,
    int? minConnections,
    String? searchQuery,
    bool? isLayoutRunning,
    bool? isInitialized,
  }) {
    return GraphState(
      nodes: nodes ?? this.nodes,
      edges: edges ?? this.edges,
      selectedNodeId: clearSelectedNodeId
          ? null
          : (selectedNodeId ?? this.selectedNodeId),
      hoveredNodeId: clearHoveredNodeId
          ? null
          : (hoveredNodeId ?? this.hoveredNodeId),
      zoom: zoom ?? this.zoom,
      panOffset: panOffset ?? this.panOffset,
      filterTags: filterTags ?? this.filterTags,
      minConnections: minConnections ?? this.minConnections,
      searchQuery: searchQuery ?? this.searchQuery,
      isLayoutRunning: isLayoutRunning ?? this.isLayoutRunning,
      isInitialized: isInitialized ?? this.isInitialized,
    );
  }
}

// ── Notifier ──

/// 图谱状态管理器
/// 负责从笔记数据构建图谱、管理布局引擎、处理用户交互。
class GraphNotifier extends Notifier<GraphState> {
  /// 布局引擎实例
  final GraphLayoutEngine _layoutEngine = const GraphLayoutEngine();

  @override
  GraphState build() => const GraphState();

  // ── 从笔记列表构建图谱 ──

  /// 从笔记列表构建知识图谱
  /// 遍历所有笔记，提取双向链接关系，创建节点和边
  void buildFromNotes(List<NoteData> notes) {
    if (notes.isEmpty) return;

    final nodes = <GraphNode>[];
    final edges = <GraphEdge>[];
    final edgeSet = <String>{}; // 用于去重

    // 构建笔记 ID 到笔记的映射
    final noteMap = <String, NoteData>{};
    for (final note in notes) {
      noteMap[note.id] = note;
    }

    // ── 创建节点 ──
    for (final note in notes) {
      // 计算连接数（入链 + 出链）
      final allLinks = <String>{...note.backlinks, ...note.outgoingLinks};
      final connectionCount = allLinks.length;

      nodes.add(GraphNode(
        nodeId: note.id,
        label: note.title,
        size: GraphNode.computeSize(connectionCount),
        color: GraphNode.colorFromTags(note.tags),
        connections: allLinks.toList(),
        tags: note.tags,
        lastEditedAt: note.updatedAt,
      ));
    }

    // ── 创建边 ──
    for (final note in notes) {
      for (final targetId in note.outgoingLinks) {
        // 确保目标笔记存在
        if (!noteMap.containsKey(targetId)) continue;

        // 生成边的唯一键（无向，避免重复）
        final edgeKey = _edgeKey(note.id, targetId);
        if (edgeSet.contains(edgeKey)) continue;
        edgeSet.add(edgeKey);

        // 计算连接强度：统计双向引用总次数
        int backlinkCount = 0;
        // note -> target 的出链
        if (note.outgoingLinks.contains(targetId)) backlinkCount++;
        // target -> note 的入链
        final targetNote = noteMap[targetId];
        if (targetNote != null && targetNote.outgoingLinks.contains(note.id)) {
          backlinkCount++;
        }
        // 还要检查 target 的 backlinks
        if (targetNote != null && targetNote.backlinks.contains(note.id)) {
          backlinkCount++;
        }

        edges.add(GraphEdge(
          sourceId: note.id,
          targetId: targetId,
          strength: GraphEdge.computeStrength(backlinkCount),
        ));
      }

      // 也处理 backlinks（可能有些链接只在 backlinks 中）
      for (final sourceId in note.backlinks) {
        final edgeKey = _edgeKey(sourceId, note.id);
        if (edgeSet.contains(edgeKey)) continue;
        edgeSet.add(edgeKey);

        edges.add(GraphEdge(
          sourceId: sourceId,
          targetId: note.id,
          strength: 0.3, // 仅单向引用，强度较低
        ));
      }
    }

    // ── 初始化节点位置 ──
    GraphLayoutEngine.initializePositions(
      nodes,
      centerX: 0.0,
      centerY: 0.0,
      radius: 300.0,
    );

    // 更新所有节点的 isSelected 状态
    for (int i = 0; i < nodes.length; i++) {
      nodes[i] = nodes[i].copyWith(isSelected: false);
    }

    state = state.copyWith(
      nodes: nodes,
      edges: edges,
      isInitialized: true,
      isLayoutRunning: true,
    );
  }

  /// 生成无向边的唯一键（保证 a-b 和 b-a 生成相同键）
  String _edgeKey(String a, String b) {
    return a.compareTo(b) < 0 ? '$a-$b' : '$b-$a';
  }

  // ── 布局控制 ──

  /// 运行一步布局模拟（由 Ticker 每帧调用）
  /// 返回 true 表示已收敛
  bool layoutStep() {
    if (state.nodes.isEmpty) return true;

    final converged = _layoutEngine.simulateOneStep(
      state.nodes,
      state.edges,
    );

    // 强制刷新 UI（触发重绘）
    state = state.copyWith(
      nodes: List.from(state.nodes),
      isLayoutRunning: !converged,
    );

    return converged;
  }

  /// 重置布局：重新初始化节点位置并重启模拟
  void resetLayout() {
    GraphLayoutEngine.initializePositions(
      state.nodes,
      centerX: 0.0,
      centerY: 0.0,
      radius: 300.0,
    );
    for (int i = 0; i < state.nodes.length; i++) {
      state.nodes[i].vx = 0.0;
      state.nodes[i].vy = 0.0;
    }
    state = state.copyWith(
      nodes: List.from(state.nodes),
      isLayoutRunning: true,
    );
  }

  // ── 交互控制 ──

  /// 选中节点（单击）
  void selectNode(String? nodeId) {
    // 先取消所有节点的选中状态
    final updatedNodes = state.nodes.map((n) {
      return n.copyWith(isSelected: n.nodeId == nodeId);
    }).toList();

    state = state.copyWith(
      nodes: updatedNodes,
      selectedNodeId: nodeId,
      clearSelectedNodeId: nodeId == null,
    );
  }

  /// 悬停节点（鼠标移入）
  void hoverNode(String? nodeId) {
    final updatedNodes = state.nodes.map((n) {
      return n.copyWith(isHovered: n.nodeId == nodeId);
    }).toList();

    state = state.copyWith(
      nodes: updatedNodes,
      hoveredNodeId: nodeId,
      clearHoveredNodeId: nodeId == null,
    );
  }

  /// 聚焦节点（双击）：将视图中心对准该节点
  void focusNode(String nodeId) {
    try {
      final node = state.nodes.firstWhere((n) => n.nodeId == nodeId);
      // 计算需要的平移量，使节点位于视口中心
      state = state.copyWith(
        panOffset: Offset(-node.x, -node.y),
        selectedNodeId: nodeId,
      );
      selectNode(nodeId);
    } catch (_) {
      // 节点不存在，忽略
    }
  }

  // ── 视图控制 ──

  /// 更新缩放比例
  void updateZoom(double zoom) {
    state = state.copyWith(zoom: zoom.clamp(0.1, 3.0));
  }

  /// 更新平移偏移
  void updatePanOffset(Offset offset) {
    state = state.copyWith(panOffset: offset);
  }

  /// 重置视图到初始状态
  void resetView() {
    state = state.copyWith(
      zoom: 1.0,
      panOffset: Offset.zero,
    );
  }

  // ── 过滤控制 ──

  /// 设置标签过滤
  void setFilterTags(List<String> tags) {
    state = state.copyWith(filterTags: tags);
  }

  /// 设置最小连接数过滤
  void setMinConnections(int count) {
    state = state.copyWith(minConnections: count.clamp(0, 100));
  }

  /// 设置搜索关键词
  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
  }

  /// 清除所有过滤
  void clearFilters() {
    state = state.copyWith(
      filterTags: [],
      minConnections: 0,
      searchQuery: '',
    );
  }
}

// ── Provider ──

/// 知识图谱状态 Provider
final graphProvider = NotifierProvider<GraphNotifier, GraphState>(
  GraphNotifier.new,
);
