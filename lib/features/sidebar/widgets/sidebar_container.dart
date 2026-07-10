/// ══════════════════════════════════════════════════
/// SidebarContainer — 侧边栏主容器
/// ══════════════════════════════════════════════════
/// VS Code 风格侧边栏，含:
///   - 笔记树 (文件浏览器)
///   - 全局搜索
///   - 标签浏览
///   - 大纲/目录
///   - 最近编辑
///   - 插件面板入口
/// ──────────────────────────────────────────────────

library;

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/models/note_model.dart';
import '../../../core/services/search_service.dart';
import '../../../core/services/task_service.dart';
import '../../../providers/sidebar_provider.dart';
import '../../../providers/note_provider.dart';
import '../../../providers/pane_provider.dart';
import '../models/sidebar_state.dart';
import '../../calendar/widgets/calendar_view.dart';
import '../../outline/widgets/outline_panel.dart';
import '../../backlinks/widgets/backlinks_panel.dart';
import 'trash_panel.dart';

/// 侧边栏主容器 — VS Code 风格：左侧纵向活动栏 + 可拖拽宽度的内容面板
class SidebarContainer extends ConsumerStatefulWidget {
  final void Function(String noteId, String title)? onNoteSelected;

  const SidebarContainer({super.key, this.onNoteSelected});

  @override
  ConsumerState<SidebarContainer> createState() => _SidebarContainerState();
}

class _SidebarContainerState extends ConsumerState<SidebarContainer> {
  bool _isDragging = false;

  @override
  Widget build(BuildContext context) {
    final sidebarState = ref.watch(sidebarProvider);
    final totalWidth = sidebarState.isExpanded
        ? SidebarLayout.activityBarWidth + sidebarState.width + SidebarLayout.resizerWidth
        : SidebarLayout.activityBarWidth;

    return AnimatedContainer(
      duration: _isDragging ? Duration.zero : const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      width: totalWidth,
      child: Row(
        children: [
          // ── 纵向活动栏 (始终可见) ──
          _ActivityBar(
            isExpanded: sidebarState.isExpanded,
            currentView: sidebarState.currentView,
            onToggle: () => ref.read(sidebarProvider.notifier).toggleExpanded(),
          ),

          // ── 内容面板 (展开时可见) ──
          if (sidebarState.isExpanded)
            Expanded(
              child: _SidebarContent(onNoteSelected: widget.onNoteSelected),
            ),

          // ── 拖拽调整宽度 ──
          if (sidebarState.isExpanded)
            _Resizer(
              onDragStart: () => setState(() => _isDragging = true),
              onDragEnd: () => setState(() => _isDragging = false),
              onDragUpdate: (delta) {
                final current = ref.read(sidebarProvider).width;
                ref.read(sidebarProvider.notifier).setWidth(current + delta);
              },
            ),
        ],
      ),
    );
  }
}

/// 侧边栏内容区
class _SidebarContent extends ConsumerWidget {
  final void Function(String noteId, String title)? onNoteSelected;

