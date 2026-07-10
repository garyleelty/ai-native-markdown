import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/command_provider.dart';
import '../services/command_registry.dart';

// ──────────────────────────────────────────────
// 命令面板 (Command Palette)
// ──────────────────────────────────────────────
// 类似 VS Code / Obsidian 的 Ctrl+K 命令面板
// 全屏半透明覆盖层 + 居中搜索框 + 可键盘/鼠标操作的命令列表
// ──────────────────────────────────────────────

/// 命令面板入口 Widget
///
/// 作为全局覆盖层放在 Stack 中，通过 Provider 控制显隐。
/// 支持:
///   - Ctrl+K / Cmd+K 打开
///   - 模糊搜索过滤
///   - 上下键导航 + Enter 执行
///   - Escape 关闭
///   - 鼠标悬停选中 + 点击执行
///   - 最近使用命令置顶
class CommandPaletteOverlay extends ConsumerStatefulWidget {
  const CommandPaletteOverlay({super.key});

  @override
  ConsumerState<CommandPaletteOverlay> createState() =>
      _CommandPaletteOverlayState();
}

class _CommandPaletteOverlayState
    extends ConsumerState<CommandPaletteOverlay>
    with SingleTickerProviderStateMixin {
  late final TextEditingController _searchController;
  late final FocusNode _searchFocusNode;
  late final AnimationController _animController;
  late final Animation<double> _fadeAnimation;
  late final Animation<double> _scaleAnimation;

  /// 列表滚动控制器（用于键盘导航时滚动到可见区域）
  final ScrollController _listScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _searchFocusNode = FocusNode();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOut,
    );
    _scaleAnimation = Tween<double>(begin: 0.95, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOutCubic),
    );
    _searchController.addListener(_onSearchChanged);
  }

  void _onSearchChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    _animController.dispose();
    _listScrollController.dispose();
    super.dispose();
  }

  /// 处理面板打开/关闭的动画
  void _handleOpenChange(bool isOpen) {
    if (isOpen) {
      _searchController.clear();
      _animController.forward();
      // 延迟一帧让 build 完成后再请求焦点
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _searchFocusNode.requestFocus();
      });
    } else {
      _animController.reverse();
    }
  }

  /// 处理键盘事件
  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    // Escape: 关闭
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      ref.read(commandPaletteProvider.notifier).close();
      return KeyEventResult.handled;
    }

    // 上箭头: 选中上一条
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      ref.read(commandPaletteProvider.notifier).selectPrevious();
      _scrollToSelected();
      return KeyEventResult.handled;
    }

    // 下箭头: 选中下一条
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      ref.read(commandPaletteProvider.notifier).selectNext();
      _scrollToSelected();
      return KeyEventResult.handled;
    }

    // Enter: 执行选中命令
    if (event.logicalKey == LogicalKeyboardKey.enter) {
      ref.read(commandPaletteProvider.notifier).executeSelected();
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  /// 滚动列表使当前选中项可见
  void _scrollToSelected() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_listScrollController.hasClients) return;
      final state = ref.read(commandPaletteProvider);
      final index = state.selectedIndex;
      final targetOffset = (index * 44.0) - 100.0;
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

    // 监听打开状态变化触发动画
    ref.listen<bool>(
      commandPaletteProvider.select((s) => s.isOpen),
      (prev, next) => _handleOpenChange(next),
    );

    if (!state.isOpen) return const SizedBox.shrink();

    return Focus(
      onKeyEvent: _handleKeyEvent,
      autofocus: true,
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: _buildOverlay(state),
      ),
    );
  }

  Widget _buildOverlay(CommandPaletteState state) {
    return Material(
      color: Colors.black54, // 半透明黑色背景
      child: GestureDetector(
        // 点击背景关闭
        onTap: () => ref.read(commandPaletteProvider.notifier).close(),
        behavior: HitTestBehavior.opaque,
        child: Center(
          child: GestureDetector(
            // 阻止点击面板内部时穿透到背景
            onTap: () {},
            child: ScaleTransition(
              scale: _scaleAnimation,
              child: _buildPanel(state),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPanel(CommandPaletteState state) {
    // 计算面板宽度：响应式，最大 540px
    final screenWidth = MediaQuery.of(context).size.width;
    final panelWidth = screenWidth > 600 ? 540.0 : screenWidth - 48.0;

    // 计算列表高度：每项 44px，最多显示 10 项 + 分隔线
    final itemCount = state.filteredCommands.length;
    final displayCount = itemCount > 10 ? 10 : itemCount;
    final listHeight = displayCount * 44.0 + 36.0; // 36 = 分隔线 + padding

    return Container(
      width: panelWidth,
      constraints: BoxConstraints(maxHeight: listHeight + 68), // 68 = 搜索框高度
      decoration: BoxDecoration(
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AeroColors.border, width: 0.5),
        boxShadow: const [
          BoxShadow(
            color: AeroColors.shadow,
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── 搜索框 ──
          _buildSearchBar(),
          const Divider(height: 1, thickness: 0.5),
          // ── 命令列表 ──
          _buildCommandList(state),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          const Icon(Icons.search, size: 18, color: AeroColors.textSecondary),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: _searchController,
              focusNode: _searchFocusNode,
              onChanged: (query) {
                ref
                    .read(commandPaletteProvider.notifier)
                    .updateSearch(query);
              },
              style: const TextStyle(
                color: AeroColors.textPrimary,
                fontSize: 14,
              ),
              decoration: InputDecoration(
                hintText: '输入命令...',
                hintStyle: const TextStyle(color: AeroColors.textMuted),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close,
                            size: 16, color: AeroColors.textMuted),
                        onPressed: () {
                          _searchController.clear();
                          ref
                              .read(commandPaletteProvider.notifier)
                              .updateSearch('');
                        },
                        splashRadius: 14,
                      )
                    : null,
              ),
            ),
          ),
          // 快捷键提示
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AeroColors.bgSurface,
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: AeroColors.border, width: 0.5),
            ),
            child: const Text(
              'ESC',
              style: TextStyle(
                fontSize: 10,
                color: AeroColors.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommandList(CommandPaletteState state) {
    if (state.filteredCommands.isEmpty) {
      return Container(
        height: 80,
        alignment: Alignment.center,
        child: const Text(
          '没有匹配的命令',
          style: TextStyle(color: AeroColors.textMuted, fontSize: 13),
        ),
      );
    }

    // 区分最近使用和其余命令
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
      constraints: const BoxConstraints(maxHeight: 440),
      child: ListView.builder(
        controller: _listScrollController,
        shrinkWrap: true,
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: items.length + (recent.isNotEmpty && others.isNotEmpty ? 1 : 0),
        itemBuilder: (context, index) {
          // 插入分隔线
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
      onEnter: (_) {
        ref
            .read(commandPaletteProvider.notifier)
            .setSelectedIndex(index);
      },
      child: GestureDetector(
        onTap: () {
          ref.read(commandPaletteProvider.notifier).executeCommand(command);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          height: 44,
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
              // 图标
              Icon(
                command.icon,
                size: 16,
                color: isSelected
                    ? AeroColors.accentBlue
                    : AeroColors.textSecondary,
              ),
              const SizedBox(width: 12),
              // 命令名称
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
              // 分类标签
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
              // 快捷键提示
              if (command.shortcut != null)
                _buildShortcutHint(command.shortcut!),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildShortcutHint(String shortcut) {
    // macOS 上将 Ctrl 替换为 Cmd
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

/// 命令列表项数据（区分最近使用和普通）
class _CommandListItem {
  final CommandDef command;
  final bool isRecent;

  const _CommandListItem({required this.command, required this.isRecent});
}
