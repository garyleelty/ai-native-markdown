import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/theme/aeromind_theme.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/core/widgets/dialog_header.dart';
import 'package:aeromind/core/widgets/modal_overlay.dart';
import 'package:aeromind/core/widgets/search_input.dart';
import 'package:aeromind/features/quick_switcher/services/fuzzy_matcher.dart';
import 'package:aeromind/providers/quick_switcher_provider.dart';
import 'package:aeromind/providers/note_provider.dart';

class QuickSwitcherOverlay extends ConsumerStatefulWidget {
  final void Function(String noteId) onOpenNote;

  const QuickSwitcherOverlay({super.key, required this.onOpenNote});

  @override
  ConsumerState<QuickSwitcherOverlay> createState() =>
      _QuickSwitcherOverlayState();
}

class _QuickSwitcherOverlayState extends ConsumerState<QuickSwitcherOverlay> {
  late final TextEditingController _searchController;
  late final FocusNode _searchFocusNode;

  final ScrollController _listScrollController = ScrollController();

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

  void _handleOpenChange(bool isOpen) {
    if (isOpen) {
      _searchController.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _searchFocusNode.requestFocus();
      });
      _loadNotes();
    }
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    final notifier = ref.read(quickSwitcherProvider.notifier);

    if (event.logicalKey == LogicalKeyboardKey.escape) {
      notifier.close();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      notifier.moveSelection(-1);
      _scrollToSelected();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      notifier.moveSelection(1);
      _scrollToSelected();
      return KeyEventResult.handled;
    }

    if (event.logicalKey == LogicalKeyboardKey.enter) {
      notifier.selectCurrent(
        (r) => r.noteId,
        (noteId) => widget.onOpenNote(noteId),
      );
      return KeyEventResult.handled;
    }

    return KeyEventResult.ignored;
  }

  void _scrollToSelected() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_listScrollController.hasClients) return;
      final state = ref.read(quickSwitcherProvider);
      final index = state.selectedIndex;
      final targetOffset = (index * 52.0) - 100.0;
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

    ref.listen<bool>(
      quickSwitcherProvider.select((s) => s.isOpen),
      (prev, next) => _handleOpenChange(next),
    );

    return ModalOverlay(
      isOpen: state.isOpen,
      onClose: () => ref.read(quickSwitcherProvider.notifier).close(),
      position: OverlayPosition.topCenter,
      child: Focus(
        onKeyEvent: _handleKeyEvent,
        autofocus: true,
        child: _buildPanel(state),
      ),
    );
  }

  Widget _buildPanel(QuickSwitcherState state) {
    return DialogContainer(
      width: 560,
      height: 420,
      child: Column(
        children: [
          DialogHeader(
            icon: Icons.flash_on,
            iconColor: AeroColors.accentCyan,
            title: '快速跳转',
            badgeText: '${_notesCache.length} 篇笔记',
            badgeColor: AeroColors.accentCyan,
            onClose: () => ref.read(quickSwitcherProvider.notifier).close(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: SearchInput(
              controller: _searchController,
              focusNode: _searchFocusNode,
              hintText: '输入笔记名或关键词...',
              height: 36,
              onChanged: (q) {
                ref.read(quickSwitcherProvider.notifier).setQuery(q);
              },
            ),
          ),
          const Divider(height: 1, thickness: 0.5),
          Expanded(child: _buildBody(state)),
        ],
      ),
    );
  }

  Widget _buildBody(QuickSwitcherState state) {
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
    if (state.query.isEmpty) {
      return const Center(
        child: Text(
          '开始输入以搜索笔记...',
          style: TextStyle(color: AeroColors.textMuted, fontSize: 13),
        ),
      );
    }
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
    final updatedText =
        note != null ? note.updatedAt.toString().substring(0, 16) : '';

    return MouseRegion(
      cursor: SystemMouseCursors.click,
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
                Icons.description_outlined,
                size: 16,
                color: isSelected
                    ? AeroColors.accentBlue
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

  Widget _buildTitleText(
    String title,
    List<MatchRange> ranges,
    bool isSelected,
  ) {
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
      final end = range.end > title.length ? title.length : range.end;
      spans.add(TextSpan(
        text: title.substring(range.start, end),
        style: TextStyle(
          color: AeroColors.accentBlue,
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