  const _SidebarContent({this.onNoteSelected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sidebarProvider);

    return Container(
      decoration: const BoxDecoration(
        color: AeroColors.bgSurface,
        border: Border(
          right: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Column(
        children: [
          // ── 内容区标题（显示当前视图名称 + 折叠按钮）──
          _SidebarContentHeader(currentView: state.currentView),
          const Divider(height: 1, thickness: 0.5),
          // ── 内容区 ──
          Expanded(
            child: switch (state.currentView) {
              SidebarView.noteTree => _NoteTreeView(onNoteSelected: onNoteSelected),
              SidebarView.calendar => const CalendarView(),
              SidebarView.search => _SearchView(onNoteSelected: onNoteSelected),
              SidebarView.tags => _TagView(onNoteSelected: onNoteSelected),
              SidebarView.recent => _RecentView(onNoteSelected: onNoteSelected),
              SidebarView.plugins => const _PluginPlaceholder(),
              SidebarView.outline => OutlinePanel(
                  onHeadingTap: (offset) {
                    final activeNoteId = ref.read(paneStackProvider).activeNoteId;
                    if (activeNoteId != null) {
                      ref.read(paneStackProvider.notifier).scrollTo(
                            activeNoteId,
                            offset.toDouble(),
                          );
                    }
                  },
                ),
              SidebarView.backlinks => BacklinksPanel(
                  onNoteTap: (noteId, title) {
                    onNoteSelected?.call(noteId, title);
                  },
                ),
              SidebarView.tasks => _TaskView(onNoteSelected: onNoteSelected),
              SidebarView.trash => TrashPanel(
                  onRestore: () {
                    ref.read(sidebarProvider.notifier).loadNoteTree();
                  },
                  onClose: () {
                    ref.read(sidebarProvider.notifier)
                        .switchView(SidebarView.noteTree);
                  },
                ),
            },
          ),
        ],
      ),
    );
  }
}

/// 纵向活动栏 (VS Code 风格左侧图标列)
class _ActivityBar extends ConsumerWidget {
  final bool isExpanded;
  final SidebarView currentView;
  final VoidCallback onToggle;

  const _ActivityBar({
    required this.isExpanded,
    required this.currentView,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(sidebarProvider.notifier);

    return Container(
      width: SidebarLayout.activityBarWidth,
      decoration: const BoxDecoration(
        color: AeroColors.bgDeep,
        border: Border(
          right: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 8),
          _ActivityIcon(
            icon: Icons.article_outlined,
            isActive: currentView == SidebarView.noteTree && isExpanded,
            tooltip: '笔记树',
            onTap: () {
              if (currentView == SidebarView.noteTree && isExpanded) {
                notifier.collapse();
              } else {
                notifier.showNoteTree();
                if (!isExpanded) notifier.expand();
              }
            },
          ),
          _ActivityIcon(
            icon: Icons.calendar_today,
            isActive: currentView == SidebarView.calendar && isExpanded,
            tooltip: '日历',
            onTap: () {
              if (currentView == SidebarView.calendar && isExpanded) {
                notifier.collapse();
              } else {
                notifier.showCalendar();
                if (!isExpanded) notifier.expand();
              }
            },
          ),
          _ActivityIcon(
            icon: Icons.search,
            isActive: currentView == SidebarView.search && isExpanded,
            tooltip: '搜索',
            onTap: () {
              if (currentView == SidebarView.search && isExpanded) {
                notifier.collapse();
              } else {
                notifier.showSearch();
                if (!isExpanded) notifier.expand();
              }
            },
          ),
          _ActivityIcon(
            icon: Icons.sell_outlined,
            isActive: currentView == SidebarView.tags && isExpanded,
            tooltip: '标签',
            onTap: () {
              if (currentView == SidebarView.tags && isExpanded) {
                notifier.collapse();
              } else {
                notifier.showTags();
                if (!isExpanded) notifier.expand();
              }
            },
          ),
          _ActivityIcon(
            icon: Icons.schedule,
            isActive: currentView == SidebarView.recent && isExpanded,
            tooltip: '最近',
            onTap: () {
              if (currentView == SidebarView.recent && isExpanded) {
                notifier.collapse();
              } else {
                notifier.showRecent();
                if (!isExpanded) notifier.expand();
              }
            },
          ),
          _ActivityIcon(
            icon: Icons.list_alt,
            isActive: currentView == SidebarView.outline && isExpanded,
            tooltip: '大纲',
            onTap: () {
              if (currentView == SidebarView.outline && isExpanded) {
                notifier.collapse();
              } else {
                notifier.showOutline();
                if (!isExpanded) notifier.expand();
              }
            },
          ),
          _ActivityIcon(
            icon: Icons.link,
            isActive: currentView == SidebarView.backlinks && isExpanded,
            tooltip: '反向链接',
            onTap: () {
              if (currentView == SidebarView.backlinks && isExpanded) {
                notifier.collapse();
              } else {
                notifier.showBacklinks();
                if (!isExpanded) notifier.expand();
              }
            },
          ),
          _ActivityIcon(
            icon: Icons.check_box_outlined,
            isActive: currentView == SidebarView.tasks && isExpanded,
            tooltip: '任务',
            onTap: () => notifier.showTasks(),
          ),
          _ActivityIcon(
            icon: Icons.delete_outline,
            isActive: currentView == SidebarView.trash && isExpanded,
            tooltip: '回收站',
            onTap: () {
              notifier.switchView(SidebarView.trash);
              if (!isExpanded) notifier.expand();
            },
          ),
          const Spacer(),
          _ActivityIcon(
            icon: Icons.chevron_left,
            isActive: false,
            tooltip: isExpanded ? '折叠侧边栏' : '展开侧边栏',
            onTap: onToggle,
            iconRotation: isExpanded ? 0 : pi,
          ),
          _ActivityIcon(
            icon: Icons.extension_outlined,
            isActive: currentView == SidebarView.plugins && isExpanded,
            tooltip: '插件',
            onTap: () {
              if (currentView == SidebarView.plugins && isExpanded) {
                notifier.collapse();
              } else {
                notifier.showPlugins();
                if (!isExpanded) notifier.expand();
              }
            },
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

/// 单个活动栏图标
class _ActivityIcon extends StatelessWidget {
  final IconData icon;
  final bool isActive;
  final String tooltip;
  final VoidCallback onTap;
  final double iconRotation;

  const _ActivityIcon({
    required this.icon,
    required this.isActive,
    required this.tooltip,
    required this.onTap,
    this.iconRotation = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      preferBelow: false,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          width: 36,
          height: 36,
          margin: const EdgeInsets.symmetric(vertical: 2),
          decoration: BoxDecoration(
            border: isActive
                ? const Border(
                    left: BorderSide(color: AeroColors.accentBlue, width: 2),
                  )
                : null,
          ),
          child: Transform.rotate(
            angle: iconRotation,
            child: Icon(
              icon,
              size: 18,
              color: isActive ? AeroColors.accentBlue : AeroColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

/// 拖拽调整宽度的分隔条
class _Resizer extends StatelessWidget {
  final VoidCallback onDragStart;
  final VoidCallback onDragEnd;
  final ValueChanged<double> onDragUpdate;

  const _Resizer({
    required this.onDragStart,
    required this.onDragEnd,
    required this.onDragUpdate,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onPanStart: (_) => onDragStart(),
      onPanEnd: (_) => onDragEnd(),
      onPanUpdate: (details) => onDragUpdate(details.delta.dx),
      child: MouseRegion(
        cursor: SystemMouseCursors.resizeColumn,
        child: Container(
          width: SidebarLayout.resizerWidth,
          color: Colors.transparent,
          child: Center(
            child: Container(
              width: 1,
              color: AeroColors.divider,
            ),
          ),
        ),
      ),
    );
  }
}

/// 侧边栏内容区标题栏
class _SidebarContentHeader extends ConsumerWidget {
  final SidebarView currentView;

  const _SidebarContentHeader({required this.currentView});

  String get _viewName {
    switch (currentView) {
      case SidebarView.noteTree: return '笔记';
      case SidebarView.calendar: return '日历';
      case SidebarView.search: return '搜索';
      case SidebarView.tags: return '标签';
      case SidebarView.recent: return '最近编辑';
      case SidebarView.plugins: return '插件';
      case SidebarView.outline: return '大纲';
      case SidebarView.backlinks: return '反向链接';
      case SidebarView.tasks: return '任务';
      case SidebarView.trash: return '回收站';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          Text(
            _viewName,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AeroColors.textSecondary,
              letterSpacing: 0.5,
            ),
          ),
          const Spacer(),
          if (currentView == SidebarView.noteTree)
            IconButton(
              icon: const Icon(Icons.add, size: 16, color: AeroColors.textSecondary),
              tooltip: '新建笔记',
              onPressed: () => _showNewNoteFromHeader(context, ref),
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              padding: EdgeInsets.zero,
            ),
        ],
      ),
    );
  }

  void _showNewNoteFromHeader(BuildContext context, WidgetRef ref) {
    showDialog<void>(
      context: context,
      builder: (ctx) => _NewNoteDialog(
        onSubmit: (title) => _createNote(ctx, title, ref),
      ),
    );
  }

  Future<void> _createNote(BuildContext ctx, String title, WidgetRef ref) async {
    if (title.trim().isEmpty) {
      ScaffoldMessenger.of(ctx).showSnackBar(
        const SnackBar(content: Text('标题不能为空'), duration: Duration(seconds: 2)),
      );
      return;
    }
    try {
      final repo = ref.read(noteRepositoryProvider);
      final now = DateTime.now();
      final trimmedTitle = title.trim();
      final note = NoteModel(
        id: repo.generateId(),
        title: trimmedTitle,
        rawMarkdown: '# $trimmedTitle\n\n',
        filePath: '',
        createdAt: now,
        updatedAt: now,
      );
      final saved = await repo.saveNote(note);
      await ref.read(sidebarProvider.notifier).loadNoteTree();
      if (ctx.mounted) {
        Navigator.pop(ctx);
        ref.read(paneStackProvider.notifier).openPane(saved.id, saved.title);
      }
    } catch (e) {
      if (ctx.mounted) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(content: Text('创建笔记失败: $e'), duration: const Duration(seconds: 2)),
        );
      }
    }
  }
}

class _NewNoteDialog extends StatefulWidget {
  final void Function(String title) onSubmit;

  const _NewNoteDialog({required this.onSubmit});

  @override
  State<_NewNoteDialog> createState() => _NewNoteDialogState();
}

class _NewNoteDialogState extends State<_NewNoteDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    widget.onSubmit(_controller.text);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AeroColors.bgElevated,
      title: const Text('新建笔记', style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
      content: TextField(
        controller: _controller,
        autofocus: true,
        style: const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
        decoration: const InputDecoration(
          hintText: '输入笔记标题...',
          hintStyle: TextStyle(color: AeroColors.textMuted),
          isDense: true,
        ),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
        ),
        TextButton(
          onPressed: _submit,
          child: const Text('创建', style: TextStyle(color: AeroColors.accentBlue)),
        ),
      ],
    );
  }
}

/// 笔记树视图
class _NoteTreeView extends ConsumerStatefulWidget {
  final void Function(String noteId, String title)? onNoteSelected;

  const _NoteTreeView({this.onNoteSelected});

  @override
  ConsumerState<_NoteTreeView> createState() => _NoteTreeViewState();
}

class _NoteTreeViewState extends ConsumerState<_NoteTreeView> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(sidebarProvider);

    // 如果树为空，触发加载
    if (state.noteTree.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(sidebarProvider.notifier).loadNoteTree();
      });
    }

    return Column(
      children: [
        // ── 打开文件按钮 ──
        _OpenFileButtons(onNoteSelected: widget.onNoteSelected),

        // ── 笔记列表 ──
        Expanded(
          child: state.noteTree.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.article_outlined,
                          size: 32, color: AeroColors.textMuted),
                      SizedBox(height: 8),
                      Text(
                        '暂无笔记',
                        style: TextStyle(
                            color: AeroColors.textMuted, fontSize: 12),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: state.noteTree.length,
                  itemBuilder: (context, index) {
                    final node = state.noteTree[index];
                    final isSelected = node.id == state.selectedNoteId;
                    return _NoteTreeTile(
                      node: node,
                      isSelected: isSelected,
                      onNoteSelected: widget.onNoteSelected,
                      onTap: () {
                        ref.read(sidebarProvider.notifier).selectNote(node.id);
                        widget.onNoteSelected?.call(node.id, node.title);
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }
}

/// 打开文件按钮组
class _OpenFileButtons extends ConsumerWidget {
  final void Function(String noteId, String title)? onNoteSelected;

  const _OpenFileButtons({this.onNoteSelected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: _SidebarActionButton(
              icon: Icons.file_open_outlined,
              label: '打开文件',
              tooltip: '直接打开本地 .md 文件',
              onTap: () => _openFile(context, ref, import: false),
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: _SidebarActionButton(
              icon: Icons.note_add_outlined,
              label: '导入文件',
              tooltip: '导入本地 .md 文件到笔记库',
              onTap: () => _openFile(context, ref, import: true),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openFile(BuildContext context, WidgetRef ref, {required bool import}) async {
    try {
      final service = ref.read(filePickerServiceProvider);
      final NoteModel? note;

      if (import) {
        note = await service.pickAndImport();
      } else {
        note = await service.pickAndOpen();
      }

      if (note != null) {
        onNoteSelected?.call(note.id, note.title);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('打开文件失败: $e'), duration: const Duration(seconds: 2)),
        );
      }
    }
  }
}

/// 侧边栏操作按钮
class _SidebarActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final String tooltip;
  final VoidCallback onTap;

  const _SidebarActionButton({
    required this.icon,
    required this.label,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          height: 28,
          decoration: BoxDecoration(
            color: AeroColors.bgDeep,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: AeroColors.border, width: 0.5),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: AeroColors.accentBlue),
              const SizedBox(width: 4),
              Text(
                label,
                style: const TextStyle(
                  color: AeroColors.textPrimary,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 笔记树节点
class _NoteTreeTile extends ConsumerStatefulWidget {
  final NoteTreeNode node;
  final bool isSelected;
  final VoidCallback onTap;
  final void Function(String noteId, String title)? onNoteSelected;

  const _NoteTreeTile({
    required this.node,
    required this.isSelected,
    required this.onTap,
    this.onNoteSelected,
  });

  @override
  ConsumerState<_NoteTreeTile> createState() => _NoteTreeTileState();
}

class _NoteTreeTileState extends ConsumerState<_NoteTreeTile> {
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: widget.onTap,
      onSecondaryTap: _showContextMenu,
      onLongPress: _showContextMenu,
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        color: widget.isSelected
            ? AeroColors.accentBlue.withValues(alpha: 0.1)
            : Colors.transparent,
        child: Row(
          children: [
            Icon(
              widget.node.isFolder
                  ? (widget.node.isExpanded
                      ? Icons.folder_open
                      : Icons.folder_outlined)
                  : Icons.description_outlined,
              size: 14,
              color: widget.node.isFolder
                  ? AeroColors.accentOrange
                  : AeroColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                widget.node.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  color: widget.isSelected
                      ? AeroColors.accentBlue
                      : AeroColors.textPrimary,
                ),
              ),
            ),
            if (widget.node.tags.isNotEmpty)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: AeroColors.accentPurple.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(3),
                ),
                child: Text(
                  widget.node.tags.first,
                  style: const TextStyle(
                    color: AeroColors.accentPurple,
                    fontSize: 9,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showContextMenu() {
    final renderBox = context.findRenderObject() as RenderBox?;
    if (renderBox == null) return;
    final offset = renderBox.localToGlobal(Offset.zero);
    final position = RelativeRect.fromLTRB(
      offset.dx,
      offset.dy + renderBox.size.height,
      offset.dx + renderBox.size.width,
      offset.dy + renderBox.size.height,
    );

    showMenu<String>(
      context: context,
      position: position,
      color: AeroColors.bgElevated,
      items: _buildMenuItems(),
    ).then((value) {
      if (value == null) return;
      switch (value) {
        case 'rename':
          _showRenameDialog();
          break;
        case 'duplicate':
          _duplicateNote();
          break;
        case 'delete':
          _confirmDelete();
          break;
        case 'new_note':
          // 文件夹新建笔记（暂未实现多层文件夹）
          break;
      }
    });
  }

  List<PopupMenuEntry<String>> _buildMenuItems() {
    if (widget.node.isFolder) {
      return [
        const PopupMenuItem(
          value: 'rename',
          child: Row(
            children: [
              Icon(Icons.edit, size: 16, color: AeroColors.textSecondary),
              SizedBox(width: 8),
              Text('重命名',
                  style: TextStyle(color: AeroColors.textPrimary, fontSize: 12)),
            ],
          ),
        ),
      ];
    } else {
      return [
        const PopupMenuItem(
          value: 'rename',
          child: Row(
            children: [
              Icon(Icons.edit, size: 16, color: AeroColors.textSecondary),
              SizedBox(width: 8),
              Text('重命名',
                  style: TextStyle(color: AeroColors.textPrimary, fontSize: 12)),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'duplicate',
          child: Row(
            children: [
              Icon(Icons.copy, size: 16, color: AeroColors.textSecondary),
              SizedBox(width: 8),
              Text('复制笔记',
                  style: TextStyle(color: AeroColors.textPrimary, fontSize: 12)),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'delete',
          child: Row(
            children: [
              Icon(Icons.delete_outline, size: 16, color: AeroColors.error),
              SizedBox(width: 8),
              Text('删除', style: TextStyle(color: AeroColors.error, fontSize: 12)),
            ],
          ),
        ),
      ];
    }
  }

  void _showRenameDialog() {
    showDialog<void>(
      context: context,
      builder: (ctx) => _RenameNoteDialog(
        initialTitle: widget.node.title,
        onSubmit: (newTitle) => _doRename(ctx, newTitle),
      ),
    );
  }

  Future<void> _doRename(BuildContext ctx, String newTitle) async {
    if (newTitle.trim().isEmpty || newTitle.trim() == widget.node.title) {
      Navigator.pop(ctx);
      return;
    }
    try {
      await ref
          .read(sidebarProvider.notifier)
          .renameNote(widget.node.id, newTitle.trim());
      if (ctx.mounted) Navigator.pop(ctx);
    } catch (e) {
      if (ctx.mounted) {
        Navigator.pop(ctx);
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(content: Text('重命名失败: $e'), duration: const Duration(seconds: 2)),
        );
      }
    }
  }

  Future<void> _duplicateNote() async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(widget.node.id);
      if (note == null) return;

      final now = DateTime.now();
      var duplicatedMarkdown = note.rawMarkdown;
      final h1Regex = RegExp(r'^#\s+.+$', multiLine: true);
      final h1Match = h1Regex.firstMatch(duplicatedMarkdown);
      if (h1Match != null) {
        duplicatedMarkdown = duplicatedMarkdown.replaceFirst(h1Match.group(0)!, '# ${note.title} 副本');
      } else if (duplicatedMarkdown.isNotEmpty) {
        duplicatedMarkdown = '# ${note.title} 副本\n\n$duplicatedMarkdown';
      } else {
        duplicatedMarkdown = '# ${note.title} 副本\n';
      }
      final duplicated = NoteModel(
        id: repo.generateId(),
        title: '${note.title} 副本',
        rawMarkdown: duplicatedMarkdown,
        filePath: '',
        createdAt: now,
        updatedAt: now,
        tags: note.tags,
        folderPath: note.folderPath,
      );
      await repo.saveNote(duplicated);
      await ref.read(sidebarProvider.notifier).loadNoteTree();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('复制笔记失败: $e'), duration: const Duration(seconds: 2)),
        );
      }
    }
  }

  void _confirmDelete() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text('确认删除',
            style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
        content: Text(
          '确定要删除「${widget.node.title}」吗？\n笔记将移到回收站，可从侧边栏恢复。',
          style: const TextStyle(color: AeroColors.textSecondary, fontSize: 12),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
          ),
          TextButton(
            onPressed: () async {
              try {
                await ref.read(sidebarProvider.notifier).deleteNote(widget.node.id);
                if (ctx.mounted) Navigator.pop(ctx);
              } catch (e) {
                if (ctx.mounted) {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    SnackBar(content: Text('删除失败: $e'), duration: const Duration(seconds: 2)),
                  );
                }
              }
            },
            child: const Text('删除', style: TextStyle(color: AeroColors.error)),
          ),
        ],
      ),
    );
  }
}

class _RenameNoteDialog extends StatefulWidget {
  final String initialTitle;
  final void Function(String newTitle) onSubmit;

  const _RenameNoteDialog({
    required this.initialTitle,
    required this.onSubmit,
  });

  @override
  State<_RenameNoteDialog> createState() => _RenameNoteDialogState();
}

class _RenameNoteDialogState extends State<_RenameNoteDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialTitle);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    widget.onSubmit(_controller.text);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AeroColors.bgElevated,
      title: const Text('重命名笔记',
          style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
      content: TextField(
        controller: _controller,
        autofocus: true,
        style: const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
        decoration: const InputDecoration(
          hintText: '新标题...',
          hintStyle: TextStyle(color: AeroColors.textMuted),
          isDense: true,
        ),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
        ),
        TextButton(
          onPressed: _submit,
          child: const Text('确定', style: TextStyle(color: AeroColors.accentBlue)),
        ),
      ],
    );
  }
}

/// 搜索视图
class _SearchView extends ConsumerStatefulWidget {
  final void Function(String noteId, String title)? onNoteSelected;

  const _SearchView({this.onNoteSelected});

  @override
  ConsumerState<_SearchView> createState() => _SearchViewState();
}

class _SearchViewState extends ConsumerState<_SearchView> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTextChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  void _onTextChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(sidebarProvider);

    return Column(
      children: [
        // 搜索输入框
        Padding(
          padding: const EdgeInsets.all(8),
          child: TextField(
            controller: _controller,
            focusNode: _focusNode,
            style: const TextStyle(
                color: AeroColors.textPrimary, fontSize: 12),
            decoration: InputDecoration(
              hintText: '搜索笔记...',
              hintStyle: const TextStyle(color: AeroColors.textMuted),
              prefixIcon:
                  const Icon(Icons.search, size: 16, color: AeroColors.textMuted),
              suffixIcon: _controller.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.close,
                          size: 14, color: AeroColors.textMuted),
                      onPressed: () {
                        _controller.clear();
                        ref.read(sidebarProvider.notifier).clearSearch();
                      },
                      splashRadius: 12,
                    )
                  : null,
              filled: true,
              fillColor: AeroColors.bgDeep,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: const BorderSide(color: AeroColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide:
                    const BorderSide(color: AeroColors.border, width: 0.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide:
                    const BorderSide(color: AeroColors.accentBlue, width: 1),
              ),
              isDense: true,
            ),
            onChanged: (q) {
              setState(() {});
              ref.read(sidebarProvider.notifier).search(q);
            },
          ),
        ),

        // 搜索状态
        if (state.isSearching)
          const Padding(
            padding: EdgeInsets.all(16),
            child: SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: AeroColors.accentBlue),
            ),
          ),

        // 搜索提示信息（如正则降级警告）
        if (state.searchMessage != null && !state.isSearching)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Row(
                children: [
                  const Icon(Icons.info_outline,
                      size: 12, color: AeroColors.accentOrange),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      state.searchMessage!,
                      style: const TextStyle(
                          color: AeroColors.accentOrange, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
          ),

        // 结果计数或无结果提示
        if (state.searchQuery.isNotEmpty && !state.isSearching)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: state.searchResults.isEmpty
                  ? const Text(
                      '未找到匹配的笔记',
                      style: TextStyle(
                          color: AeroColors.textMuted, fontSize: 11),
                    )
                  : Text(
                      '${state.searchResults.length} 个结果',
                      style: const TextStyle(
                          color: AeroColors.textMuted, fontSize: 11),
                    ),
            ),
          ),

        // 结果列表或空状态
        Expanded(
          child: state.searchQuery.isNotEmpty &&
                  !state.isSearching &&
                  state.searchResults.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.search_off,
                          size: 32, color: AeroColors.textMuted),
                      SizedBox(height: 8),
                      Text(
                        '未找到匹配的笔记',
                        style: TextStyle(
                            color: AeroColors.textMuted, fontSize: 12),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  itemCount: state.searchResults.length,
                  itemBuilder: (context, index) {
                    final result = state.searchResults[index];
                    return _SearchResultTile(
                      result: result,
                      query: state.searchQuery,
                      onTap: () {
                        widget.onNoteSelected
                            ?.call(result.note.id, result.note.title);
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }
}

/// 搜索结果项
class _SearchResultTile extends StatelessWidget {
  final SearchResult result;
  final String query;
  final VoidCallback onTap;

  const _SearchResultTile({
    required this.result,
    required this.query,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final note = result.note;
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 高亮标题
            _buildHighlightedText(
              text: note.title,
              query: query,
              style: const TextStyle(
                color: AeroColors.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 3),
            // 高亮预览
            _buildHighlightedText(
              text: result.preview,
              query: query,
              style: const TextStyle(
                color: AeroColors.textMuted,
                fontSize: 10,
                height: 1.3,
              ),
              maxLines: 2,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHighlightedText({
    required String text,
    required String query,
    required TextStyle style,
    int maxLines = 1,
  }) {
    if (query.isEmpty) {
      return Text(
        text,
        maxLines: maxLines,
        overflow: TextOverflow.ellipsis,
        style: style,
      );
    }

    final parsed = SearchService.parseQuery(query);

    // 收集所有需要高亮的区间 [start, end)，扁平存储：[s1, e1, s2, e2, ...]
    final ranges = <int>[];

    if (parsed.isRegex && parsed.regexPattern != null) {
      // 正则模式：用 RegExp 在文本中找所有匹配
      try {
        final regex = RegExp(parsed.regexPattern!);
        for (final m in regex.allMatches(text)) {
          ranges.add(m.start);
          ranges.add(m.end);
        }
      } catch (_) {
        // 非法正则，不做高亮（降级为纯文本返回）
      }
    } else {
      // 普通关键词模式：合并 titleFilter + contentFilter + tagFilter + keywords
      // 注意 pathFilter 仅用于过滤笔记，不参与文本高亮
      final keywords = <String>[
        if (parsed.titleFilter != null) parsed.titleFilter!,
        if (parsed.contentFilter != null) parsed.contentFilter!,
        if (parsed.tagFilter != null) parsed.tagFilter!,
        ...parsed.keywords,
      ];

      final lowerText = text.toLowerCase();
      for (final kw in keywords) {
        if (kw.isEmpty) continue;
        final lowerKw = kw.toLowerCase();
        int start = 0;
        while (true) {
          final index = lowerText.indexOf(lowerKw, start);
          if (index == -1) break;
          ranges.add(index);
          ranges.add(index + kw.length);
          start = index + kw.length;
        }
      }
    }

    if (ranges.isEmpty) {
      return Text(
        text,
        maxLines: maxLines,
        overflow: TextOverflow.ellipsis,
        style: style,
      );
    }

    // 合并重叠或相邻的匹配区间，避免嵌套 TextSpan
    // 1. 将扁平 ranges 转为 [start, end] 列表
    final sortedRanges = <List<int>>[];
    for (int i = 0; i < ranges.length; i += 2) {
      sortedRanges.add([ranges[i], ranges[i + 1]]);
    }
    // 2. 按 start 排序
    sortedRanges.sort((a, b) => a[0].compareTo(b[0]));

    // 3. 合并：相邻（end == next.start）或重叠（end > next.start）的区间合并为一个
    final merged = <List<int>>[];
    for (final r in sortedRanges) {
      if (merged.isEmpty || merged.last[1] < r[0]) {
        merged.add([r[0], r[1]]);
      } else {
        // 重叠或相邻，扩展当前区间右端
        merged.last[1] = merged.last[1] > r[1] ? merged.last[1] : r[1];
      }
    }

    // 4. 构造 TextSpan 列表（普通段继承 style，匹配段附加高亮样式）
    final spans = <TextSpan>[];
    int cursor = 0;
    for (final r in merged) {
      if (r[0] > cursor) {
        spans.add(TextSpan(text: text.substring(cursor, r[0])));
      }
      spans.add(TextSpan(
        text: text.substring(r[0], r[1]),
        style: style.copyWith(
          backgroundColor: AeroColors.accentYellow.withValues(alpha: 0.3),
          color: AeroColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ));
      cursor = r[1];
    }
    if (cursor < text.length) {
      spans.add(TextSpan(text: text.substring(cursor)));
    }

    return RichText(
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: style,
        children: spans,
      ),
    );
  }
}

/// 标签视图
class _TagView extends ConsumerWidget {
  final void Function(String noteId, String title)? onNoteSelected;

  const _TagView({this.onNoteSelected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sidebarProvider);
    final tags = state.tagCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    if (tags.isEmpty) {
      // 触发加载
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(sidebarProvider.notifier).showTags();
      });
      return const Center(
        child: Text('暂无标签',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 12)),
      );
    }

    // 如果选中了标签，显示该标签下的笔记
    if (state.selectedTag != null && state.filteredTagNotes.isNotEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 选中标签时的清除按钮
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AeroColors.accentPurple.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '# ${state.selectedTag}',
                    style: const TextStyle(
                      color: AeroColors.accentPurple,
                      fontSize: 11,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  '${state.filteredTagNotes.length} 篇笔记',
                  style: const TextStyle(
                    color: AeroColors.textMuted,
                    fontSize: 10,
                  ),
                ),
                const Spacer(),
                InkWell(
                  onTap: () {
                    ref.read(sidebarProvider.notifier).clearTagSelection();
                  },
                  child: const Icon(Icons.close,
                      size: 14, color: AeroColors.textMuted),
                ),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 0.5),
          // 笔记列表
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 4),
              itemCount: state.filteredTagNotes.length,
              itemBuilder: (context, index) {
                final note = state.filteredTagNotes[index];
                return InkWell(
                  onTap: () {
                    onNoteSelected?.call(note.id, note.title);
                    ref
                        .read(sidebarProvider.notifier)
                        .selectNote(note.id);
                  },
                  child: Container(
                    height: 32,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: [
                        const Icon(Icons.description_outlined,
                            size: 14, color: AeroColors.textMuted),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            note.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AeroColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 选中标签时的清除按钮
        if (state.selectedTag != null)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AeroColors.accentPurple.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '# ${state.selectedTag}',
                    style: const TextStyle(
                      color: AeroColors.accentPurple,
                      fontSize: 11,
                    ),
                  ),
                ),
                const Spacer(),
                InkWell(
                  onTap: () {
                    ref.read(sidebarProvider.notifier).clearTagSelection();
                  },
                  child: const Icon(Icons.close,
                      size: 14, color: AeroColors.textMuted),
                ),
              ],
            ),
          ),

        // 标签列表
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            itemCount: tags.length,
            itemBuilder: (context, index) {
              final entry = tags[index];
              final isSelected = entry.key == state.selectedTag;
              return GestureDetector(
                onSecondaryTapUp: (details) =>
                    _showTagContextMenu(context, ref, entry.key, details),
                onLongPressStart: (details) =>
                    _showTagContextMenu(context, ref, entry.key, details.globalPosition),
                child: InkWell(
                  onTap: () {
                    ref.read(sidebarProvider.notifier).selectTag(entry.key);
                  },
                  child: Container(
                    height: 28,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    color: isSelected
                        ? AeroColors.accentPurple.withValues(alpha: 0.08)
                        : Colors.transparent,
                    child: Row(
                      children: [
                        Icon(Icons.sell_outlined,
                            size: 12,
                            color: isSelected
                                ? AeroColors.accentPurple
                                : AeroColors.textMuted),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            entry.key,
                            style: TextStyle(
                              fontSize: 12,
                              color: isSelected
                                  ? AeroColors.accentPurple
                                  : AeroColors.textPrimary,
                            ),
                          ),
                        ),
                        Text(
                          '${entry.value}',
                          style: const TextStyle(
                            color: AeroColors.textMuted,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  /// 标签右键/长按菜单：重命名或删除
  void _showTagContextMenu(
    BuildContext context,
    WidgetRef ref,
    String tag,
    dynamic details,
  ) {
    final Offset position;
    if (details is Offset) {
      position = details;
    } else if (details is TapDownDetails) {
      position = details.globalPosition;
    } else {
      position = Offset.zero;
    }

    showMenu<String>(
      context: context,
      position: RelativeRect.fromLTRB(
        position.dx,
        position.dy,
        position.dx + 1,
        position.dy + 1,
      ),
      items: [
        const PopupMenuItem<String>(
          value: 'rename',
          height: 36,
          child: Row(
            children: [
              Icon(Icons.edit_outlined, size: 14, color: AeroColors.textSecondary),
              SizedBox(width: 8),
              Text('重命名标签', style: TextStyle(fontSize: 12)),
            ],
          ),
        ),
        const PopupMenuItem<String>(
          value: 'delete',
          height: 36,
          child: Row(
            children: [
              Icon(Icons.delete_outline, size: 14, color: AeroColors.accentRed),
              SizedBox(width: 8),
              Text('删除标签', style: TextStyle(fontSize: 12, color: AeroColors.accentRed)),
            ],
          ),
        ),
      ],
    ).then((value) {
      if (!context.mounted) return;
      if (value == 'rename') {
        _showRenameTagDialog(context, ref, tag);
      } else if (value == 'delete') {
        _confirmDeleteTag(context, ref, tag);
      }
    });
  }

  void _showRenameTagDialog(BuildContext context, WidgetRef ref, String oldTag) {
    showDialog<void>(
      context: context,
      builder: (ctx) => _RenameTagDialog(
        oldTag: oldTag,
        onSubmit: (newTag) async {
          if (newTag.isEmpty || newTag == oldTag) {
            Navigator.of(ctx).pop();
            return;
          }
          Navigator.of(ctx).pop();
          try {
            await ref.read(sidebarProvider.notifier).renameTag(oldTag, newTag);
          } catch (e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('重命名标签失败: $e'), duration: const Duration(seconds: 2)),
              );
            }
          }
        },
      ),
    );
  }

  void _confirmDeleteTag(BuildContext context, WidgetRef ref, String tag) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text('删除标签', style: TextStyle(fontSize: 14)),
        content: Text(
          '将要从所有笔记中移除标签 "#$tag"。\n此操作不可撤销。',
          style: const TextStyle(color: AeroColors.textSecondary, fontSize: 12),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              try {
                await ref.read(sidebarProvider.notifier).deleteTag(tag);
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('删除标签失败: $e'), duration: const Duration(seconds: 2)),
                  );
                }
              }
            },
            child: const Text('删除', style: TextStyle(color: AeroColors.accentRed)),
          ),
        ],
      ),
    );
  }
}

