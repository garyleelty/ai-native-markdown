import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/graph_provider.dart';
import '../../../providers/pane_provider.dart';
import '../models/graph_node.dart';
import '../models/graph_edge.dart';

/// 知识图谱画布（核心 Widget）
/// ─────────────────────────────
/// 功能：
///   - CustomPainter 绘制节点（圆形 + 标签文字）和边（线条 + 箭头）
///   - 手势支持：双指缩放、单指平移、单击选中、双击聚焦
///   - 力导向布局 Ticker 驱动每帧更新
///   - 选中节点时高亮连接，其他节点半透明
///   - 双击节点跳转到对应笔记
class GraphCanvas extends ConsumerStatefulWidget {
  /// 当画布需要在双击节点时打开笔记的回调
  final void Function(String noteId, String title)? onOpenNote;

  const GraphCanvas({super.key, this.onOpenNote});

  @override
  ConsumerState<GraphCanvas> createState() => _GraphCanvasState();
}

class _GraphCanvasState extends ConsumerState<GraphCanvas>
    with TickerProviderStateMixin {
  /// 布局动画 Ticker —— 每帧驱动力导向模拟
  late AnimationController _layoutController;

  /// 用于检测双击的计时器
  DateTime? _lastTapTime;
  String? _lastTapNodeId;

  /// 当前手势状态
  bool _isPanning = false;
  Offset? _panStartOffset;
  Offset? _panStartGraphOffset;

  @override
  void initState() {
    super.initState();
    // 创建布局动画控制器，约 60fps 驱动模拟
    _layoutController = AnimationController(
      vsync: this,
      duration: const Duration(hours: 1), // 长时间运行，手动停止
    )..addListener(_onLayoutTick);
  }

  @override
  void dispose() {
    _layoutController.dispose();
    super.dispose();
  }

  /// 每帧回调：运行一步布局模拟
  void _onLayoutTick() {
    final notifier = ref.read(graphProvider.notifier);
    final converged = notifier.layoutStep();
    if (converged) {
      _layoutController.stop();
    }
  }

  /// 启动布局动画（如果还未运行）
  void _ensureLayoutRunning() {
    if (!_layoutController.isAnimating) {
      _layoutController.repeat();
    }
  }

  /// 处理单击事件
  void _handleTapUp(TapUpDetails details, Size canvasSize) {
    final state = ref.read(graphProvider);
    final hitNode = _hitTestNode(details.localPosition, canvasSize, state);

    // 检测双击
    final now = DateTime.now();
    if (_lastTapTime != null &&
        now.difference(_lastTapTime!).inMilliseconds < 300 &&
        _lastTapNodeId == hitNode?.nodeId &&
        hitNode != null) {
      // 双击：聚焦节点 + 打开笔记
      _handleDoubleTap(hitNode);
      _lastTapTime = null;
      _lastTapNodeId = null;
      return;
    }

    _lastTapTime = now;
    _lastTapNodeId = hitNode?.nodeId;

    // 单击：选中或取消选中
    ref.read(graphProvider.notifier).selectNode(hitNode?.nodeId);
  }

  /// 处理双击事件
  void _handleDoubleTap(GraphNode node) {
    // 聚焦到节点
    ref.read(graphProvider.notifier).focusNode(node.nodeId);

    // 打开对应的笔记面板
    if (widget.onOpenNote != null) {
      widget.onOpenNote!(node.nodeId, node.label);
    } else {
      // 默认行为：通过 PaneStackProvider 打开
      ref.read(paneStackProvider.notifier).openPane(node.nodeId, node.label);
    }
  }

  /// 处理鼠标悬停（桌面端）
  void _handleHover(Offset localPosition, Size canvasSize) {
    final state = ref.read(graphProvider);
    final hitNode = _hitTestNode(localPosition, canvasSize, state);
    ref.read(graphProvider.notifier).hoverNode(hitNode?.nodeId);
  }

  /// 命中测试：判断点击位置是否在某个节点上
  GraphNode? _hitTestNode(
      Offset localPosition, Size canvasSize, GraphState state) {
    // 将屏幕坐标转换为图谱世界坐标
    final worldPos = _screenToWorld(localPosition, canvasSize, state);

    // 遍历所有可见节点，检测是否命中
    // 优先检测最上层的（后绘制的），所以倒序遍历
    final visibleNodes = state.visibleNodes;
    for (int i = visibleNodes.length - 1; i >= 0; i--) {
      final node = visibleNodes[i];
      final dx = worldPos.dx - node.x;
      final dy = worldPos.dy - node.y;
      final distSq = dx * dx + dy * dy;
      // 命中范围：节点半径 + 4 像素容差
      final hitRadius = node.size + 4;
      if (distSq <= hitRadius * hitRadius) {
        return node;
      }
    }
    return null;
  }

  /// 屏幕坐标 → 图谱世界坐标
  Offset _screenToWorld(Offset screenPos, Size canvasSize, GraphState state) {
    final centerX = canvasSize.width / 2;
    final centerY = canvasSize.height / 2;
    return Offset(
      (screenPos.dx - centerX) / state.zoom - state.panOffset.dx,
      (screenPos.dy - centerY) / state.zoom - state.panOffset.dy,
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(graphProvider);

    // 如果图谱已初始化且布局还在运行，启动 Ticker
    if (state.isInitialized && state.isLayoutRunning) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _ensureLayoutRunning();
      });
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final canvasSize = Size(constraints.maxWidth, constraints.maxHeight);

        return GestureDetector(
          onTapUp: (details) => _handleTapUp(details, canvasSize),
          onPanStart: (details) => _onPanStart(details, canvasSize, state),
          onPanUpdate: (details) => _onPanUpdate(details, canvasSize, state),
          onPanEnd: (_) => _onPanEnd(),
          child: MouseRegion(
            onHover: (event) => _handleHover(event.localPosition, canvasSize),
            onExit: (_) =>
                ref.read(graphProvider.notifier).hoverNode(null),
            child: ClipRect(
              child: CustomPaint(
                painter: _GraphPainter(
                  nodes: state.visibleNodes,
                  edges: state.visibleEdges,
                  selectedNodeId: state.selectedNodeId,
                  hoveredNodeId: state.hoveredNodeId,
                  zoom: state.zoom,
                  panOffset: state.panOffset,
                  canvasSize: canvasSize,
                ),
                size: canvasSize,
              ),
            ),
          ),
        );
      },
    );
  }

  /// 开始平移
  void _onPanStart(
      DragStartDetails details, Size canvasSize, GraphState state) {
    // 检查是否点击在节点上，如果是则不启动平移（让点击事件处理）
    final hitNode = _hitTestNode(details.localPosition, canvasSize, state);
    if (hitNode != null) {
      _isPanning = false;
      return;
    }

    _isPanning = true;
    _panStartOffset = details.localPosition;
    _panStartGraphOffset = state.panOffset;
  }

  /// 平移更新
  void _onPanUpdate(
      DragUpdateDetails details, Size canvasSize, GraphState state) {
    if (!_isPanning || _panStartOffset == null) return;

    final dx = details.localPosition.dx - _panStartOffset!.dx;
    final dy = details.localPosition.dy - _panStartOffset!.dy;

    // 将屏幕像素偏移转换为图谱坐标偏移（考虑缩放）
    ref.read(graphProvider.notifier).updatePanOffset(
          Offset(
            _panStartGraphOffset!.dx + dx / state.zoom,
            _panStartGraphOffset!.dy + dy / state.zoom,
          ),
        );
  }

  /// 结束平移
  void _onPanEnd() {
    _isPanning = false;
    _panStartOffset = null;
    _panStartGraphOffset = null;
  }
}

