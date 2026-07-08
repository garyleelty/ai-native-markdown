/// ══════════════════════════════════════════════════
/// Quick Switcher Provider — 快速跳转面板状态管理
/// ══════════════════════════════════════════════════
/// 管理 Quick Switcher 覆盖层的开关、查询、结果列表、选中索引
/// 与最近打开笔记 ID 列表的 Riverpod 集成。
/// ──────────────────────────────────────────────────

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/features/quick_switcher/services/fuzzy_matcher.dart';
import 'package:aeromind/providers/note_provider.dart';

/// Quick Switcher UI 状态（不可变）
class QuickSwitcherState {
  /// 是否打开覆盖层
  final bool isOpen;

  /// 当前查询字符串
  final String query;

  /// 模糊匹配结果列表（按 score 降序，最多 50 条）
  final List<FuzzyMatchResult> results;

  /// 当前选中项索引（用于键盘上下移动）
  final int selectedIndex;

  /// 最近打开的笔记 ID 列表（去重，置顶最新，最多 10 条）
  final List<String> recentNoteIds;

  const QuickSwitcherState({
    this.isOpen = false,
    this.query = '',
    this.results = const [],
    this.selectedIndex = 0,
    this.recentNoteIds = const [],
  });

  QuickSwitcherState copyWith({
    bool? isOpen,
    String? query,
    List<FuzzyMatchResult>? results,
    int? selectedIndex,
    List<String>? recentNoteIds,
  }) {
    return QuickSwitcherState(
      isOpen: isOpen ?? this.isOpen,
      query: query ?? this.query,
      results: results ?? this.results,
      selectedIndex: selectedIndex ?? this.selectedIndex,
      recentNoteIds: recentNoteIds ?? this.recentNoteIds,
    );
  }
}

/// Quick Switcher Notifier
class QuickSwitcherNotifier extends Notifier<QuickSwitcherState> {
  /// 最近打开笔记 ID 列表的上限
  static const int _maxRecentNotes = 10;

  @override
  QuickSwitcherState build() => const QuickSwitcherState();

  /// 打开覆盖层
  ///
  /// 清空 query 与 results，UI 会显示「开始输入...」提示；
  /// 保留 recentNoteIds 以便下次置顶展示。
  void open() {
    state = state.copyWith(
      isOpen: true,
      query: '',
      results: const [],
      selectedIndex: 0,
    );
  }

  /// 关闭覆盖层
  void close() {
    state = state.copyWith(isOpen: false);
  }

  /// 更新查询并重新计算匹配结果
  ///
  /// - q 为空时 results=[]
  /// - q 非空时通过 noteRepositoryProvider 获取候选集，
  ///   调用 FuzzyMatcher.match 计算结果，重置 selectedIndex=0
  Future<void> setQuery(String q) async {
    if (q.isEmpty) {
      state = state.copyWith(query: '', results: const [], selectedIndex: 0);
      return;
    }

    final List<NoteModel> notes =
        await ref.read(noteRepositoryProvider).getAllNotes();
    final results = FuzzyMatcher.match(q, notes);
    state = state.copyWith(query: q, results: results, selectedIndex: 0);
  }

  /// 在 results 范围内循环移动选中索引
  ///
  /// delta 为正向下移动，为负向上移动（modulo 循环）。
  /// 结果为空时不操作。
  void moveSelection(int delta) {
    final count = state.results.length;
    if (count == 0) return;
    // 使用两次 modulo 保证索引非负（兼容负 delta）
    final newIndex =
        ((state.selectedIndex + delta) % count + count) % count;
    state = state.copyWith(selectedIndex: newIndex);
  }

  /// 选中当前项并触发打开回调
  ///
  /// 1. 取当前选中项的 noteId（通过 noteIdSelector 提取）
  /// 2. 调用 onOpen 回调
  /// 3. 记录到 recentNoteIds（去重后置顶，最多 10 条）
  /// 4. 关闭覆盖层
  void selectCurrent(
    String Function(FuzzyMatchResult) noteIdSelector,
    void Function(String noteId) onOpen,
  ) {
    if (state.results.isEmpty) return;
    if (state.selectedIndex < 0 ||
        state.selectedIndex >= state.results.length) {
      return;
    }

    final selected = state.results[state.selectedIndex];
    final noteId = noteIdSelector(selected);

    onOpen(noteId);

    // 去重后置顶，最多保留 10 条
    final updatedRecent = <String>[noteId];
    for (final id in state.recentNoteIds) {
      if (id != noteId && updatedRecent.length < _maxRecentNotes) {
        updatedRecent.add(id);
      }
    }

    state = state.copyWith(
      recentNoteIds: updatedRecent,
      isOpen: false,
    );
  }
}

/// Quick Switcher Provider
final quickSwitcherProvider =
    NotifierProvider<QuickSwitcherNotifier, QuickSwitcherState>(
  QuickSwitcherNotifier.new,
);