class _RenameTagDialog extends StatefulWidget {
  final String oldTag;
  final Future<void> Function(String newTag) onSubmit;

  const _RenameTagDialog({
    required this.oldTag,
    required this.onSubmit,
  });

  @override
  State<_RenameTagDialog> createState() => _RenameTagDialogState();
}

class _RenameTagDialogState extends State<_RenameTagDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.oldTag);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    widget.onSubmit(_controller.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AeroColors.bgElevated,
      title: const Text('重命名标签', style: TextStyle(fontSize: 14)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('将标签 "#${widget.oldTag}" 重命名为：',
              style: const TextStyle(color: AeroColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            autofocus: true,
            style: const TextStyle(fontSize: 13),
            decoration: const InputDecoration(
              hintText: '输入新标签名',
              hintStyle: TextStyle(color: AeroColors.textMuted, fontSize: 12),
              prefixText: '# ',
              prefixStyle: TextStyle(color: AeroColors.accentPurple),
              enabledBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: AeroColors.divider),
              ),
              focusedBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: AeroColors.accentPurple),
              ),
            ),
            onSubmitted: (_) => _submit(),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
        ),
        TextButton(
          onPressed: _submit,
          child: const Text('确定', style: TextStyle(color: AeroColors.accentGreen)),
        ),
      ],
    );
  }
}