/// ══════════════════════════════════════════════════
/// 知识图谱 CustomPainter
/// ══════════════════════════════════════════════════
/// 核心绘制逻辑：
///   1. 坐标变换：世界坐标 → 屏幕坐标 (平移 + 缩放)
///   2. 绘制边：线条 + 可选箭头 + 透明度按强度
///   3. 绘制节点：圆形 + 标签文字
///   4. 选中高亮：高亮选中节点及其连接，其余半透明
class _GraphPainter extends CustomPainter {
  final List<GraphNode> nodes;
  final List<GraphEdge> edges;
  final String? selectedNodeId;
  final String? hoveredNodeId;
  final double zoom;
  final Offset panOffset;
  final Size canvasSize;

  _GraphPainter({
    required this.nodes,
    required this.edges,
    this.selectedNodeId,
    this.hoveredNodeId,
    required this.zoom,
    required this.panOffset,
    required this.canvasSize,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // 画布中心点
    final centerX = size.width / 2;
    final centerY = size.height / 2;

    // 构建节点 ID 到节点的映射
    final nodeMap = <String, GraphNode>{};
    for (final node in nodes) {
      nodeMap[node.nodeId] = node;
    }

    // ── 计算高亮集合 ──
    // 选中节点时，只高亮其直接连接
    final highlightIds = <String>{};
    if (selectedNodeId != null) {
      highlightIds.add(selectedNodeId!);
      final selectedNode = nodeMap[selectedNodeId!];
      if (selectedNode != null) {
        highlightIds.addAll(selectedNode.connections);
      }
    }

    // ── 1. 绘制边 ──
    _drawEdges(canvas, centerX, centerY, nodeMap, highlightIds);

    // ── 2. 绘制节点 ──
    _drawNodes(canvas, centerX, centerY, highlightIds);

    // ── 3. 绘制选中节点的光晕 ──
    if (selectedNodeId != null) {
      final selectedNode = nodeMap[selectedNodeId!];
      if (selectedNode != null) {
        _drawGlow(canvas, centerX, centerY, selectedNode);
      }
    }

    // ── 4. 绘制悬停节点的高亮边框 ──
    if (hoveredNodeId != null && hoveredNodeId != selectedNodeId) {
      final hoveredNode = nodeMap[hoveredNodeId!];
      if (hoveredNode != null) {
        _drawHoverHighlight(canvas, centerX, centerY, hoveredNode);
      }
    }
  }

  /// 将世界坐标转换为屏幕坐标
  Offset _worldToScreen(double wx, double wy, double cx, double cy) {
    return Offset(
      cx + (wx + panOffset.dx) * zoom,
      cy + (wy + panOffset.dy) * zoom,
    );
  }

  /// 绘制所有边
  void _drawEdges(
    Canvas canvas,
    double cx,
    double cy,
    Map<String, GraphNode> nodeMap,
    Set<String> highlightIds,
  ) {
    for (final edge in edges) {
      final source = nodeMap[edge.sourceId];
      final target = nodeMap[edge.targetId];
      if (source == null || target == null) continue;

      final start = _worldToScreen(source.x, source.y, cx, cy);
      final end = _worldToScreen(target.x, target.y, cx, cy);

      // 根据是否在高亮集合中决定透明度
      final isHighlighted = highlightIds.isEmpty ||
          (highlightIds.contains(edge.sourceId) &&
              highlightIds.contains(edge.targetId));
      final opacity = isHighlighted ? 0.6 * edge.strength : 0.08;

      // 边的颜色：使用源节点的颜色
      final edgeColor = source.color.withValues(alpha: opacity.clamp(0.0, 1.0));

      // 边的粗细：根据强度和缩放调整
      final strokeWidth = (1.0 + edge.strength * 2.0) * zoom;

      final paint = Paint()
        ..color = edgeColor
        ..strokeWidth = strokeWidth
        ..style = PaintingStyle.stroke;

      // 绘制线条
      canvas.drawLine(start, end, paint);

      // 绘制箭头（在边的终点方向）
      if (isHighlighted && edge.strength > 0.3) {
        _drawArrow(canvas, start, end, edgeColor, strokeWidth);
      }
    }
  }

  /// 绘制箭头
  void _drawArrow(
      Canvas canvas, Offset start, Offset end, Color color, double width) {
    final dx = end.dx - start.dx;
    final dy = end.dy - start.dy;
    final length = sqrt(dx * dx + dy * dy);
    if (length < 10) return; // 边太短不画箭头

    // 单位方向向量
    final ux = dx / length;
    final uy = dy / length;

    // 箭头位置：距离终点一个节点半径的位置
    final arrowX = end.dx - ux * 12 * zoom;
    final arrowY = end.dy - uy * 12 * zoom;

    // 箭头两翼的点
    final arrowSize = 6.0 * zoom;
    final wing1 = Offset(
      arrowX - ux * arrowSize + uy * arrowSize * 0.5,
      arrowY - uy * arrowSize - ux * arrowSize * 0.5,
    );
    final wing2 = Offset(
      arrowX - ux * arrowSize - uy * arrowSize * 0.5,
      arrowY - uy * arrowSize + ux * arrowSize * 0.5,
    );

    final arrowPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path()
      ..moveTo(arrowX, arrowY)
      ..lineTo(wing1.dx, wing1.dy)
      ..lineTo(wing2.dx, wing2.dy)
      ..close();

    canvas.drawPath(path, arrowPaint);
  }

  /// 绘制所有节点
  void _drawNodes(
    Canvas canvas,
    double cx,
    double cy,
    Set<String> highlightIds,
  ) {
    for (final node in nodes) {
      final screenPos = _worldToScreen(node.x, node.y, cx, cy);
      final radius = node.size * zoom;

      // 根据是否在高亮集合中决定透明度
      final isHighlighted =
          highlightIds.isEmpty || highlightIds.contains(node.nodeId);
      final opacity = isHighlighted ? 1.0 : 0.15;

      // ── 绘制节点圆形 ──
      final fillPaint = Paint()
        ..color = node.color.withValues(alpha: opacity * 0.3)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(screenPos, radius, fillPaint);

      final borderPaint = Paint()
        ..color = node.color.withValues(alpha: opacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5 * zoom;
      canvas.drawCircle(screenPos, radius, borderPaint);

      // ── 绘制标签文字 ──
      if (isHighlighted || radius > 8) {
        final textStyle = TextStyle(
          color: AeroColors.textPrimary.withValues(alpha: opacity),
          fontSize: (11.0 * zoom).clamp(8.0, 16.0),
          fontWeight: FontWeight.w500,
        );

        final textSpan = TextSpan(
          text: node.label,
          style: textStyle,
        );

        final textPainter = TextPainter(
          text: textSpan,
          textDirection: TextDirection.ltr,
          maxLines: 1,
        )..layout();

        // 文字位置：节点下方
        final textOffset = Offset(
          screenPos.dx - textPainter.width / 2,
          screenPos.dy + radius + 4 * zoom,
        );

        // 文字背景（提升可读性）
        final bgRect = Rect.fromLTWH(
          textOffset.dx - 3,
          textOffset.dy - 1,
          textPainter.width + 6,
          textPainter.height + 2,
        );
        final bgPaint = Paint()
          ..color = AeroColors.bgDeep.withValues(alpha: 0.8)
          ..style = PaintingStyle.fill;
        canvas.drawRRect(
          RRect.fromRectAndRadius(bgRect, const Radius.circular(3)),
          bgPaint,
        );

        textPainter.paint(canvas, textOffset);
      }
    }
  }

  /// 绘制选中节点的光晕效果
  void _drawGlow(
      Canvas canvas, double cx, double cy, GraphNode node) {
    final screenPos = _worldToScreen(node.x, node.y, cx, cy);
    final radius = node.size * zoom;

    // 多层渐变光晕
    for (int i = 3; i >= 1; i--) {
      final glowRadius = radius + i * 8.0 * zoom;
      final glowPaint = Paint()
        ..color = node.color.withValues(alpha: 0.08 / i)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(screenPos, glowRadius, glowPaint);
    }
  }

  /// 绘制悬停节点的高亮边框
  void _drawHoverHighlight(
      Canvas canvas, double cx, double cy, GraphNode node) {
    final screenPos = _worldToScreen(node.x, node.y, cx, cy);
    final radius = node.size * zoom;

    final highlightPaint = Paint()
      ..color = AeroColors.accentBlue.withValues(alpha: 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0 * zoom;
    canvas.drawCircle(screenPos, radius + 3 * zoom, highlightPaint);
  }

  @override
  bool shouldRepaint(covariant _GraphPainter oldDelegate) {
    // 始终重绘（因为布局在动画中）
    return true;
  }
}
