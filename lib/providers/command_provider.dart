import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../features/command_palette/services/command_registry.dart';

// ──────────────────────────────────────────────
// 命令面板状态管理 (Command Palette Provider)
// ──────────────────────────────────────────────
// 管理命令面板的打开状态、搜索过滤、选中项、最近使用
// ──────────────────────────────────────────────

/// 命令面板的不可变状态
class CommandPaletteState {
  /// 命令面板是否打开
  final bool isOpen;

  /// 当前搜索关键字
  final String searchQuery;

  /// 当前选中的命令索引（用于键盘上下导航）
  final int selectedIndex;

  /// 当前过滤后的命令列表
  final List<CommandDef> filteredCommands;

  /// 最近使用的命令
  final List<CommandDef> recentCommands;

  const CommandPaletteState({
    this.isOpen = false,
    this.searchQuery = '',
    this.selectedIndex = 0,
    this.filteredCommands = const [],
    this.recentCommands = const [],
  });

  CommandPaletteState copyWith({
    bool? isOpen,
    String? searchQuery,
    int? selectedIndex,
    List<CommandDef>? filteredCommands,
    List<CommandDef>? recentCommands,
  }) {
    return CommandPaletteState(
      isOpen: isOpen ?? this.isOpen,
      searchQuery: searchQuery ?? this.searchQuery,
      selectedIndex: selectedIndex ?? this.selectedIndex,
      filteredCommands: filteredCommands ?? this.filteredCommands,
      recentCommands: recentCommands ?? this.recentCommands,
    );
  }
}

/// 命令面板 Notifier
class CommandPaletteNotifier extends Notifier<CommandPaletteState> {
  late final CommandRegistry _registry;

  @override
  CommandPaletteState build() {
    _registry = CommandRegistry.instance;
    _registry.ensureInitialized();

    return CommandPaletteState(
      filteredCommands: _registry.allCommands,
      recentCommands: _registry.recentCommands,
    );
  }

  /// 打开命令面板
  void open() {
    state = state.copyWith(
      isOpen: true,
      searchQuery: '',
      selectedIndex: 0,
      filteredCommands: _registry.allCommands,
      recentCommands: _registry.recentCommands,
    );
  }

  /// 关闭命令面板
  void close() {
    state = state.copyWith(isOpen: false);
  }

  /// 切换命令面板打开/关闭状态
  void toggle() {
    if (state.isOpen) {
      close();
    } else {
      open();
    }
  }

  /// 更新搜索关键字并重新过滤命令列表
  void updateSearch(String query) {
    final filtered = _registry.search(query);
    state = state.copyWith(
      searchQuery: query,
      filteredCommands: filtered,
      selectedIndex: 0, // 搜索变更时重置选中项
    );
  }

  /// 选中上一条命令（键盘上箭头）
  void selectPrevious() {
    if (state.filteredCommands.isEmpty) return;
    final newIndex = (state.selectedIndex - 1)
        .clamp(0, state.filteredCommands.length - 1);
    state = state.copyWith(selectedIndex: newIndex);
  }

  /// 选中下一条命令（键盘下箭头）
  void selectNext() {
    if (state.filteredCommands.isEmpty) return;
    final newIndex = (state.selectedIndex + 1)
        .clamp(0, state.filteredCommands.length - 1);
    state = state.copyWith(selectedIndex: newIndex);
  }

  /// 直接设置选中索引（鼠标悬停时使用）
  void setSelectedIndex(int index) {
    if (index >= 0 && index < state.filteredCommands.length) {
      state = state.copyWith(selectedIndex: index);
    }
  }

  /// 执行当前选中的命令
  ///
  /// 返回被执行的命令定义，如果没有选中或命令无 action 则返回 null。
  CommandDef? executeSelected() {
    if (state.filteredCommands.isEmpty) return null;
    if (state.selectedIndex >= state.filteredCommands.length) return null;

    final command = state.filteredCommands[state.selectedIndex];

    // 记录使用
    _registry.recordUsage(command.id);

    // 执行命令
    command.action?.call();

    // 关闭面板
    close();

    // 更新最近使用
    state = state.copyWith(
      recentCommands: _registry.recentCommands,
    );

    return command;
  }

  /// 执行指定命令
  void executeCommand(CommandDef command) {
    _registry.recordUsage(command.id);
    command.action?.call();
    close();
    state = state.copyWith(
      recentCommands: _registry.recentCommands,
    );
  }

  /// 绑定命令的 action 回调
  ///
  /// 由于 CommandRegistry 是纯逻辑层不依赖 Widget，
  /// 需要在 Provider 初始化阶段由 UI 层注入实际的 action。
  void bindAction(String commandId, VoidCallback action) {
    _registry.bindAction(commandId, action);
  }

  /// 批量绑定命令 actions
  void bindActions(Map<String, VoidCallback> actions) {
    _registry.bindActions(actions);
  }
}

/// 命令面板 Provider
final commandPaletteProvider =
    NotifierProvider<CommandPaletteNotifier, CommandPaletteState>(
  CommandPaletteNotifier.new,
);

/// 快捷访问: 命令面板是否打开
final isCommandPaletteOpenProvider = Provider<bool>((ref) {
  return ref.watch(commandPaletteProvider).isOpen;
});
