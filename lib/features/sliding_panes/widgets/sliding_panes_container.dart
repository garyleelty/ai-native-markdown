import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/note_provider.dart';
import '../../../providers/pane_provider.dart';
import '../../../providers/template_provider.dart';
import '../../../providers/quick_switcher_provider.dart';
import '../../../core/models/note_model.dart';
import '../models/pane_state.dart';
import '../../../core/services/file_service.dart';
import '../../../providers/sidebar_provider.dart';

/// ══════════════════════════════════════════════════
/// SlidingPanesContainer
/// ══════════════════════════════════════════════════
/// Andy Matuschak "Sliding Panes" 模式的核心容器
///
/// 职责:
///  1. 横向滚动的笔记面板流
///  2. 左滑时旧面板标题栏顺时针旋转 90° 折叠到左侧
///  3. 左侧垂直标题堆栈支持点击回弹
///  4. 滚动位置同步至 PaneStackNotifier
/// ──────────────────────────────────────────────────
class SlidingPanesContainer extends ConsumerStatefulWidget {
  /// 构建单个面板内容的回调
  final Widget Function(BuildContext context, String noteId, int index)
      paneBuilder;

  const SlidingPanesContainer({
    super.key,
    required this.paneBuilder,
  });

  @override
  ConsumerState<SlidingPanesContainer> createState() =>
      _SlidingPanesContainerState();
}

