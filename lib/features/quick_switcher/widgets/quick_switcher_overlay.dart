import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/theme/aeromind_theme.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/features/quick_switcher/services/fuzzy_matcher.dart';
import 'package:aeromind/providers/quick_switcher_provider.dart';
import 'package:aeromind/providers/note_provider.dart';

/// ══════════════════════════════════════════════════
/// QuickSwitcherOverlay — 快速跳转面板 UI
/// ══════════════════════════════════════════════════
/// 通过 Cmd/Ctrl+O 唤起的模糊搜索笔记跳转面板。
/// Obsidian 风格：全屏半透明覆盖层 + 居中对话框 + 键盘导航。
/// 支持上下键导航、Enter 打开、Escape 关闭、鼠标悬停选中。
/// ──────────────────────────────────────────────────

class QuickSwitcherOverlay extends ConsumerStatefulWidget {
  /// 选中笔记后的打开回调（由应用 Shell 注入）
  final void Function(String noteId) onOpenNote;

  const QuickSwitcherOverlay({super.key, required this.onOpenNote});

  @override
  ConsumerState<QuickSwitcherOverlay> createState() =>
      _QuickSwitcherOverlayState();
}

class _QuickSwitcherOverlayState extends ConsumerState<QuickSwitcherOverlay> {
  late final TextEditingController _searchController;
  late final FocusNode _searchFocusNode;

  /// 列表滚动控制器（键盘导航时滚动到选中项）
  final ScrollController _listScrollController = ScrollController();

  /// 笔记缓存：noteId → NoteModel
  /// FuzzyMatchResult 仅携带 noteId，渲染标题/路径/更新时间需要查表
  Map<String, NoteModel> _notesCache = const <String, NoteModel>{};
  bool _loading = false;
  bool _loadError = false;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _searchFocusNode = FocusNode();
    _searchController.addListener(_onSearchChanged);
    _loadNotes();
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

  /// 加载所有 NoteModel 到内存缓存
  ///
  /// 在覆盖层首次 init 与每次打开时调用，确保列表渲染时
  /// 能通过 noteId 拿到最新 title/folderPath/updatedAt。
  Future<void> _loadNotes() async {
    if (_loading) return;
    _loading = true;
    _loadError = false;
    try {
      final notes = await ref.read(noteRepositoryProvider).getAllNotes();
      if (!mounted) return;
      final map = <String, NoteModel>{};
      for (final note in notes) {
        map[note.id] = note;
      }
      setState(() {
        _notesCache = map;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = true;
      });
    }
  }

  /// 处理面板内键盘事件（Focus + onKeyEvent）
  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    final notifier = ref.read(quickSwitcherProvider.notifier);