/// 最近编辑视图
class _RecentView extends ConsumerWidget {
  final void Function(String noteId, String title)? onNoteSelected;

  const _RecentView({this.onNoteSelected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sidebarProvider);

    if (state.recentNoteIds.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(sidebarProvider.notifier).showRecent();
      });
      return const Center(
        child: Text('暂无最近笔记',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 12)),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: state.recentNoteIds.length,
      itemBuilder: (context, index) {
        final noteId = state.recentNoteIds[index];
        return _NoteListItem(
          noteId: noteId,
          onTap: onNoteSelected ?? (_, __) {},
        );
      },
    );
  }
}

/// 简单的笔记列表项（最近编辑等视图使用）
class _NoteListItem extends ConsumerWidget {
  final String noteId;
  final void Function(String noteId, String title) onTap;

  const _NoteListItem({required this.noteId, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final noteAsync = ref.watch(noteByIdProvider(noteId));
    return noteAsync.when(
      loading: () => const SizedBox(height: 32),
      error: (_, __) => const SizedBox.shrink(),
      data: (note) {
        if (note == null) return const SizedBox.shrink();
        return InkWell(
          onTap: () => onTap(note.id, note.title),
          child: Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                const Icon(Icons.schedule,
                    size: 14, color: AeroColors.textMuted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    note.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AeroColors.textPrimary,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// 任务视图
class _TaskView extends ConsumerWidget {
  final void Function(String noteId, String title)? onNoteSelected;

  const _TaskView({this.onNoteSelected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sidebarProvider);
    final notifier = ref.read(sidebarProvider.notifier);

    // 过滤任务
    final tasks = state.showOnlyIncomplete
        ? state.allTasks.where((t) => !t.isCompleted).toList()
        : state.allTasks;

    final incompleteCount =
        state.allTasks.where((t) => !t.isCompleted).length;
    final completedCount =
        state.allTasks.where((t) => t.isCompleted).length;

    if (state.allTasks.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_box_outlined,
                size: 32, color: AeroColors.textMuted),
            SizedBox(height: 8),
            Text('暂无任务',
                style: TextStyle(color: AeroColors.textMuted, fontSize: 12)),
            SizedBox(height: 4),
            Text('使用 - [ ] 创建任务',
                style: TextStyle(color: AeroColors.textMuted, fontSize: 10)),
          ],
        ),
      );
    }

    return Column(
      children: [
        // 顶部统计和过滤
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 8, 4),
          child: Row(
            children: [
              Text(
                '$incompleteCount 个待办',
                style: const TextStyle(
                  color: AeroColors.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (completedCount > 0) ...[
                const SizedBox(width: 8),
                Text(
                  '$completedCount 已完成',
                  style: const TextStyle(
                    color: AeroColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
              const Spacer(),
              InkWell(
                onTap: () => notifier.toggleTaskFilter(),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AeroColors.bgDeep,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    state.showOnlyIncomplete ? '显示全部' : '仅待办',
                    style: const TextStyle(
                      color: AeroColors.textMuted,
                      fontSize: 10,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // 任务列表
        Expanded(
          child: tasks.isEmpty
              ? const Center(
                  child: Text(
                    '没有待办任务',
                    style: TextStyle(
                        color: AeroColors.textMuted, fontSize: 11),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  itemCount: tasks.length,
                  itemBuilder: (context, index) {
                    final task = tasks[index];
                    return _TaskTile(
                      task: task,
                      onToggle: () => notifier.toggleTask(task),
                      onTap: () {
                        onNoteSelected?.call(task.noteId, task.noteTitle);
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }
}

/// 任务列表项
class _TaskTile extends StatelessWidget {
  final TaskItem task;
  final VoidCallback onToggle;
  final VoidCallback onTap;

  const _TaskTile({
    required this.task,
    required this.onToggle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 复选框
            InkWell(
              onTap: onToggle,
              child: Container(
                width: 16,
                height: 16,
                margin: const EdgeInsets.only(top: 1),
                decoration: BoxDecoration(
                  color: task.isCompleted
                      ? AeroColors.accentGreen
                      : Colors.transparent,
                  border: Border.all(
                    color: task.isCompleted
                        ? AeroColors.accentGreen
                        : AeroColors.textMuted,
                    width: 1,
                  ),
                  borderRadius: BorderRadius.circular(3),
                ),
                child: task.isCompleted
                    ? const Icon(Icons.check,
                        size: 12, color: Colors.white)
                    : null,
              ),
            ),
            const SizedBox(width: 8),
            // 任务内容
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.text,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: task.isCompleted
                          ? AeroColors.textMuted
                          : AeroColors.textPrimary,
                      fontSize: 12,
                      decoration: task.isCompleted
                          ? TextDecoration.lineThrough
                          : null,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    task.noteTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AeroColors.textMuted,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 插件面板占位符
class _PluginPlaceholder extends StatelessWidget {
  const _PluginPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.extension_outlined,
              size: 32, color: AeroColors.textMuted),
          SizedBox(height: 8),
          Text(
            '插件面板',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 12),
          ),
          SizedBox(height: 4),
          Text(
            'Ctrl+K → 插件管理',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 10),
          ),
        ],
      ),
    );
  }
}
