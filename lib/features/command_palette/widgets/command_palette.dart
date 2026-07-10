import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/dialog_header.dart';
import '../../../core/widgets/modal_overlay.dart';
import '../../../core/widgets/search_input.dart';
import '../../../providers/command_provider.dart';
import '../services/command_registry.dart';

class CommandPaletteOverlay extends ConsumerStatefulWidget {
  const CommandPaletteOverlay({super.key});

  @override
  ConsumerState<CommandPaletteOverlay> createState() =>
      _CommandPaletteOverlayState();
}

class _CommandPaletteOverlayState
    extends ConsumerState<CommandPaletteOverlay> {
  late final TextEditingController _searchController;
  late final FocusNode _searchFocusNode;

  final ScrollController _listScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _searchFocusNode = FocusNode();
    _searchController.addListener(_onSearchChanged);
  }

  void _onSearchChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    _listScrollController.dispose();
    super.dispose();
  }

  void _handleOpenChange(bool isOpen) {
    if (isOpen) {
      _searchController.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _searchFocusNode.requestFocus();
      });
    }
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    if (event.logicalKey == LogicalKeyboardKey.escape) {
      ref.read(commandPaletteProvider.notifier).close();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      ref.read(commandPaletteProvider.notifier).selectPrevious();
      _scrollToSelected();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      ref.read(commandPaletteProvider.notifier).selectNext();
      _scrollToSelected();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.enter) {
      ref.read(commandPaletteProvider.notifier).executeSelected();
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  void _scrollToSelected() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_listScrollController.hasClients) return;
      final state = ref.read(commandPaletteProvider);
      final index = state.selectedIndex;
      final targetOffset = (index * 40.0) - 80.0;
      _listScrollController.animateTo(
        targetOffset.clamp(0.0, _listScrollController.position.maxScrollExtent),
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(commandPaletteProvider);

    ref.listen<bool>(
      commandPaletteProvider.select((s) => s.isOpen),
      (prev, next) => _handleOpenChange(next),
    );

    return ModalOverlay(
      isOpen: state.isOpen,
      onClose: () => ref.read(commandPaletteProvider.notifier).close(),
      position: OverlayPosition.topCenter,
      child: Focus(
        onKeyEvent: _handleKeyEvent,
        autofocus: true,
        child: _buildPanel(state),
      ),
    );
  }

  Widget _buildPanel(CommandPaletteState state) {
    final screenWidth = MediaQuery.of(context).size.width;
    final panelWidth = screenWidth > 600 ? 560.0 : screenWidth - 48.0;

    final itemCount = state.filteredCommands.length;
    final displayCount = itemCount > 10 ? 10 : itemCount;
    final hasDivider = state.recentCommands.isNotEmpty &&
        state.filteredCommands.length > state.recentCommands.length;
    final listHeight = displayCount * 40.0 + (hasDivider ? 28.0 : 8.0);

    return DialogContainer(
      width: panelWidth,
      height: null,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DialogHeader(
            icon: Icons.palette_outlined,
            iconColor: AeroColors.accentCyan,
            title: '命令面板',
            badgeText: '${state.filteredCommands.length} 条命令',
            badgeColor: AeroColors.accentCyan,
            onClose: () => ref.read(commandPaletteProvider.notifier).close(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: SearchInput(
              controller: _searchController,
              focusNode: _searchFocusNode,
              hintText: '输入命令名称或关键词...',
              height: 36,
              onChanged: (query) {
                ref.read(commandPaletteProvider.notifier).updateSearch(query);
              },
            ),
          ),
          const Divider(height: 1, thickness: 0.5),
          _buildCommandList(state, listHeight),
        ],
      ),
    );
  }

  Widget _buildCommandList(CommandPaletteState state, double maxHeight) {
    if (state.filteredCommands.isEmpty) {
      return SizedBox(
        height: 80,
        child: Center(
          child: Text(
            state.searchQuery.isEmpty ? '开始输入以搜索命令...' : '没有匹配的命令',
            style: const TextStyle(color: AeroColors.textMuted, fontSize: 13),
          ),
        ),
      );
    }

    final recentIds = state.recentCommands.map((c) => c.id).toSet();
    final recent = state.filteredCommands
        .where((c) => recentIds.contains(c.id))
        .toList();
    final others = state.filteredCommands
        .where((c) => !recentIds.contains(c.id))
        .toList();

    final items = <_CommandListItem>[];
    for (final cmd in recent) {
      items.add(_CommandListItem(command: cmd, isRecent: true));
    }
    for (final cmd in others) {
      items.add(_CommandListItem(command: cmd, isRecent: false));
    }

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: ListView.builder(
        controller: _listScrollController,
        shrinkWrap: true,
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: items.length + (recent.isNotEmpty && others.isNotEmpty ? 1 : 0),
        itemBuilder: (context, index) {
          if (recent.isNotEmpty && others.isNotEmpty && index == recent.length) {
            return _buildDivider();
          }

          final itemIndex = index > recent.length ? index - 1 : index;
          if (itemIndex >= items.length) return const SizedBox.shrink();

          final item = items[itemIndex];
          final globalIndex = itemIndex;
          final isSelected = globalIndex == state.selectedIndex;

          return _buildCommandTile(item.command, isSelected, globalIndex);
        },
      ),
    );
  }

  Widget _buildDivider() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          const Text(
            '最近使用',
            style: TextStyle(
              fontSize: 10,
              color: AeroColors.textMuted,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              height: 0.5,
              color: AeroColors.divider,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommandTile(CommandDef command, bool isSelected, int index) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) {
        ref.read(commandPaletteProvider.notifier).setSelectedIndex(index);
      },
      child: GestureDetector(
        onTap: () {
          ref.read(commandPaletteProvider.notifier).executeCommand(command);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: isSelected
                ? AeroColors.accentBlue.withValues(alpha: 0.12)
                : Colors.transparent,
            border: isSelected
                ? const Border(
                    left: BorderSide(
                      color: AeroColors.accentBlue,
                      width: 2,
                    ),
                  )
                : null,
          ),
          child: Row(
            children: [
              Icon(
                command.icon,
                size: 16,
                color: isSelected
                    ? AeroColors.accentBlue
                    : AeroColors.textSecondary,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  command.name,
                  style: TextStyle(
                    fontSize: 13,
                    color: isSelected
                        ? AeroColors.textPrimary
                        : AeroColors.textSecondary,
                    fontWeight:
                        isSelected ? FontWeight.w500 : FontWeight.normal,
                  ),
                ),
              ),
              if (command.category == CommandCategory.ai)
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: AeroColors.accentPurple.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: const Text(
                    'AI',
                    style: TextStyle(
                      fontSize: 9,
                      color: AeroColors.accentPurple,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              if (command.category == CommandCategory.plugin)
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: AeroColors.accentCyan.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: const Text(
                    '插件',
                    style: TextStyle(
                      fontSize: 9,
                      color: AeroColors.accentCyan,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              if (command.shortcut != null)
                _buildShortcutHint(command.shortcut!),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildShortcutHint(String shortcut) {
    final displayText = shortcut
        .replaceAll('Ctrl+', '⌘')
        .replaceAll('Shift+', '⇧')
        .replaceAll('Alt+', '⌥');

    return Text(
      displayText,
      style: const TextStyle(
        fontSize: 11,
        color: AeroColors.textMuted,
        fontWeight: FontWeight.w400,
      ),
    );
  }
}

class _CommandListItem {
  final CommandDef command;
  final bool isRecent;

  const _CommandListItem({required this.command, required this.isRecent});
}
