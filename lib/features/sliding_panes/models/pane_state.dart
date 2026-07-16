
/// 滑动面板栈中单个面板的状态快照
/// ─────────────────────────────────────
/// 对应一篇笔记在 SlidingPanesContainer 中的视图状态
class PaneState {
  final String noteId;           // 对应 NoteModel.id
  final String title;            // 面板标题 (用于堆叠后的垂直显示)
  final bool isStacked;          // 是否已被折叠到左侧堆栈
  final double scrollOffset;     // 面板内部 Markdown 的纵向滚动偏移
  final DateTime openedAt;       // 打开时间戳 (用于排序)

  PaneState({
    required this.noteId,
    required this.title,
    this.isStacked = false,
    this.scrollOffset = 0.0,
    DateTime? openedAt,
  }) : openedAt = openedAt ?? DateTime.now();

  PaneState copyWith({
    String? noteId,
    String? title,
    bool? isStacked,
    double? scrollOffset,
  }) {
    return PaneState(
      noteId: noteId ?? this.noteId,
      title: title ?? this.title,
      isStacked: isStacked ?? this.isStacked,
      scrollOffset: scrollOffset ?? this.scrollOffset,
      openedAt: openedAt,
    );
  }
}

/// 布局常量
class PaneLayout {
  PaneLayout._();

  /// 桌面端面板宽度
  static const double desktopWidth = 400.0;

  /// 移动端面板占屏宽比
  static const double mobileWidthRatio = 0.8;

  /// 堆叠标题栏宽度 (旋转后的可见高度)
  static const double stackedTitleWidth = 36.0;

  /// 堆叠标题栏间距
  static const double stackedTitleGap = 2.0;

  /// 面板间距
  static const double paneGap = 12.0;

  /// 回弹动画时长
  static const Duration bounceDuration = Duration(milliseconds: 350);

  /// 堆叠动画时长
  static const Duration stackDuration = Duration(milliseconds: 300);

  /// 折叠阈值: 面板移出可视区超过此宽度则自动堆叠
  static const double stackThreshold = 120.0;

  /// 面板焦点切换动画时长
  static const Duration paneFocusDuration = Duration(milliseconds: 200);

  /// Hover 动画时长
  static const Duration hoverDuration = Duration(milliseconds: 150);

  // ── 响应式断点 ──
  static const double mobileBreakpoint = 600;
  static const double tabletBreakpoint = 900;

  // ── 分屏布局常量 ──
  static const double minPanelWidth = 240.0;
  static const double splitterWidth = 6.0;

  /// 顶部标签栏高度
  static const double tabBarHeight = 36.0;

  /// 标签项最小宽度
  static const double tabMinWidth = 120.0;
}
