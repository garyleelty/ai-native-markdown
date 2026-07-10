import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../features/sliding_panes/models/pane_state.dart';

// ──────────────────────────────────────────────
// 面板栈状态管理 (Riverpod Notifier)
// ──────────────────────────────────────────────
// 管理所有打开的面板列表、堆叠状态、滚动偏移
// 当面板栈变化时自动触发 AI 上下文重组

/// 面板栈的不可变状态
class PaneStackState {
  final List<PaneState> panes;       // 所有面板 (按打开顺序)
  final int activeIndex;             // 当前激活面板索引
  final double containerScrollX;     // 容器横向滚动偏移
  final ScrollRequest? scrollRequest; // 滚动请求 (一次性)

  const PaneStackState({
    this.panes = const [],
    this.activeIndex = 0,
    this.containerScrollX = 0.0,
    this.scrollRequest,
  });

  /// 获取当前所有可见 (未堆叠) 面板 ID 列表
  List<String> get visiblePaneIds =>
      panes.where((p) => !p.isStacked).map((p) => p.noteId).toList();

  /// 获取所有已堆叠面板 ID 列表
  List<String> get stackedPaneIds =>
      panes.where((p) => p.isStacked).map((p) => p.noteId).toList();

  /// 当前激活面板 ID
  String? get activeNoteId =>
      panes.isNotEmpty ? panes[activeIndex].noteId : null;

  PaneStackState copyWith({
    List<PaneState>? panes,
    int? activeIndex,
    double? containerScrollX,
    ScrollRequest? scrollRequest,
    bool clearScrollRequest = false,
  }) {
    return PaneStackState(
      panes: panes ?? this.panes,
      activeIndex: activeIndex ?? this.activeIndex,
      containerScrollX: containerScrollX ?? this.containerScrollX,
      scrollRequest: clearScrollRequest
          ? null
          : (scrollRequest ?? this.scrollRequest),
    );
  }
}

/// 滚动请求 (一次性命令模式)
class ScrollRequest {
  final String noteId;
  final double offset;
  final DateTime timestamp;

  ScrollRequest({
    required this.noteId,
    required this.offset,
  }) : timestamp = DateTime.now();
}

/// 面板栈 Notifier —— 核心业务逻辑层
class PaneStackNotifier extends Notifier<PaneStackState> {
  @override
  PaneStackState build() => const PaneStackState();

  // ── 打开新面板 ──
  void openPane(String noteId, String title) {
    // 检查是否已打开，如已打开则直接激活
    final existingIndex =
        state.panes.indexWhere((p) => p.noteId == noteId);
    if (existingIndex >= 0) {
      activatePane(existingIndex);
      return;
    }
    final newPane = PaneState(noteId: noteId, title: title);
    final updatedPanes = [...state.panes, newPane];
    state = state.copyWith(
      panes: updatedPanes,
      activeIndex: updatedPanes.length - 1,
    );
  }

  // ── 关闭面板 ──
  void closePane(int index) {
    if (index < 0 || index >= state.panes.length) return;
    final updatedPanes = [...state.panes]..removeAt(index);
    if (updatedPanes.isEmpty) {
      state = state.copyWith(
        panes: const [],
        activeIndex: 0,
      );
      return;
    }
    var newActive = state.activeIndex;
    if (state.activeIndex >= updatedPanes.length) {
      newActive = updatedPanes.length - 1;
    } else if (state.activeIndex > index) {
      newActive = state.activeIndex - 1;
    }
    state = state.copyWith(
      panes: updatedPanes,
      activeIndex: newActive,
    );
  }

  void closePaneByNoteId(String noteId) {
    final index = state.panes.indexWhere((p) => p.noteId == noteId);
    if (index >= 0) {
      closePane(index);
    }
  }

  // ── 激活面板 (用于从堆栈回弹) ──
  void activatePane(int index) {
    if (index < 0 || index >= state.panes.length) return;

    // 如果该面板是堆叠状态，先解除堆叠
    final updatedPanes = [...state.panes];
    if (updatedPanes[index].isStacked) {
      updatedPanes[index] = updatedPanes[index].copyWith(isStacked: false);
    }
    state = state.copyWith(panes: updatedPanes, activeIndex: index);
  }

  // ── 将指定面板标记为堆叠 ──
  void stackPane(int index) {
    if (index < 0 || index >= state.panes.length) return;
    final updatedPanes = [...state.panes];
    updatedPanes[index] = updatedPanes[index].copyWith(isStacked: true);
    state = state.copyWith(panes: updatedPanes);
  }

  // ── 批量更新堆叠状态 (由 SlidingPanesContainer 的滚动回调触发) ──
  void updateStackedStates(List<bool> stackedFlags) {
    if (stackedFlags.length != state.panes.length) return;
    final updatedPanes = <PaneState>[];
    for (int i = 0; i < state.panes.length; i++) {
      updatedPanes.add(state.panes[i].copyWith(isStacked: stackedFlags[i]));
    }
    state = state.copyWith(panes: updatedPanes);
  }

  // ── 更新容器横向滚动偏移 ──
  void updateScrollX(double offsetX) {
    state = state.copyWith(containerScrollX: offsetX);
  }

  // ── 更新某面板的内部纵向滚动偏移 ──
  void updatePaneScrollOffset(int index, double offset) {
    if (index < 0 || index >= state.panes.length) return;
    final updatedPanes = [...state.panes];
    updatedPanes[index] =
        updatedPanes[index].copyWith(scrollOffset: offset);
    state = state.copyWith(panes: updatedPanes);
  }

  // ── 请求某面板滚动到指定偏移 ──
  void scrollTo(String noteId, double offset) {
    state = state.copyWith(
      scrollRequest: ScrollRequest(noteId: noteId, offset: offset),
    );
  }

  // ── 清除滚动请求 (消费后调用) ──
  void clearScrollRequest() {
    state = state.copyWith(clearScrollRequest: true);
  }

  // ── 更新面板标题 ──
  void updatePaneTitle(int index, String newTitle) {
    if (index < 0 || index >= state.panes.length) return;
    final updatedPanes = [...state.panes];
    updatedPanes[index] = updatedPanes[index].copyWith(title: newTitle);
    state = state.copyWith(panes: updatedPanes);
  }

  // ── 打开所有面板的标题列表 (供 AI 上下文使用) ──
  List<String> get openPaneTitles =>
      state.panes.map((p) => p.title).toList();
}

/// 全局面板栈 Provider
final paneStackProvider =
    NotifierProvider<PaneStackNotifier, PaneStackState>(
  PaneStackNotifier.new,
);

// ──────────────────────────────────────────────
// AI 上下文聚合 Provider
// ──────────────────────────────────────────────
// 当可见面板列表变化时自动重算上下文窗口

/// 聚合当前视图中所有可见面板的文本，作为 AI Context
final aiContextProvider = Provider<AIContext>((ref) {
  final paneState = ref.watch(paneStackProvider);

  return AIContext(
    visiblePaneIds: paneState.visiblePaneIds,
    activePaneId: paneState.activeNoteId,
    stackedPaneIds: paneState.stackedPaneIds,
  );
});

class AIContext {
  final List<String> visiblePaneIds;
  final String? activePaneId;
  final List<String> stackedPaneIds;

  const AIContext({
    required this.visiblePaneIds,
    this.activePaneId,
    required this.stackedPaneIds,
  });
}
