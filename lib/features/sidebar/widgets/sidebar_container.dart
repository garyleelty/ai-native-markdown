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

/// 侧边栏主容器
class SidebarContainer extends ConsumerWidget {
  /// 选中笔记后的回调 (打开面板)
  final void Function(String noteId, String title)? onNoteSelected;

  const SidebarContainer({super.key, this.onNoteSelected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sidebarState = ref.watch(sidebarProvider);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      width: sidebarState.isExpanded ? sidebarState.width : 0,
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(
        color: AeroColors.bgSurface,
        border: Border(
          right: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: sidebarState.isExpanded
          ? _SidebarContent(onNoteSelected: onNoteSelected)
          : const SizedBox.shrink(),
    );
  }
}

/// 侧边栏内容
class _SidebarContent extends ConsumerWidget {
  final void Function(String noteId, String title)? onNoteSelected;

  const _SidebarContent({this.onNoteSelected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sidebarProvider);

    return Column(
      children: [
        // ── 顶部视图切换标签 ──
        _ViewTabBar(currentView: state.currentView),

        // ── 内容区 ──
        Expanded(
          child: switch (state.currentView) {
            SidebarView.noteTree =>
              _NoteTreeView(onNoteSelected: onNoteSelected),
            SidebarView.calendar => const CalendarView(),
            SidebarView.search => _SearchView(onNoteSelected: onNoteSelected),
            SidebarView.tags => _TagView(onNoteSelected: onNoteSelected),
            SidebarView.recent =>
              _RecentView(onNoteSelected: onNoteSelected),
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
            SidebarView.tasks =>
              _TaskView(onNoteSelected: onNoteSelected),
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
    );
  }
}

/// 视图切换标签栏
class _ViewTabBar extends ConsumerWidget {
  final SidebarView currentView;

  const _ViewTabBar({required this.currentView});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(sidebarProvider.notifier);

    return Container(
      height: 36,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          _TabIcon(
            icon: Icons.article_outlined,
            isActive: currentView == SidebarView.noteTree,
            tooltip: '笔记树',
            onTap: notifier.showNoteTree,
          ),
          _TabIcon(
            icon: Icons.calendar_today,
            isActive: currentView == SidebarView.calendar,
            tooltip: '日历',
            onTap: notifier.showCalendar,
          ),
          _TabIcon(
            icon: Icons.search,
            isActive: currentView == SidebarView.search,
            tooltip: '搜索',
            onTap: notifier.showSearch,
          ),
          _TabIcon(
            icon: Icons.sell_outlined,
            isActive: currentView == SidebarView.tags,
            tooltip: '标签',
            onTap: notifier.showTags,
          ),
          _TabIcon(
            icon: Icons.schedule,
            isActive: currentView == SidebarView.recent,
            tooltip: '最近',
            onTap: notifier.showRecent,
          ),
          _TabIcon(
            icon: Icons.list_alt,
            isActive: currentView == SidebarView.outline,
            tooltip: '大纲',
            onTap: notifier.showOutline,
          ),
          _TabIcon(
            icon: Icons.link,
            isActive: currentView == SidebarView.backlinks,
            tooltip: '反向链接',
            onTap: notifier.showBacklinks,
          ),
          _TabIcon(
            icon: Icons.check_box_outlined,
            isActive: currentView == SidebarView.tasks,
            tooltip: '任务',
            onTap: () => notifier.showTasks(),
          ),
          _TabIcon(
            icon: Icons.delete_outline,
            isActive: currentView == SidebarView.trash,
            tooltip: '回收站',
            onTap: () => notifier.switchView(SidebarView.trash),
          ),
          const Spacer(),
          _TabIcon(
            icon: Icons.extension_outlined,
            isActive: currentView == SidebarView.plugins,
            tooltip: '插件',
            onTap: notifier.showPlugins,
          ),
        ],
      ),
    );
  }
}

/// 单个标签图标
class _TabIcon extends StatelessWidget {
  final IconData icon;
  final bool isActive;
  final String tooltip;
  final VoidCallback onTap;

  const _TabIcon({
    required this.icon,
    required this.isActive,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      preferBelow: false,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          width: 32,
          height: 28,
          decoration: BoxDecoration(
            border: isActive
                ? const Border(
                    bottom:
                        BorderSide(color: AeroColors.accentBlue, width: 2),
                  )
                : null,
          ),
          child: Icon(
            icon,
            size: 16,
            color: isActive ? AeroColors.accentBlue : AeroColors.textSecondary,
          ),
        ),
      ),
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
        // ── 标题栏 + 新建按钮 ──
        _NoteTreeHeader(onNewNote: _showNewNoteDialog),

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

  void _showNewNoteDialog() {
    final controller = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text('新建笔记',
            style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
          decoration: const InputDecoration(
            hintText: '输入笔记标题...',
            hintStyle: TextStyle(color: AeroColors.textMuted),
            isDense: true,
          ),
          onSubmitted: (_) => _createNote(ctx, controller.text),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
          ),
          TextButton(
            onPressed: () => _createNote(ctx, controller.text),
            child: const Text('创建', style: TextStyle(color: AeroColors.accentBlue)),
          ),
        ],
      ),
    );
  }

  Future<void> _createNote(BuildContext ctx, String title) async {
    if (title.trim().isEmpty) {
      ScaffoldMessenger.of(ctx).showSnackBar(
        const SnackBar(
          content: Text('标题不能为空'),
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    final repo = ref.read(noteRepositoryProvider);
    final now = DateTime.now();
    final trimmedTitle = title.trim();
    final note = NoteModel(
      id: now.millisecondsSinceEpoch.toString(),
      title: trimmedTitle,
      rawMarkdown: '# $trimmedTitle\n\n',
      filePath: '',
      createdAt: now,
      updatedAt: now,
    );
    await repo.saveNote(note);
    await ref.read(sidebarProvider.notifier).loadNoteTree();

    if (mounted) {
      Navigator.pop(ctx);
      widget.onNoteSelected?.call(note.id, note.title);
    }
  }
}

/// 笔记树标题栏
class _NoteTreeHeader extends StatelessWidget {
  final VoidCallback onNewNote;

  const _NoteTreeHeader({required this.onNewNote});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          const Text(
            '笔记',
            style: TextStyle(
              color: AeroColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.add, size: 16, color: AeroColors.textSecondary),
            tooltip: '新建笔记',
            onPressed: onNewNote,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            padding: EdgeInsets.zero,
          ),
        ],
      ),
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
          // 导入文件按钮
          Expanded(
            child: _SidebarActionButton(
              icon: Icons.file_open_outlined,
              label: '打开文件',
              tooltip: '直接打开本地 .md 文件',
              onTap: () => _openFile(ref, import: false),
            ),
          ),
          const SizedBox(width: 4),
          // 导入到 Hive 按钮
          Expanded(
            child: _SidebarActionButton(
              icon: Icons.note_add_outlined,
              label: '导入文件',
              tooltip: '导入本地 .md 文件到笔记库',
              onTap: () => _openFile(ref, import: true),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openFile(WidgetRef ref, {required bool import}) async {
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
            ? AeroColors.accentBlue.withOpacity(0.1)
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
                  color: AeroColors.accentPurple.withOpacity(0.12),
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
              Icon(Icons.delete_outline, size: 16, color: Colors.red),
              SizedBox(width: 8),
              Text('删除', style: TextStyle(color: Colors.red, fontSize: 12)),
            ],
          ),
        ),
      ];
    }
  }

  void _showRenameDialog() {
    final controller = TextEditingController(text: widget.node.title);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text('重命名笔记',
            style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
          decoration: const InputDecoration(
            hintText: '新标题...',
            hintStyle: TextStyle(color: AeroColors.textMuted),
            isDense: true,
          ),
          onSubmitted: (_) => _doRename(ctx, controller.text),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
          ),
          TextButton(
            onPressed: () => _doRename(ctx, controller.text),
            child: const Text('确定', style: TextStyle(color: AeroColors.accentBlue)),
          ),
        ],
      ),
    );
  }

  Future<void> _doRename(BuildContext ctx, String newTitle) async {
    if (newTitle.trim().isEmpty || newTitle.trim() == widget.node.title) {
      Navigator.pop(ctx);
      return;
    }
    await ref
        .read(sidebarProvider.notifier)
        .renameNote(widget.node.id, newTitle.trim());
    if (ctx.mounted) Navigator.pop(ctx);
  }

  Future<void> _duplicateNote() async {
    final repo = ref.read(noteRepositoryProvider);
    final note = await repo.getNote(widget.node.id);
    if (note == null) return;

    final now = DateTime.now();
    final duplicated = NoteModel(
      id: now.millisecondsSinceEpoch.toString(),
      title: '${note.title} 副本',
      rawMarkdown: note.rawMarkdown,
      filePath: note.filePath,
      createdAt: now,
      updatedAt: now,
      tags: note.tags,
      folderPath: note.folderPath,
    );
    await repo.saveNote(duplicated);
    await ref.read(sidebarProvider.notifier).loadNoteTree();
  }

  void _confirmDelete() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text('确认删除',
            style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
        content: Text(
          '确定要删除「${widget.node.title}」吗？\n此操作不可撤销。',
          style: const TextStyle(color: AeroColors.textSecondary, fontSize: 12),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
          ),
          TextButton(
            onPressed: () async {
              await ref.read(sidebarProvider.notifier).deleteNote(widget.node.id);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('删除', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
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

        // 结果计数
        if (state.searchQuery.isNotEmpty && !state.isSearching)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '${state.searchResults.length} 个结果',
                style: const TextStyle(
                    color: AeroColors.textMuted, fontSize: 11),
              ),
            ),
          ),

        // 结果列表
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            itemCount: state.searchResults.length,
            itemBuilder: (context, index) {
              final result = state.searchResults[index];
              return _SearchResultTile(
                result: result,
                query: state.searchQuery,
                onTap: () {
                  widget.onNoteSelected?.call(result.note.id, result.note.title);
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
          backgroundColor: AeroColors.accentYellow.withOpacity(0.3),
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
                    color: AeroColors.accentPurple.withOpacity(0.15),
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
                        Icon(Icons.description_outlined,
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
                    color: AeroColors.accentPurple.withOpacity(0.15),
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
                        ? AeroColors.accentPurple.withOpacity(0.08)
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
      if (value == 'rename') {
        _showRenameTagDialog(context, ref, tag);
      } else if (value == 'delete') {
        _confirmDeleteTag(context, ref, tag);
      }
    });
  }

  void _showRenameTagDialog(BuildContext context, WidgetRef ref, String oldTag) {
    final controller = TextEditingController(text: oldTag);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text('重命名标签', style: TextStyle(fontSize: 14)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('将标签 "#$oldTag" 重命名为：',
                style: const TextStyle(color: AeroColors.textSecondary, fontSize: 12)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              style: const TextStyle(fontSize: 13),
              decoration: InputDecoration(
                hintText: '输入新标签名',
                hintStyle: const TextStyle(color: AeroColors.textMuted, fontSize: 12),
                prefixText: '# ',
                prefixStyle: const TextStyle(color: AeroColors.accentPurple),
                enabledBorder: const UnderlineInputBorder(
                  borderSide: BorderSide(color: AeroColors.divider),
                ),
                focusedBorder: const UnderlineInputBorder(
                  borderSide: BorderSide(color: AeroColors.accentPurple),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
          ),
          TextButton(
            onPressed: () {
              final newTag = controller.text.trim();
              if (newTag.isEmpty || newTag == oldTag) {
                Navigator.of(ctx).pop();
                return;
              }
              Navigator.of(ctx).pop();
              ref.read(sidebarProvider.notifier).renameTag(oldTag, newTag);
            },
            child: const Text('确定', style: TextStyle(color: AeroColors.accentGreen)),
          ),
        ],
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
            onPressed: () {
              Navigator.of(ctx).pop();
              ref.read(sidebarProvider.notifier).deleteTag(tag);
            },
            child: const Text('删除', style: TextStyle(color: AeroColors.accentRed)),
          ),
        ],
      ),
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
          onTap: () {
            onNoteSelected?.call(noteId, noteId);
          },
        );
      },
    );
  }
}

/// 简单的笔记列表项（最近编辑等视图使用）
class _NoteListItem extends ConsumerWidget {
  final String noteId;
  final VoidCallback onTap;

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
          onTap: onTap,
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