class _SlidingPanesContainerState
    extends ConsumerState<SlidingPanesContainer>
    with TickerProviderStateMixin {
  late final ScrollController _scrollController;

  /// 堆叠标题的动画控制器 (回弹时使用)
  late final AnimationController _bounceController;

  /// 记录上次布局宽度，避免重复计算
  double _lastLayoutWidth = 0;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController()
      ..addListener(_onScroll);
    _bounceController = AnimationController(
      vsync: this,
      duration: PaneLayout.bounceDuration,
    );
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _bounceController.dispose();
    super.dispose();
  }

  // ── 滚动监听: 判断哪些面板应被折叠 ──
  // 修复: 将 updateScrollX 和 updateStackedStates 合并为一次通知
  void _onScroll() {
    final offset = _scrollController.offset;
    _recalculateStackedPanes(offset);
  }

  /// 根据容器横向滚动偏移，计算哪些面板应该被堆叠
  ///
  /// 核心逻辑:
  ///   面板 i 的左边缘 = 堆叠栏总宽 + i * (panelWidth + gap)
  ///   如果 (左边缘 + panelWidth - scrollOffset) < 0，即完全滚出左侧，
  ///   则该面板标记为 isStacked
  void _recalculateStackedPanes(double scrollOffset) {
    final paneState = ref.read(paneStackProvider);
    final count = paneState.panes.length;
    if (count == 0 || _lastLayoutWidth == 0) return;

    final panelWidth = _getPanelWidth(_lastLayoutWidth);

    final flags = <bool>[];
    double cursorX = 0;

    for (int i = 0; i < count; i++) {
      if (paneState.panes[i].isStacked) {
        // 已堆叠的面板: 游标推进 stackedTitleWidth，保持堆叠状态
        flags.add(true);
        cursorX += PaneLayout.stackedTitleWidth + PaneLayout.stackedTitleGap;
        continue;
      }

      final panelRight = cursorX + panelWidth;
      // 面板右边缘在视口左侧之外 → 堆叠
      final shouldStack =
          panelRight < scrollOffset + PaneLayout.stackThreshold;
      flags.add(shouldStack);

      if (!shouldStack) {
        cursorX += panelWidth + PaneLayout.paneGap;
      }
    }

    // 仅当状态实际变化时才通知 provider (合并 scrollX + stackStates 为一次通知)
    final currentFlags =
        paneState.panes.map((p) => p.isStacked).toList();
    if (!_listEquals(currentFlags, flags)) {
      final notifier = ref.read(paneStackProvider.notifier);
      notifier.updateStackedStates(flags);
    }
    // scrollX 的更新延迟到 build 中通过 ref.watch 统一触发，避免二次 rebuild
  }

  /// 响应式面板宽度计算
  /// 修复: 增加 tablet 断点，渐进式宽度计算避免跳跃
  double _getPanelWidth(double containerWidth) {
    if (containerWidth >= PaneLayout.tabletBreakpoint) {
      // 桌面: 固定 400px
      return PaneLayout.desktopWidth;
    } else if (containerWidth >= PaneLayout.mobileBreakpoint) {
      // 平板: 在 400px ~ 80% 宽度之间线性插值
      final t = (containerWidth - PaneLayout.mobileBreakpoint) /
          (PaneLayout.tabletBreakpoint - PaneLayout.mobileBreakpoint);
      return PaneLayout.desktopWidth +
          (containerWidth * PaneLayout.mobileWidthRatio - PaneLayout.desktopWidth) *
              (1 - t);
    } else {
      // 手机: 80% 宽度
      return containerWidth * PaneLayout.mobileWidthRatio;
    }
  }

  /// 点击堆叠标题 → 平滑滚动回到对应面板
  /// 修复:
  ///   1. targetOffset 需要考虑堆叠栏总宽作为偏移基线
  ///   2. 先计算偏移再一次性更新 state，避免 activatePane 触发
  ///      rebuild 后 ScrollController 失效
  ///   3. 删除冗余的直接 state 赋值，activatePane 已包含 activeIndex
  void _bounceBackToPane(int index) {
    final paneState = ref.read(paneStackProvider);
    final count = paneState.panes.length;
    if (index < 0 || index >= count) return;

    final panelWidth = _getPanelWidth(_lastLayoutWidth);

    // 计算回弹后堆叠栏将缩小到的宽度:
    //   index 之前的面板将全部解除堆叠，堆叠栏仅保留 index 之后的已堆叠面板
    final remainingStackedCount =
        paneState.panes.skip(index + 1).where((p) => p.isStacked).length;
    final newStackedWidth = remainingStackedCount *
            PaneLayout.stackedTitleWidth +
        (remainingStackedCount > 0
            ? (remainingStackedCount - 1) * PaneLayout.stackedTitleGap
            : 0);

    // 目标偏移 = 目标面板在视口中的起始位置
    //   index 之前有 index 个面板 (解除堆叠后全部变为可见)
    double targetOffset =
        index * (panelWidth + PaneLayout.paneGap) - newStackedWidth;
    targetOffset = targetOffset.clamp(
      0.0,
      _scrollController.position.maxScrollExtent,
    );

    // 1) 一次性更新 state (解除堆叠 + 激活面板)
    ref.read(paneStackProvider.notifier).activatePane(index);

    // 2) 在下一帧执行滚动动画，避免 rebuild 导致 ScrollController 失效
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        targetOffset,
        duration: PaneLayout.bounceDuration,
        curve: Curves.easeOutCubic,
      );
    });
  }

  bool _listEquals(List<bool> a, List<bool> b) {
    if (a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        _lastLayoutWidth = constraints.maxWidth;
        final paneState = ref.watch(paneStackProvider);
        final panelWidth = _getPanelWidth(constraints.maxWidth);

        return Row(
          children: [
            // ── 左侧: 垂直堆叠的标题栏 ──
            _buildStackedTitles(paneState),

            // ── 右侧: 横向滚动的面板流 ──
            Expanded(
              child: _buildScrollablePanelStream(
                paneState,
                panelWidth,
              ),
            ),
          ],
        );
      },
    );
  }

  // ──────────────────────────────────────────────
  // 左侧堆叠标题栏
  // ──────────────────────────────────────────────
  Widget _buildStackedTitles(PaneStackState paneState) {
    final stackedPanes = paneState.panes
        .asMap()
        .entries
        .where((e) => e.value.isStacked)
        .toList();

    if (stackedPanes.isEmpty) return const SizedBox.shrink();

    return AnimatedContainer(
      duration: PaneLayout.stackDuration,
      curve: Curves.easeInOut,
      width: stackedPanes.length * PaneLayout.stackedTitleWidth +
          (stackedPanes.length - 1) * PaneLayout.stackedTitleGap,
      child: Column(
        children: stackedPanes.map((entry) {
          final originalIndex = entry.key;
          final pane = entry.value;
          final isActive = originalIndex == paneState.activeIndex;

          return Padding(
            padding: const EdgeInsets.only(
                bottom: PaneLayout.stackedTitleGap),
            child: _StackedTitleBar(
              title: pane.title,
              isActive: isActive,
              onTap: () => _bounceBackToPane(originalIndex),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ──────────────────────────────────────────────
  // 欢迎页面（无面板时显示）
  // ──────────────────────────────────────────────
  Widget _buildEmptyWelcome(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 420),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AeroColors.accentBlue, AeroColors.accentPurple],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(
                  Icons.auto_awesome,
                  size: 40,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                '欢迎使用 AeroMind',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  color: AeroColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'AI Native 笔记 · Sliding Panes · 知识图谱',
                style: TextStyle(
                  fontSize: 13,
                  color: AeroColors.textSecondary,
                ),
              ),
              const SizedBox(height: 40),
              _QuickActionCard(
                icon: Icons.add,
                title: '新建笔记',
                subtitle: 'Ctrl/Cmd + N',
                onTap: () => _createNewNote(context),
              ),
              const SizedBox(height: 8),
              _QuickActionCard(
                icon: Icons.search,
                title: '快速跳转',
                subtitle: 'Ctrl/Cmd + O',
                onTap: () => _openQuickSwitcher(context),
              ),
              const SizedBox(height: 8),
              _QuickActionCard(
                icon: Icons.calendar_today,
                title: '今天的日记',
                subtitle: 'Ctrl/Cmd + D',
                onTap: () => _openTodayNote(context),
              ),
              const SizedBox(height: 8),
              _QuickActionCard(
                icon: Icons.file_open_outlined,
                title: '打开本地文件',
                subtitle: '打开 .md 文件',
                onTap: () => _openLocalFile(context),
              ),
              const SizedBox(height: 32),
              const Text(
                '从左侧侧边栏开始浏览笔记，或使用快捷键快速操作',
                style: TextStyle(
                  fontSize: 11,
                  color: AeroColors.textMuted,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _createNewNote(BuildContext context) {
    final repo = ref.read(noteRepositoryProvider);
    final now = DateTime.now();
    final note = NoteModel(
      id: now.millisecondsSinceEpoch.toString(),
      title: '新笔记',
      rawMarkdown: '# 新笔记\n',
      filePath: '',
      createdAt: now,
      updatedAt: now,
    );
    repo.saveNote(note);
    ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
  }

  void _openQuickSwitcher(BuildContext context) {
    ref.read(quickSwitcherProvider.notifier).open();
  }

  void _openTodayNote(BuildContext context) async {
    try {
      final service = ref.read(dailyNoteServiceProvider);
      final repo = ref.read(noteRepositoryProvider);
      final (note, _) = await service.getTodayNote();
      final existing = await repo.getNote(note.id);
      if (existing == null) {
        await repo.saveNote(note);
      }
      if (context.mounted) {
        ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
      }
    } catch (_) {}
  }

  void _openLocalFile(BuildContext context) async {
    final service = ref.read(filePickerServiceProvider);
    final note = await service.pickAndOpen();
    if (note != null && context.mounted) {
      ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
    }
  }

  // ──────────────────────────────────────────────
  // 横向滚动面板流
  // ──────────────────────────────────────────────
  Widget _buildScrollablePanelStream(
    PaneStackState paneState,
    double panelWidth,
  ) {
    if (paneState.panes.isEmpty) {
      return _buildEmptyWelcome(context);
    }

    // 只渲染未堆叠的面板
    final visiblePanes = paneState.panes
        .asMap()
        .entries
        .where((e) => !e.value.isStacked)
        .toList();

    if (visiblePanes.isEmpty) {
      return Center(
        child: Text(
          '点击左侧标题返回对应面板',
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: AeroColors.textMuted),
        ),
      );
    }

    return SingleChildScrollView(
      controller: _scrollController,
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(
        horizontal: PaneLayout.paneGap,
        vertical: PaneLayout.paneGap,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: visiblePanes.map((entry) {
          final originalIndex = entry.key;
          final pane = entry.value;
          final isActive =
              originalIndex == paneState.activeIndex;

          return Padding(
            padding: const EdgeInsets.only(
                right: PaneLayout.paneGap),
            child: SizedBox(
              width: panelWidth,
              child: _PaneFrame(
                isActive: isActive,
                title: pane.title,
                noteId: pane.noteId,
                index: originalIndex,
                onClose: () => ref
                    .read(paneStackProvider.notifier)
                    .closePane(originalIndex),
                child: widget.paneBuilder(
                  context,
                  pane.noteId,
                  originalIndex,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ══════════════════════════════════════════════════
// 快速操作卡片 Widget
// ══════════════════════════════════════════════════
class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: AeroColors.bgSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AeroColors.border, width: 0.5),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AeroColors.accentBlue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: AeroColors.accentBlue),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AeroColors.textPrimary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AeroColors.textMuted,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, size: 14, color: AeroColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════
// 堆叠标题栏 Widget (旋转 90° 的垂直文字)
// ══════════════════════════════════════════════════
class _StackedTitleBar extends StatelessWidget {
  final String title;
  final bool isActive;
  final VoidCallback onTap;

  const _StackedTitleBar({
    required this.title,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '返回面板: $title',
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
        duration: PaneLayout.stackDuration,
        width: PaneLayout.stackedTitleWidth,
        height: double.infinity, // 填满容器高度
        decoration: AeroTheme.stackedTitleDecoration.copyWith(
          color: isActive
              ? AeroColors.bgHover
              : AeroColors.bgElevated,
          border: Border(
            right: BorderSide(
              color: isActive
                  ? AeroColors.accentBlue
                  : AeroColors.border,
              width: isActive ? 1.5 : 0.5,
            ),
            bottom: const BorderSide(
              color: AeroColors.border,
              width: 0.5,
            ),
          ),
        ),
        child: Center(
          // RotatedBox 顺时针旋转 90° → 文字从下往上阅读
          child: RotatedBox(
            quarterTurns: 1,
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isActive
                        ? AeroColors.accentBlue
                        : AeroColors.textSecondary,
                    fontSize: 11,
                  ),
            ),
          ),
        ),
      ),
    ),
    );
  }
}

// ══════════════════════════════════════════════════
// 面板外框 Widget (含标题栏 + 关闭按钮 + 边框)
// ══════════════════════════════════════════════════
class _PaneFrame extends StatelessWidget {
  final String title;
  final String noteId;
  final int index;
  final bool isActive;
  final VoidCallback onClose;
  final Widget child;

  const _PaneFrame({
    required this.title,
    required this.noteId,
    required this.index,
    required this.isActive,
    required this.onClose,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: PaneLayout.paneFocusDuration,
      decoration: AeroTheme.paneDecoration.copyWith(
        border: Border.all(
          color: isActive
              ? AeroColors.borderActive
              : AeroColors.border,
          width: isActive ? 1.0 : 0.5,
        ),
        boxShadow: [
          BoxShadow(
            color: isActive
                ? AeroColors.accentBlue.withValues(alpha: 0.08)
                : AeroColors.shadow,
            blurRadius: isActive ? 16 : 12,
            offset: const Offset(2, 0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── 面板标题栏 ──
          _PaneTitleBar(
            title: title,
            noteId: noteId,
            index: index,
            isActive: isActive,
            onClose: onClose,
          ),
          const Divider(height: 1, thickness: 0.5),
          // ── 面板内容 ──
          Expanded(child: child),
        ],
      ),
    );
  }
}

/// 面板顶部标题栏 (支持双击编辑)
class _PaneTitleBar extends ConsumerStatefulWidget {
  final String title;
  final String noteId;
  final int index;
  final bool isActive;
  final VoidCallback onClose;

  const _PaneTitleBar({
    required this.title,
    required this.noteId,
    required this.index,
    required this.isActive,
    required this.onClose,
  });

  @override
  ConsumerState<_PaneTitleBar> createState() => _PaneTitleBarState();
}

class _PaneTitleBarState extends ConsumerState<_PaneTitleBar> {
  late final TextEditingController _controller;
  final FocusNode _focusNode = FocusNode();
  bool _isEditing = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.title);
  }

  @override
  void didUpdateWidget(covariant _PaneTitleBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.title != widget.title && !_isEditing) {
      _controller.text = widget.title;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _startEditing() {
    setState(() {
      _isEditing = true;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
      _controller.selection = TextSelection(
        baseOffset: 0,
        extentOffset: _controller.text.length,
      );
    });
  }

  Future<void> _finishEditing() async {
    final newTitle = _controller.text.trim();
    if (newTitle.isEmpty) {
      _controller.text = widget.title;
      setState(() => _isEditing = false);
      return;
    }

    if (newTitle != widget.title) {
      ref.read(paneStackProvider.notifier).updatePaneTitle(widget.index, newTitle);
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(widget.noteId);
      if (note != null) {
        var newMarkdown = note.rawMarkdown;
        final h1Regex = RegExp(r'^#\s+.+$', multiLine: true);
        final h1Match = h1Regex.firstMatch(newMarkdown);
        if (h1Match != null) {
          newMarkdown = newMarkdown.replaceFirst(h1Match.group(0)!, '# $newTitle');
        } else if (newMarkdown.isNotEmpty) {
          newMarkdown = '# $newTitle\n\n$newMarkdown';
        } else {
          newMarkdown = '# $newTitle\n';
        }
        final updated = note.copyWith(
          title: newTitle,
          rawMarkdown: newMarkdown,
          updatedAt: DateTime.now(),
        );
        await repo.saveNote(updated);
        if (FileService.shouldSyncToFile(updated.filePath)) {
          await FileService.syncToFile(updated.filePath, updated.rawMarkdown);
        }
        ref.invalidate(noteByIdProvider(widget.noteId));
        ref.invalidate(allNotesProvider);
        await ref.read(sidebarProvider.notifier).loadNoteTree();
      }
    }

    setState(() => _isEditing = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      color: widget.isActive
          ? AeroColors.bgElevated
          : AeroColors.bgSurface,
      child: Row(
        children: [
          Expanded(
            child: _isEditing
                ? TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontSize: 13,
                          color: AeroColors.textPrimary,
                        ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                      isDense: true,
                    ),
                    onSubmitted: (_) => _finishEditing(),
                    onTapOutside: (_) => _finishEditing(),
                  )
                : GestureDetector(
                    onDoubleTap: _startEditing,
                    behavior: HitTestBehavior.opaque,
                    child: Tooltip(
                      message: '双击重命名',
                      child: Text(
                        widget.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontSize: 13,
                              color: widget.isActive
                                  ? AeroColors.textPrimary
                                  : AeroColors.textSecondary,
                            ),
                      ),
                    ),
                  ),
          ),
          GestureDetector(
            onTap: widget.onClose,
            child: const Icon(
              Icons.close,
              size: 14,
              color: AeroColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}