    // Escape: 关闭
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      notifier.close();
      return KeyEventResult.handled;
    }

    // 上箭头: 选中上一条
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      notifier.moveSelection(-1);
      _scrollToSelected();
      return KeyEventResult.handled;
    }

    // 下箭头: 选中下一条
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      notifier.moveSelection(1);
      _scrollToSelected();
      return KeyEventResult.handled;
    }

    // Enter: 打开当前选中笔记
    if (event.logicalKey == LogicalKeyboardKey.enter) {
      notifier.selectCurrent(
        (r) => r.noteId,
        (noteId) => widget.onOpenNote(noteId),
      );
      // selectCurrent 内部已将 isOpen 置 false，UI 会自动隐藏
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  /// 滚动列表使当前选中项可见
  void _scrollToSelected() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_listScrollController.hasClients) return;
      final state = ref.read(quickSwitcherProvider);
      final index = state.selectedIndex;
      final targetOffset = (index * 56.0) - 100.0;
      _listScrollController.animateTo(
        targetOffset.clamp(
          0.0,
          _listScrollController.position.maxScrollExtent,
        ),
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(quickSwitcherProvider);

    // 监听打开状态变化：打开时清空搜索框、重新加载笔记、请求焦点
    ref.listen<bool>(
      quickSwitcherProvider.select((s) => s.isOpen),
      (prev, next) {
        if (next) {
          _searchController.clear();
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _searchFocusNode.requestFocus();
          });
          _loadNotes();
        }
      },
    );

    if (!state.isOpen) return const SizedBox.shrink();

    return Focus(
      onKeyEvent: _handleKeyEvent,
      autofocus: true,
      child: Material(
        color: Colors.black38,
        child: GestureDetector(
          // 点击背景关闭
          onTap: () => ref.read(quickSwitcherProvider.notifier).close(),
          behavior: HitTestBehavior.opaque,
          child: Center(
            child: GestureDetector(
              // 阻止点击面板内部时穿透到背景
              onTap: () {},
              child: _buildPanel(state),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPanel(QuickSwitcherState state) {
    return Container(
      width: 560,
      height: 420,
      decoration: BoxDecoration(
        color: AeroColors.bgSurface,
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
        children: [
          _buildHeader(),
          _buildSearchBar(),
          const Divider(height: 1, thickness: 0.5),
          Expanded(child: _buildBody(state)),
        ],
      ),
    );
  }

  /// 顶部标题栏（44 高）
  Widget _buildHeader() {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.flash_on, size: 18, color: AeroColors.accentCyan),
          const SizedBox(width: 8),
          const Text(
            '快速跳转',
            style: TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close, size: 18, color: AeroColors.textSecondary),
            onPressed: () =>
                ref.read(quickSwitcherProvider.notifier).close(),
            splashRadius: 16,
          ),
        ],
      ),
    );
  }

  /// 搜索框（参考 plugin_manager_panel.dart 样式）
  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: TextField(
        controller: _searchController,
        focusNode: _searchFocusNode,
        autofocus: true,
        style: const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
        decoration: InputDecoration(
          hintText: '输入笔记名或关键词...',
          hintStyle: const TextStyle(color: AeroColors.textMuted),
          prefixIcon:
              const Icon(Icons.search, size: 18, color: AeroColors.textMuted),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close,
                      size: 16, color: AeroColors.textMuted),
                  onPressed: () {
                    _searchController.clear();
                    ref.read(quickSwitcherProvider.notifier).setQuery('');
                  },
                  splashRadius: 14,
                )
              : null,
          filled: true,
          fillColor: AeroColors.bgDeep,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(6),
            borderSide: const BorderSide(color: AeroColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(6),
            borderSide:
                const BorderSide(color: AeroColors.border, width: 0.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(6),
            borderSide:
                const BorderSide(color: AeroColors.accentCyan, width: 1),
          ),
        ),
        onChanged: (q) {
          // setQuery 为异步方法，此处无需 await
          ref.read(quickSwitcherProvider.notifier).setQuery(q);
        },
      ),
    );
  }

  /// 结果列表 / 空状态
  Widget _buildBody(QuickSwitcherState state) {
    // 加载错误状态
    if (_loadError) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                size: 32, color: AeroColors.textMuted),
            const SizedBox(height: 8),
            const Text(
              '加载笔记失败，请重试',
              style: TextStyle(color: AeroColors.textMuted, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: _loadNotes,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }
    // 空查询：提示用户开始输入
    if (state.query.isEmpty) {
      return const Center(
        child: Text(
          '开始输入以搜索笔记...',
          style: TextStyle(color: AeroColors.textMuted, fontSize: 13),
        ),
      );
    }
    // 非空查询但无匹配结果
    if (state.results.isEmpty) {
      return const Center(
        child: Text(
          '未找到匹配的笔记',
          style: TextStyle(color: AeroColors.textMuted, fontSize: 13),
        ),
      );
    }
    return ListView.builder(
      controller: _listScrollController,
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: state.results.length,
      itemBuilder: (context, index) {
        final result = state.results[index];
        final note = _notesCache[result.noteId];
        final isSelected = index == state.selectedIndex;
        return _buildResultTile(result, note, isSelected, index);
      },
    );
  }

  /// 单条结果项
  Widget _buildResultTile(
    FuzzyMatchResult result,
    NoteModel? note,
    bool isSelected,
    int index,
  ) {
    final title = note?.title ?? '未知笔记';
    final folderPath = (note?.folderPath ?? '').isNotEmpty
        ? note!.folderPath
        : '根目录';
    // 更新时间简化显示（YYYY-MM-DD HH:MM）
    final updatedText =
        note != null ? note.updatedAt.toString().substring(0, 16) : '';

    return MouseRegion(
      // 鼠标悬停时把该项置为选中（通过 moveSelection 偏移）
      onEnter: (_) {
        final current = ref.read(quickSwitcherProvider).selectedIndex;
        final delta = index - current;
        if (delta != 0) {
          ref.read(quickSwitcherProvider.notifier).moveSelection(delta);
        }
      },
      child: GestureDetector(
        onTap: () {
          ref.read(quickSwitcherProvider.notifier).selectCurrent(
                (r) => r.noteId,
                (noteId) => widget.onOpenNote(noteId),
              );
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected
                ? AeroColors.accentCyan.withValues(alpha: 0.08)
                : Colors.transparent,
            border: isSelected
                ? const Border(
                    left: BorderSide(
                      color: AeroColors.accentCyan,
                      width: 2,
                    ),
                  )
                : null,
          ),
          child: Row(
            children: [
              Icon(
                Icons.description_outlined,
                size: 16,
                color: isSelected
                    ? AeroColors.accentCyan
                    : AeroColors.textSecondary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildTitleText(title, result.matchedRanges, isSelected),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            folderPath,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AeroColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                        ),
                        if (updatedText.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          const Text(
                            '·',
                            style: TextStyle(
                              color: AeroColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            updatedText,
                            style: const TextStyle(
                              color: AeroColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 标题文本（按 matchedRanges 高亮匹配字符）
  Widget _buildTitleText(
    String title,
    List<MatchRange> ranges,
    bool isSelected,
  ) {
    // 无匹配区间：直接渲染普通文本
    if (ranges.isEmpty) {
      return Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color:
              isSelected ? AeroColors.textPrimary : AeroColors.textSecondary,
          fontSize: 13,
          fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
        ),
      );
    }

    // 把标题拆为「匹配区间」与「非匹配区间」片段
    final spans = <TextSpan>[];
    int cursor = 0;
    for (final range in ranges) {
      if (range.start > cursor) {
        spans.add(TextSpan(
          text: title.substring(cursor, range.start),
          style: TextStyle(
            color: isSelected
                ? AeroColors.textPrimary
                : AeroColors.textSecondary,
            fontSize: 13,
            fontWeight:
                isSelected ? FontWeight.w500 : FontWeight.normal,
          ),
        ));
      }
      // 安全裁剪：range.end 可能越界（防御性）
      final end = range.end > title.length ? title.length : range.end;
      spans.add(TextSpan(
        text: title.substring(range.start, end),
        style: TextStyle(
          color: AeroColors.accentCyan,
          fontSize: 13,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        ),
      ));
      cursor = end;
    }
    if (cursor < title.length) {
      spans.add(TextSpan(
        text: title.substring(cursor),
        style: TextStyle(
          color: isSelected
              ? AeroColors.textPrimary
              : AeroColors.textSecondary,
          fontSize: 13,
          fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
        ),
      ));
    }

    return RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(children: spans),
    );
  }
}
