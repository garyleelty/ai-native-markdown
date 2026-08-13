/// ══════════════════════════════════════════════════
/// SlidingPanesContainer — 横向滑动面板容器
/// ══════════════════════════════════════════════════
/// Andy Matuschak 风格：最多 2 个可见面板，超出自动堆叠；
/// 面板可关闭 / 激活 / 拖动比例；标题支持双击内联编辑，
/// 编辑态中途被移出栈时草稿保留（PaneState.titleEditingDraft）。
/// ──────────────────────────────────────────────────

library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/close_button.dart';
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
/// 计算面板栈的结构性签名，用于选择性订阅。
/// 仅包含会影响布局/渲染的字段（面板列表、激活索引、分屏比例、滚动），
/// 刻意排除 titleEditingDraft，使标题编辑时不会触发整棵面板树重建。
String _paneStructuralKey(PaneStackState s) {
  final panes = s.panes
      .map((p) =>
          '${p.noteId}|${p.title}|${p.isStacked}|${p.editorMode}|${p.scrollOffset}')
      .join(',');
  return '${s.activeIndex}|${s.splitRatio}|${s.containerScrollX}|'
      '${s.scrollRequest?.timestamp}|$panes';
}

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
    extends ConsumerState<SlidingPanesContainer> {
  /// 点击堆叠标题 → 激活对应面板
  void _bounceBackToPane(int index) {
    final paneState = ref.read(paneStackProvider);
    if (index < 0 || index >= paneState.panes.length) return;
    ref.read(paneStackProvider.notifier).activatePane(index);
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // 仅当结构性字段变化时才重建整棵面板树。
        // 标题编辑草稿 (titleEditingDraft) 变化不影响结构，
        // 若直接 watch 整个 provider 会导致每次按键都重建所有面板（卡顿）。
        ref.watch(paneStackProvider.select(_paneStructuralKey));
        final paneState = ref.read(paneStackProvider);

        return Column(
          children: [
            // ── 顶部: 所有已打开面板的横向标签栏 ──
            _buildTabBar(paneState),

            // ── 下方: 可见面板区域 ──
            Expanded(
              child: LayoutBuilder(
                builder: (context, innerConstraints) {
                  return _buildPanelArea(
                    paneState,
                    innerConstraints.maxWidth,
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  // ──────────────────────────────────────────────
  // 顶部横向标签栏 (Chrome 风格)
  // ──────────────────────────────────────────────
  Widget _buildTabBar(PaneStackState paneState) {
    if (paneState.panes.isEmpty) return const SizedBox.shrink();

    return Container(
      height: PaneLayout.tabBarHeight,
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: PaneLayout.paneGap),
        itemCount: paneState.panes.length,
        separatorBuilder: (_, __) => const SizedBox(width: 2),
        itemBuilder: (context, index) {
          final pane = paneState.panes[index];
          final isActive = index == paneState.activeIndex;

          return _PaneTab(
            title: pane.title,
            isActive: isActive,
            onTap: () => _bounceBackToPane(index),
            onClose: () => ref
                .read(paneStackProvider.notifier)
                .closePane(index),
          );
        },
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

  Future<void> _createNewNote(BuildContext context) async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final now = DateTime.now();
      final note = NoteModel(
        id: repo.generateId(),
        title: '新笔记',
        rawMarkdown: '# 新笔记\n',
        filePath: '',
        createdAt: now,
        updatedAt: now,
      );
      final saved = await repo.saveNote(note);
      if (context.mounted) {
        ref.read(paneStackProvider.notifier).openPane(saved.id, saved.title);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('创建笔记失败: $e'), duration: const Duration(seconds: 2)),
        );
      }
    }
  }

  void _openQuickSwitcher(BuildContext context) {
    ref.read(quickSwitcherProvider.notifier).open();
  }

  Future<void> _openTodayNote(BuildContext context) async {
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
    } catch (e) {
      debugPrint('Error opening note: $e');
    }
  }

  Future<void> _openLocalFile(BuildContext context) async {
    try {
      final service = ref.read(filePickerServiceProvider);
      final note = await service.pickAndOpen();
      if (note != null && context.mounted) {
        ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
      }
    } catch (e) {
      debugPrint('Error opening local file: $e');
    }
  }

  // ──────────────────────────────────────────────
  // 可见面板区域 (Chrome 风格分屏)
  // ──────────────────────────────────────────────
  // - 0 个面板: 显示欢迎页
  // - 1 个面板: 占满整个可用宽度
  // - 2 个面板: 左右并排，中间可拖拽分隔条调整宽度
  Widget _buildPanelArea(PaneStackState paneState, double containerWidth) {
    if (paneState.panes.isEmpty) {
      return _buildEmptyWelcome(context);
    }

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

    const padding = EdgeInsets.all(PaneLayout.paneGap);

    if (visiblePanes.length == 1) {
      final entry = visiblePanes.first;
      return Padding(
        padding: padding,
        child: _PaneFrame(
          isActive: true,
          title: entry.value.title,
          noteId: entry.value.noteId,
          index: entry.key,
          onClose: () => ref
              .read(paneStackProvider.notifier)
              .closePane(entry.key),
          child: widget.paneBuilder(
            context,
            entry.value.noteId,
            entry.key,
          ),
        ),
      );
    }

    // 两个可见面板: 左右分屏，可拖拽调整
    final left = visiblePanes[0];
    final right = visiblePanes[1];
    final availableWidth = containerWidth -
        PaneLayout.splitterWidth -
        PaneLayout.paneGap * 2;
    final minRatio = PaneLayout.minPanelWidth / availableWidth;
    final maxRatio = 1 - minRatio;
    final ratio = paneState.splitRatio.clamp(minRatio, maxRatio);
    final leftWidth = availableWidth * ratio;
    final rightWidth = availableWidth - leftWidth;

    return Padding(
      padding: padding,
      child: Row(
        children: [
          SizedBox(
            width: leftWidth,
            child: _PaneFrame(
              isActive: left.key == paneState.activeIndex,
              title: left.value.title,
              noteId: left.value.noteId,
              index: left.key,
              onClose: () => ref
                  .read(paneStackProvider.notifier)
                  .closePane(left.key),
              child: widget.paneBuilder(
                context,
                left.value.noteId,
                left.key,
              ),
            ),
          ),
          _PaneSplitter(
            onUpdate: (delta) {
              final newRatio = ((leftWidth + delta) / availableWidth)
                  .clamp(minRatio, maxRatio);
              ref
                  .read(paneStackProvider.notifier)
                  .setSplitRatio(newRatio);
            },
          ),
          SizedBox(
            width: rightWidth,
            child: _PaneFrame(
              isActive: right.key == paneState.activeIndex,
              title: right.value.title,
              noteId: right.value.noteId,
              index: right.key,
              onClose: () => ref
                  .read(paneStackProvider.notifier)
                  .closePane(right.key),
              child: widget.paneBuilder(
                context,
                right.value.noteId,
                right.key,
              ),
            ),
          ),
        ],
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
// 分屏拖拽分隔条
// ══════════════════════════════════════════════════
class _PaneSplitter extends StatelessWidget {
  final ValueChanged<double> onUpdate;

  const _PaneSplitter({required this.onUpdate});

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.resizeColumn,
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragUpdate: (details) => onUpdate(details.delta.dx),
        child: Container(
          width: PaneLayout.splitterWidth,
          color: Colors.transparent,
          child: Center(
            child: Container(
              width: 2,
              height: double.infinity,
              color: AeroColors.border,
            ),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════
// 顶部标签项 Widget (Chrome 风格)
// ══════════════════════════════════════════════════
class _PaneTab extends StatefulWidget {
  final String title;
  final bool isActive;
  final VoidCallback onTap;
  final VoidCallback onClose;

  const _PaneTab({
    required this.title,
    required this.isActive,
    required this.onTap,
    required this.onClose,
  });

  @override
  State<_PaneTab> createState() => _PaneTabState();
}

class _PaneTabState extends State<_PaneTab> {
  bool _isHovering = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '切换面板: ${widget.title}',
      child: GestureDetector(
        onTap: widget.onTap,
        behavior: HitTestBehavior.opaque,
        child: MouseRegion(
          onEnter: (_) => setState(() => _isHovering = true),
          onExit: (_) => setState(() => _isHovering = false),
          child: AnimatedContainer(
            duration: PaneLayout.hoverDuration,
            constraints: const BoxConstraints(
              minWidth: PaneLayout.tabMinWidth,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: widget.isActive
                  ? AeroColors.bgSurface
                  : _isHovering
                      ? AeroColors.bgHover
                      : Colors.transparent,
              border: Border(
                bottom: BorderSide(
                  color: widget.isActive
                      ? AeroColors.accentBlue
                      : Colors.transparent,
                  width: 2,
                ),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.note_outlined,
                  size: 14,
                  color: widget.isActive
                      ? AeroColors.textPrimary
                      : AeroColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    widget.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      color: widget.isActive
                          ? AeroColors.textPrimary
                          : AeroColors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  width: 18,
                  height: 18,
                  child: AnimatedOpacity(
                    opacity: _isHovering ? 1.0 : 0.0,
                    duration: PaneLayout.hoverDuration,
                    child: Material(
                      color: Colors.transparent,
                      type: MaterialType.circle,
                      child: InkWell(
                        onTap: widget.onClose,
                        customBorder: const CircleBorder(),
                        child: Icon(
                          Icons.close,
                          size: 14,
                          color: widget.isActive
                              ? AeroColors.textPrimary
                              : AeroColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
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

  /// 是否处于编辑态（从 PaneState.titleEditingDraft 派生）
  bool get _isEditing =>
      ref.watch(paneStackProvider).panes
          .where((p) => p.noteId == widget.noteId)
          .firstOrNull
          ?.titleEditingDraft !=
      null;

  @override
  void initState() {
    super.initState();
    // 从 PaneState 恢复草稿（如有），否则用面板标题
    final draft = _readDraft();
    _controller = TextEditingController(text: draft ?? widget.title);
    if (draft != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _focusNode.requestFocus();
        _controller.selection = TextSelection(
          baseOffset: 0,
          extentOffset: _controller.text.length,
        );
      });
    }
  }

  String? _readDraft() {
    final paneState = ref.read(paneStackProvider);
    final idx = paneState.panes.indexWhere((p) => p.noteId == widget.noteId);
    if (idx < 0) return null;
    return paneState.panes[idx].titleEditingDraft;
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
    // 注意：dispose 阶段不可再写入 provider —— 会触发
    // "modify a provider while the widget tree was building" 崩溃。
    // 草稿已在 _onControllerChanged 中实时同步到 PaneState，
    // 因此面板堆叠/移除时草稿自然保留在 state 中，无需此处落库。
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _startEditing() {
    ref
        .read(paneStackProvider.notifier)
        .setPaneTitleDraftByNoteId(widget.noteId, _controller.text);
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _focusNode.requestFocus();
      _controller.selection = TextSelection(
        baseOffset: 0,
        extentOffset: _controller.text.length,
      );
    });
  }

  void _onControllerChanged(String text) {
    // 实时同步草稿到 PaneState。面板树不会因此重建：
    // SlidingPanesContainer 仅选择性订阅结构性字段，标题栏自身
    // 因 _isEditing 订阅而重建属于必要开销（用于显示输入内容）。
    ref
        .read(paneStackProvider.notifier)
        .setPaneTitleDraftByNoteId(widget.noteId, text);
  }

  Future<void> _finishEditing() async {
    final newTitle = _controller.text.trim();
    if (newTitle.isEmpty) {
      _controller.text = widget.title;
      ref
          .read(paneStackProvider.notifier)
          .setPaneTitleDraftByNoteId(widget.noteId, null);
      if (mounted) {
        setState(() {});
      }
      return;
    }

    if (newTitle != widget.title) {
      try {
        ref.read(paneStackProvider.notifier).updatePaneTitle(widget.index, newTitle);
        ref
            .read(paneStackProvider.notifier)
            .setPaneTitleDraftByNoteId(widget.noteId, null);
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
        if (mounted) {
          setState(() {});
        }
      } catch (e) {
        ref
            .read(paneStackProvider.notifier)
            .setPaneTitleDraftByNoteId(widget.noteId, null);
        if (mounted) {
          _controller.text = widget.title;
          setState(() {});
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('重命名失败: $e'), duration: const Duration(seconds: 2)),
          );
        }
      }
    } else {
      ref
          .read(paneStackProvider.notifier)
          .setPaneTitleDraftByNoteId(widget.noteId, null);
      if (mounted) {
        setState(() {});
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: widget.isActive
            ? AeroColors.bgElevated
            : AeroColors.bgSurface,
        border: const Border(
          bottom: BorderSide(color: AeroColors.border, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
              color: widget.isActive
                  ? AeroColors.accentBlue
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _isEditing
                ? TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AeroColors.textPrimary,
                        ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                      isDense: true,
                    ),
                    onChanged: _onControllerChanged,
                    onSubmitted: (_) => _finishEditing(),
                    onTapOutside: (_) => _finishEditing(),
                  )
                : GestureDetector(
                    onDoubleTap: _startEditing,
                    behavior: HitTestBehavior.opaque,
                    child: Tooltip(
                      message: '双击重命名',
                      waitDuration: const Duration(milliseconds: 800),
                      child: Text(
                        widget.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: widget.isActive
                                  ? AeroColors.textPrimary
                                  : AeroColors.textSecondary,
                            ),
                      ),
                    ),
                  ),
          ),
          AeroCloseButton(
            onPressed: widget.onClose,
            size: AeroCloseButtonSize.sm,
          ),
        ],
      ),
    );
  }
}
