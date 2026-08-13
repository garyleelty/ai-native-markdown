/// ══════════════════════════════════════════════════
/// EditorSession Provider — 编辑器会话状态
/// ══════════════════════════════════════════════════
/// 按 noteId 索引存储编辑器的会话级状态，避免 NotePanel 重建
/// (例如面板被堆叠/恢复) 时丢失以下状态：
///   - 撤销/重做历史
///   - 搜索替换栏显示状态
///   - 搜索/替换关键词
/// ──────────────────────────────────────────────────

library;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 单条撤销/重做历史记录
class EditorHistoryItem {
  final TextEditingValue value;
  final DateTime timestamp;

  const EditorHistoryItem({
    required this.value,
    required this.timestamp,
  });
}

/// 单篇笔记的编辑器会话状态
class EditorSessionState {
  /// 撤销栈（最新在末尾）
  final List<EditorHistoryItem> undoStack;

  /// 重做栈
  final List<EditorHistoryItem> redoStack;

  /// 搜索栏是否显示
  final bool showSearchBar;

  /// 是否显示替换输入框
  final bool showReplace;

  /// 搜索关键词
  final String searchText;

  /// 替换文本
  final String replaceText;

  const EditorSessionState({
    this.undoStack = const [],
    this.redoStack = const [],
    this.showSearchBar = false,
    this.showReplace = false,
    this.searchText = '',
    this.replaceText = '',
  });

  EditorSessionState copyWith({
    List<EditorHistoryItem>? undoStack,
    List<EditorHistoryItem>? redoStack,
    bool? showSearchBar,
    bool? showReplace,
    String? searchText,
    String? replaceText,
  }) {
    return EditorSessionState(
      undoStack: undoStack ?? this.undoStack,
      redoStack: redoStack ?? this.redoStack,
      showSearchBar: showSearchBar ?? this.showSearchBar,
      showReplace: showReplace ?? this.showReplace,
      searchText: searchText ?? this.searchText,
      replaceText: replaceText ?? this.replaceText,
    );
  }
}

/// 所有打开笔记的编辑器会话状态集合
class EditorSessionCollection {
  /// 按 noteId 索引的会话状态
  final Map<String, EditorSessionState> sessions;

  const EditorSessionCollection({this.sessions = const {}});

  /// 获取指定笔记的会话状态（不存在则返回默认值）
  EditorSessionState get(String noteId) =>
      sessions[noteId] ?? const EditorSessionState();

  EditorSessionCollection copyWith({
    Map<String, EditorSessionState>? sessions,
  }) {
    return EditorSessionCollection(
      sessions: sessions ?? this.sessions,
    );
  }

  /// 更新某笔记的会话状态
  EditorSessionCollection update(
      String noteId, EditorSessionState Function(EditorSessionState) updater) {
    final current = get(noteId);
    final next = updater(current);
    final newSessions = Map<String, EditorSessionState>.from(sessions);
    newSessions[noteId] = next;
    return EditorSessionCollection(sessions: newSessions);
  }

  /// 移除某笔记的会话状态（笔记关闭时调用）
  EditorSessionCollection remove(String noteId) {
    if (!sessions.containsKey(noteId)) return this;
    final newSessions = Map<String, EditorSessionState>.from(sessions);
    newSessions.remove(noteId);
    return EditorSessionCollection(sessions: newSessions);
  }
}

/// 编辑器会话 Notifier
class EditorSessionNotifier extends Notifier<EditorSessionCollection> {
  @override
  EditorSessionCollection build() => const EditorSessionCollection();

  static const int _maxHistorySize = 100;

  // ── 撤销/重做 ──

  void addToHistory(String noteId, TextEditingValue value) {
    state = state.update(noteId, (s) {
      final undoStack = List<EditorHistoryItem>.from(s.undoStack);
      // 与最后一条相同则跳过
      if (undoStack.isNotEmpty &&
          undoStack.last.value.text == value.text) {
        return s;
      }
      undoStack.add(EditorHistoryItem(
        value: value,
        timestamp: DateTime.now(),
      ));
      if (undoStack.length > _maxHistorySize) {
        undoStack.removeAt(0);
      }
      // 新增历史时清空重做栈
      return s.copyWith(
        undoStack: undoStack,
        redoStack: const [],
      );
    });
  }

  /// 执行撤销：返回新的 TextEditingValue，或 null 表示无法撤销
  TextEditingValue? undo(String noteId, TextEditingValue currentValue) {
    final session = state.get(noteId);
    if (session.undoStack.isEmpty) return null;
    final undoStack = List<EditorHistoryItem>.from(session.undoStack);
    final redoStack = List<EditorHistoryItem>.from(session.redoStack);

    final item = undoStack.removeLast();
    redoStack.add(EditorHistoryItem(
      value: currentValue,
      timestamp: DateTime.now(),
    ));

    state = state.update(noteId, (s) => s.copyWith(
          undoStack: undoStack,
          redoStack: redoStack,
        ));
    return item.value;
  }

  /// 执行重做：返回新的 TextEditingValue，或 null 表示无法重做
  TextEditingValue? redo(String noteId, TextEditingValue currentValue) {
    final session = state.get(noteId);
    if (session.redoStack.isEmpty) return null;
    final undoStack = List<EditorHistoryItem>.from(session.undoStack);
    final redoStack = List<EditorHistoryItem>.from(session.redoStack);

    final item = redoStack.removeLast();
    undoStack.add(EditorHistoryItem(
      value: currentValue,
      timestamp: DateTime.now(),
    ));

    state = state.update(noteId, (s) => s.copyWith(
          undoStack: undoStack,
          redoStack: redoStack,
        ));
    return item.value;
  }

  /// 清空某笔记的历史（通常在 noteId 切换时）
  void clearHistory(String noteId) {
    state = state.update(noteId, (s) => s.copyWith(
          undoStack: const [],
          redoStack: const [],
        ));
  }

  // ── 搜索替换栏 ──

  void setShowSearchBar(String noteId, bool visible) {
    state = state.update(noteId, (s) => s.copyWith(showSearchBar: visible));
  }

  void setShowReplace(String noteId, bool visible) {
    state = state.update(noteId, (s) => s.copyWith(showReplace: visible));
  }

  void setSearchText(String noteId, String text) {
    state = state.update(noteId, (s) => s.copyWith(searchText: text));
  }

  void setReplaceText(String noteId, String text) {
    state = state.update(noteId, (s) => s.copyWith(replaceText: text));
  }

  // ── 生命周期 ──

  /// 笔记关闭时移除会话状态
  void removeSession(String noteId) {
    state = state.remove(noteId);
  }
}

/// 编辑器会话状态 Provider
final editorSessionProvider =
    NotifierProvider<EditorSessionNotifier, EditorSessionCollection>(
  EditorSessionNotifier.new,
);
