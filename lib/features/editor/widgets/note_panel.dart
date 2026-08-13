/// ══════════════════════════════════════════════════
/// NotePanel — 笔记编辑面板
/// ══════════════════════════════════════════════════
/// 三模式编辑（source / livePreview / preview）、Markdown 语法高亮、
/// wiki 链接补全与悬停预览、搜索替换栏、撤销/重做（EditorSession）、
/// 自动保存与滚动偏移 300ms 防抖写回（按 noteId 定位面板）。
/// ──────────────────────────────────────────────────

library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/note_model.dart';
import '../../../core/models/predictive_link.dart';
import '../../../core/services/file_service.dart';
import '../../../core/services/version_service.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../core/widgets/toolbar_button.dart';
import '../../../core/widgets/chip_button.dart';
import '../../../providers/ai_provider.dart';
import '../../../providers/note_provider.dart';
import '../../../providers/sidebar_provider.dart';
import '../../../providers/pane_provider.dart';
import '../../../providers/editor_session_provider.dart';
import '../../../providers/settings_provider.dart';
import '../services/editor_service.dart';
import '../services/syntax_highlighter.dart';
import '../../quick_switcher/services/fuzzy_matcher.dart';
import '../../sliding_panes/models/pane_state.dart' show EditorMode;
import 'entity_text_editor.dart';
import 'live_markdown_editor.dart';
import 'wiki_link_completer.dart';
import 'wiki_link_preview.dart';

/// ══════════════════════════════════════════════════
/// NotePanel — 单篇笔记的编辑面板卡片
/// ══════════════════════════════════════════════════
/// 集成:
///   1. Markdown 编辑器 (可切换阅读/编辑模式)
///   2. AI 实体识别高亮 (输入时实时触发)
///   3. AI 联想卡片弹窗 (点击实体触发)
///   4. 底部预测性关联推荐
/// ──────────────────────────────────────────────────
class NotePanel extends ConsumerStatefulWidget {
  final String noteId;

  const NotePanel({super.key, required this.noteId});

  @override
  ConsumerState<NotePanel> createState() => _NotePanelState();
}

class _NotePanelState extends ConsumerState<NotePanel> {
  late final MarkdownHighlightController _textController;
  late final FocusNode _focusNode;
  late final ScrollController _scrollController;
  final GlobalKey _editorKey = GlobalKey();
  final GlobalKey<LiveMarkdownEditorState> _liveEditorKey =
      GlobalKey<LiveMarkdownEditorState>();
  EditorMode _editorMode = EditorMode.source;
  String _rawMarkdown = '';
  DateTime? _lastHandledScrollRequest;
  bool _noteNotFound = false;

  // 撤销/重做内部标志位（历史本身存储在 EditorSessionProvider 中）
  bool _isUndoRedo = false;

  // 上一次记录到历史栈的文本值（用于计算撤销时的「前一步」状态）
  TextEditingValue _lastRecordedValue = TextEditingValue.empty;

  // 搜索替换控制器（文本内容持久化到 EditorSessionProvider）
  late final TextEditingController _searchController;
  late final TextEditingController _replaceController;

  // wiki link 悬浮预览
  WikiLinkHoverHandler? _wikiLinkHover;

  // wiki link 补全
  bool _wikiLinkVisible = false;
  bool _wikiLinkLoading = false;
  String _wikiLinkQuery = '';
  int _wikiLinkStart = -1;
  int _wikiLinkSelectedIndex = 0;
  List<WikiLinkSuggestion> _wikiLinkSuggestions = [];
  List<NoteModel> _wikiLinkAllNotes = [];

  int get _wikiLinkTotalCount {
    if (_wikiLinkLoading) return 0;
    return _wikiLinkSuggestions.isEmpty ? 1 : _wikiLinkSuggestions.length + 1;
  }

  /// 当前笔记的编辑器会话状态（监听变化以驱动 UI 重建）
  EditorSessionState get _session =>
      ref.watch(editorSessionProvider).get(widget.noteId);

  @override
  void initState() {
    super.initState();
    _textController = MarkdownHighlightController();
    _lastRecordedValue = _textController.value;
    _focusNode = FocusNode();
    _scrollController = ScrollController();
    _textController.addListener(_onControllerTextChanged);
    HardwareKeyboard.instance.addHandler(_handleHardwareKey);
    // 从 PaneState 恢复编辑器模式，避免面板重建后丢失
    final paneState = ref.read(paneStackProvider);
    final paneIndex = paneState.panes.indexWhere((p) => p.noteId == widget.noteId);
    if (paneIndex >= 0) {
      _editorMode = paneState.panes[paneIndex].editorMode;
    }
    // 从 EditorSessionProvider 恢复搜索替换栏状态和文本
    final session = ref.read(editorSessionProvider).get(widget.noteId);
    _searchController = TextEditingController(text: session.searchText);
    _replaceController = TextEditingController(text: session.replaceText);
    // 滚动位置持久化：监听变化并写回 PaneState
    _scrollController.addListener(_onScrollChanged);
    // 在首帧后恢复滚动位置（此时 controller 已 attach）
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ps = ref.read(paneStackProvider);
      final idx = ps.panes.indexWhere((p) => p.noteId == widget.noteId);
      if (idx >= 0 && _scrollController.hasClients) {
        final offset = ps.panes[idx].scrollOffset;
        if (offset > 0) {
          _scrollController.jumpTo(
            offset.clamp(0.0, _scrollController.position.maxScrollExtent),
          );
        }
      }
    });
    _loadNote();
  }

  void _onScrollChanged() {
    if (!_scrollController.hasClients) return;
    final offset = _scrollController.offset;
    final idx = ref
        .read(paneStackProvider)
        .panes
        .indexWhere((p) => p.noteId == widget.noteId);
    if (idx >= 0) {
      // 防抖写回，避免高频更新触发全局 rebuild
      _scrollSaveTimer?.cancel();
      _scrollSaveTimer = Timer(const Duration(milliseconds: 300), () {
        // 回调时面板可能已关闭/堆叠，索引可能已失效，需按 noteId 重新解析
        final currentIdx = ref
            .read(paneStackProvider)
            .panes
            .indexWhere((p) => p.noteId == widget.noteId);
        if (currentIdx >= 0) {
          ref
              .read(paneStackProvider.notifier)
              .updatePaneScrollOffset(currentIdx, offset);
        }
      });
    }
  }

  Timer? _scrollSaveTimer;

  void _onControllerTextChanged() {
    if (_editorMode == EditorMode.livePreview) {
      _onTextChanged(_textController.text);
    }
  }

  @override
  void didUpdateWidget(covariant NotePanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.noteId != widget.noteId) {
      _autoSaveTimer?.cancel();
      final prevText = _rawMarkdown;
      final prevHasUnsaved = _hasUnsavedChanges;
      // 切换到新笔记时，从 PaneState 恢复目标笔记的编辑器模式
      final paneState = ref.read(paneStackProvider);
      final paneIndex = paneState.panes.indexWhere((p) => p.noteId == widget.noteId);
      if (paneIndex >= 0) {
        _editorMode = paneState.panes[paneIndex].editorMode;
      }
      // 从 EditorSessionProvider 恢复目标笔记的搜索替换栏文本
      final session = ref.read(editorSessionProvider).get(widget.noteId);
      _searchController.text = session.searchText;
      _replaceController.text = session.replaceText;
      if (prevHasUnsaved) {
        _doSave(prevText).whenComplete(() {
          if (mounted) _loadNote();
        });
      } else {
        _loadNote();
      }
    }
  }

  @override
  void dispose() {
    _autoSaveTimer?.cancel();
    _scrollSaveTimer?.cancel();
    if (_hasUnsavedChanges) {
      final textToSave = _rawMarkdown;
      _saveSilently(textToSave);
    }
    _wikiLinkVisible = false;
    HardwareKeyboard.instance.removeHandler(_handleHardwareKey);
    _textController.removeListener(_onControllerTextChanged);
    _scrollController.removeListener(_onScrollChanged);
    _textController.dispose();
    _focusNode.dispose();
    _scrollController.dispose();
    _searchController.dispose();
    _replaceController.dispose();
    _wikiLinkHover?.dispose();
    super.dispose();
  }

  Future<void> _saveSilently(String text) async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final noteId = widget.noteId;
      final note = await repo.getNote(noteId);
      if (note == null) return;

      final links = EditorService.extractLinks(text);
      final wikiLinks = links
          .where((l) => l.isWikiLink)
          .map((l) => l.text)
          .toList();

      final newTitle = FileService.extractTitle(text, note.filePath);

      final updatedNote = note.copyWith(
        title: newTitle,
        rawMarkdown: text,
        updatedAt: DateTime.now(),
        outgoingLinks: wikiLinks,
      );
      await repo.saveNote(updatedNote);

      if (FileService.shouldSyncToFile(updatedNote.filePath)) {
        await FileService.syncToFile(updatedNote.filePath, text);
      }

      _lastSavedText = text;
      _hasUnsavedChanges = false;

      VersionService.saveSnapshot(noteId, text);
    } catch (e) {
      debugPrint('dispose 静默保存失败: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    // 监听滚动请求
    ref.listen<PaneStackState>(
      paneStackProvider,
      (prev, next) {
        final req = next.scrollRequest;
        if (req == null) return;
        if (req.noteId != widget.noteId) return;
        if (_lastHandledScrollRequest != null &&
            _lastHandledScrollRequest == req.timestamp) {
          return;
        }
        _lastHandledScrollRequest = req.timestamp;
        _scrollToOffset(req.offset);
        // 消费后清除请求
        ref.read(paneStackProvider.notifier).clearScrollRequest();
      },
    );

    // 监听实体缓存变化
    final entities = ref.watch(
      entityCacheProvider.select(
        (s) => s.getEntities(widget.noteId),
      ),
    );

    // 监听预测性关联
    final linksAsync =
        ref.watch(predictiveLinksProvider(widget.noteId));

    if (_noteNotFound) {
      return _buildNoteNotFound();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── 模式切换工具栏 ──
        _buildToolbar(),
        const Divider(height: 1, thickness: 0.5),

        // ── 搜索替换栏 ──
        if (_session.showSearchBar) _buildSearchBar(),

        // ── 编辑/阅读区域 ──
        Expanded(
          child: _buildEditorArea(entities),
        ),

        // ── 底部: AI 预测性关联推荐 ──
        linksAsync.when(
          data: (links) =>
              links.isEmpty
                  ? const SizedBox.shrink()
                  : _buildPredictiveLinks(links),
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
        ),

        // ── 底部状态栏 ──
        _buildStatusBar(),
      ],
    );
  }

  void _scrollToOffset(double offset) {
    final charOffset = offset.toInt();
    final textLength = _textController.text.length;
    final clampedOffset = charOffset.clamp(0, textLength);

    // 编辑模式和实时预览模式：通过移动光标来触发滚动
    if (_editorMode == EditorMode.source || _editorMode == EditorMode.livePreview) {
      _textController.selection = TextSelection.collapsed(offset: clampedOffset);
      if (_editorMode == EditorMode.source) {
        _focusNode.requestFocus();
      }
      // 给一帧时间让编辑器响应 selection 变化并自动滚动
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_scrollController.hasClients) return;
        final pos = _scrollController.position;
        final target = pos.pixels;
        _scrollController.animateTo(
          (target - 50).clamp(0.0, pos.maxScrollExtent),
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      });
    } else {
      // 阅读模式：估算滚动位置（每字符约 8px，每行约 20px）
      // 更精确的做法需要测量，但估算足够用于导航
      final estimatedLines =
          _textController.text.substring(0, clampedOffset).split('\n').length;
      final estimatedPixels = estimatedLines * 24.0;
      if (_scrollController.hasClients) {
        final maxScroll = _scrollController.position.maxScrollExtent;
        _scrollController.animateTo(
          estimatedPixels.clamp(0.0, maxScroll),
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    }
  }

  Future<void> _loadNote() async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(widget.noteId);
      if (!mounted) return;
      if (note == null) {
        setState(() {
          _noteNotFound = true;
        });
        return;
      }
      setState(() {
        _noteNotFound = false;
        _rawMarkdown = note.rawMarkdown;
        _lastSavedText = note.rawMarkdown;
        _hasUnsavedChanges = false;
        _textController.text = note.rawMarkdown;
      });
      // 加载完成后重置撤销历史与基准值，避免残留旧笔记的撤销步骤
      // （设置 _textController.text 会触发监听并误记一次历史，此处清空重来）
      ref.read(editorSessionProvider.notifier).clearHistory(widget.noteId);
      _lastRecordedValue = _textController.value;
      // 恢复搜索高亮：若会话中搜索栏开启且有关键词，重新计算匹配
      final session = ref.read(editorSessionProvider).get(widget.noteId);
      if (session.showSearchBar && session.searchText.isNotEmpty) {
        _updateMatches();
      }
      _triggerEntityRecognition(note.rawMarkdown);
      ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, note.rawMarkdown);
      ref.read(sidebarProvider.notifier).loadBacklinks(widget.noteId);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _noteNotFound = true;
      });
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(
          content: Text('加载笔记失败: $e'),
          backgroundColor: AeroColors.bgElevated,
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  /// 文本变化时防抖触发 AI 实体识别
  void _onTextChanged(String text) {
    // 保存历史记录 (撤销/重做) —— 持久化到 EditorSessionProvider
    if (!_isUndoRedo) {
      // 记录「变更前」的值，使 undo 能精确回退一步（而非先弹出当前值）
      final prev = _lastRecordedValue;
      ref
          .read(editorSessionProvider.notifier)
          .addToHistory(widget.noteId, prev);
      _lastRecordedValue = _textController.value;
    }

    _rawMarkdown = text;
    _triggerEntityRecognition(text);
    _autoSave(text);
    // 同步大纲数据
    ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, text);

    // 检查 wiki link 补全触发
    _checkWikiLinkTrigger(text);

    // 更新搜索匹配
    final session = ref.read(editorSessionProvider).get(widget.noteId);
    if (session.showSearchBar && _searchController.text.isNotEmpty) {
      _updateMatches();
    }
  }

  // ── 撤销/重做 ──
  // 历史栈持久化在 EditorSessionProvider 中，避免面板重建时丢失

  void _undo() {
    final next = ref
        .read(editorSessionProvider.notifier)
        .undo(widget.noteId, _textController.value);
    if (next == null) return;
    _isUndoRedo = true;
    _textController.value = next;
    _lastRecordedValue = next;
    _rawMarkdown = next.text;
    _triggerEntityRecognition(_rawMarkdown);
    _autoSave(_rawMarkdown);
    ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, _rawMarkdown);
    _isUndoRedo = false;
  }

  void _redo() {
    final next = ref
        .read(editorSessionProvider.notifier)
        .redo(widget.noteId, _textController.value);
    if (next == null) return;
    _isUndoRedo = true;
    _textController.value = next;
    _lastRecordedValue = next;
    _rawMarkdown = next.text;
    _triggerEntityRecognition(_rawMarkdown);
    _autoSave(_rawMarkdown);
    ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, _rawMarkdown);
    _isUndoRedo = false;
  }

  void _triggerEntityRecognition(String text) {
    final recognizer = ref.read(entityRecognizerProvider);
    recognizer.debounceRecognize(text, (result) {
      if (mounted) {
        ref
            .read(entityCacheProvider.notifier)
            .updateEntities(widget.noteId, result.entities);
      }
    });
  }

  Timer? _autoSaveTimer;
  String _lastSavedText = '';
  bool _hasUnsavedChanges = false;

  void _autoSave(String text) {
    _hasUnsavedChanges = text != _lastSavedText;
    _autoSaveTimer?.cancel();
    final delay = ref.read(settingsProvider).autoSaveDelay;
    _autoSaveTimer = Timer(delay, () {
      try {
        _doSave(text);
      } catch (e) {
        debugPrint('Error in auto-save: $e');
      }
    });
  }

  /// 执行实际保存逻辑，返回 Future 以便等待保存完成
  Future<void> _doSave(String text) async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final noteId = widget.noteId;
      final note = await repo.getNote(noteId);
      if (note == null) return;

      final links = EditorService.extractLinks(text);
      final wikiLinks = links
          .where((l) => l.isWikiLink)
          .map((l) => l.text)
          .toList();

      final newTitle = FileService.extractTitle(text, note.filePath);
      final titleChanged = newTitle != note.title;

      final updatedNote = note.copyWith(
        title: newTitle,
        rawMarkdown: text,
        updatedAt: DateTime.now(),
        outgoingLinks: wikiLinks,
      );
      await repo.saveNote(updatedNote);

      if (FileService.shouldSyncToFile(updatedNote.filePath)) {
        await FileService.syncToFile(updatedNote.filePath, text);
      }

      _lastSavedText = text;
      _hasUnsavedChanges = false;

      if (titleChanged) {
        final paneState = ref.read(paneStackProvider);
        final index = paneState.panes.indexWhere((p) => p.noteId == noteId);
        if (index >= 0) {
          ref.read(paneStackProvider.notifier).updatePaneTitle(index, newTitle);
        }
        ref.read(sidebarProvider.notifier).loadNoteTree();
      }

      VersionService.saveSnapshot(noteId, text);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(
            content: Text('保存失败: $e'),
            backgroundColor: AeroColors.bgElevated,
            duration: const Duration(seconds: 3),
          ),
        );
      }
      rethrow;
    }
  }


  // ──────────────────────────────────────────────
  // WikiLink 补全
  // ──────────────────────────────────────────────

  void _checkWikiLinkTrigger(String text) {
    if (_editorMode == EditorMode.preview) {
      if (_wikiLinkVisible) setState(() => _dismissWikiLinkCompleter());
      return;
    }

    final selection = _textController.selection;
    if (!selection.isValid || !selection.isCollapsed) {
      if (_wikiLinkVisible) setState(() => _dismissWikiLinkCompleter());
      return;
    }

    final cursorPos = selection.baseOffset;
    if (cursorPos < 2) {
      if (_wikiLinkVisible) setState(() => _dismissWikiLinkCompleter());
      return;
    }

    final textBefore = text.substring(0, cursorPos);

    final lastOpen = textBefore.lastIndexOf('[[');
    if (lastOpen == -1) {
      if (_wikiLinkVisible) setState(() => _dismissWikiLinkCompleter());
      return;
    }

    final textAfterOpen = textBefore.substring(lastOpen + 2);
    if (textAfterOpen.contains(']]') ||
        textAfterOpen.contains('\n') ||
        (lastOpen >= 1 && textBefore[lastOpen - 1] == '!')) {
      if (_wikiLinkVisible) setState(() => _dismissWikiLinkCompleter());
      return;
    }

    _wikiLinkQuery = textAfterOpen;
    _wikiLinkStart = lastOpen;

    if (!_wikiLinkVisible) {
      _wikiLinkSelectedIndex = 0;
      _wikiLinkVisible = true;
      _wikiLinkLoading = true;
      _wikiLinkSuggestions = [];
      _loadWikiLinkSuggestions();
      setState(() {});
    } else {
      _refreshWikiLinkSuggestions();
      setState(() {});
    }
  }

  Future<void> _loadWikiLinkSuggestions() async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final allNotes = await repo.getAllNotes();
      if (!_wikiLinkVisible || !mounted) return;
      _wikiLinkAllNotes = allNotes;
      _refreshSuggestionsFromNotes(allNotes);
      _wikiLinkLoading = false;
      setState(() {});
    } catch (_) {
      if (mounted) {
        setState(() {
          _wikiLinkSuggestions = [];
          _wikiLinkLoading = false;
        });
      }
    }
  }

  void _refreshWikiLinkSuggestions() {
    _wikiLinkSelectedIndex = 0;
    if (_wikiLinkAllNotes.isEmpty) return;
    _refreshSuggestionsFromNotes(_wikiLinkAllNotes);
  }

  void _refreshSuggestionsFromNotes(List<NoteModel> allNotes) {
    final query = _wikiLinkQuery;
    if (allNotes.isEmpty) {
      _wikiLinkSuggestions = [];
      return;
    }
    if (query.isEmpty) {
      _wikiLinkSuggestions = allNotes
          .take(8)
          .map((n) => WikiLinkSuggestion(noteId: n.id, title: n.title))
          .toList();
    } else {
      final matches = FuzzyMatcher.match(query, allNotes);
      _wikiLinkSuggestions = matches.take(8).map((m) {
        final note = allNotes.firstWhere(
          (n) => n.id == m.noteId,
          orElse: () => allNotes.first,
        );
        return WikiLinkSuggestion(
          noteId: m.noteId,
          title: note.title,
          matchedRanges: m.matchedRanges,
        );
      }).toList();
    }
  }

  double _getCaretLocalY() {
    final text = _textController.text;
    final cursorPos = _textController.selection.baseOffset;
    if (cursorPos < 0) return 20;
    final fontSize = ref.read(settingsProvider).fontSize;

    int line = 0;
    for (int i = 0; i < cursorPos && i < text.length; i++) {
      if (text[i] == '\n') line++;
    }

    final lineHeight = fontSize * 1.6;
    final padding = _editorMode == EditorMode.source ? 20.0 : 16.0;
    double y = line * lineHeight + padding + lineHeight;

    if (_scrollController.hasClients) {
      y -= _scrollController.offset;
    }

    if (y < 0) y = 0;

    return y;
  }

  void _dismissWikiLinkCompleter() {
    _wikiLinkVisible = false;
    _wikiLinkStart = -1;
    _wikiLinkQuery = '';
    _wikiLinkSelectedIndex = 0;
    _wikiLinkSuggestions = [];
    _wikiLinkAllNotes = [];
    _wikiLinkLoading = false;
  }

  void _applyWikiLinkCompletion(String title) {
    if (_wikiLinkStart < 0 || title.isEmpty) {
      setState(() => _dismissWikiLinkCompleter());
      if (_editorMode == EditorMode.source) {
        _focusNode.requestFocus();
      }
      return;
    }

    final text = _textController.text;
    final cursorPos = _textController.selection.baseOffset;
    final replaceStart = _wikiLinkStart;
    final replaceEnd = cursorPos;

    final completion = '[[$title]]';
    final newText = text.replaceRange(replaceStart, replaceEnd, completion);
    final newCursor = replaceStart + completion.length;

    setState(() => _dismissWikiLinkCompleter());

    _textController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: newCursor),
    );
    _onTextChanged(newText);

    if (_editorMode == EditorMode.source) {
      _focusNode.requestFocus();
    }
  }

  void _wikiLinkMoveUp() {
    if (!_wikiLinkVisible) return;
    final total = _wikiLinkTotalCount;
    if (total == 0) return;
    setState(() {
      _wikiLinkSelectedIndex =
          (_wikiLinkSelectedIndex - 1 + total) % total;
    });
  }

  void _wikiLinkMoveDown() {
    if (!_wikiLinkVisible) return;
    final total = _wikiLinkTotalCount;
    if (total == 0) return;
    setState(() {
      _wikiLinkSelectedIndex = (_wikiLinkSelectedIndex + 1) % total;
    });
  }

  void _wikiLinkConfirm() {
    if (!_wikiLinkVisible) return;
    final index = _wikiLinkSelectedIndex;
    final String title;
    if (index < _wikiLinkSuggestions.length) {
      title = _wikiLinkSuggestions[index].title;
    } else {
      title = _wikiLinkQuery;
    }
    if (title.isEmpty) {
      setState(() => _dismissWikiLinkCompleter());
      if (_editorMode == EditorMode.source) {
        _focusNode.requestFocus();
      }
      return;
    }
    _applyWikiLinkCompletion(title);
  }

  bool _handleHardwareKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;
    if (!_wikiLinkVisible) return false;

    final bool hasFocus = _editorMode == EditorMode.source
        ? _focusNode.hasFocus
        : _editorMode == EditorMode.livePreview;

    if (!hasFocus) return false;

    if (event.logicalKey == LogicalKeyboardKey.escape) {
      setState(() => _dismissWikiLinkCompleter());
      return true;
    }

    if (_wikiLinkLoading) return false;

    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      _wikiLinkMoveUp();
      return true;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      _wikiLinkMoveDown();
      return true;
    }
    if (event.logicalKey == LogicalKeyboardKey.enter ||
        event.logicalKey == LogicalKeyboardKey.tab) {
      _wikiLinkConfirm();
      return true;
    }
    return false;
  }

  // ──────────────────────────────────────────────
  // 工具栏
  // ──────────────────────────────────────────────
  Widget _buildToolbar() {
    final entities = ref.watch(entityCacheProvider).getEntities(widget.noteId);

    return EditorToolbar(
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildModeSwitchButton(),
          const SizedBox(width: AeroSpacing.sm),
          const ToolbarDivider(),
          const SizedBox(width: AeroSpacing.sm),
          if (entities.isNotEmpty)
            StatusBadge(
              text: '${entities.length} 个实体',
              icon: Icons.auto_awesome,
              color: AeroColors.accentPurple,
            ),
        ],
      ),
      actions: [
        if (_editorMode != EditorMode.preview)
          ToolbarGroup(
            children: [
              ToolbarButton(
                icon: Icons.undo,
                tooltip: '撤销 (Ctrl+Z)',
                onTap: _undo,
              ),
              ToolbarButton(
                icon: Icons.redo,
                tooltip: '重做 (Ctrl+Y)',
                onTap: _redo,
              ),
            ],
          ),
        if (_editorMode != EditorMode.preview)
          ToolbarGroup(
            children: [
              ToolbarButton(
                icon: Icons.format_bold,
                tooltip: '粗体 (Ctrl+B)',
                onTap: _applyBold,
              ),
              ToolbarButton(
                icon: Icons.format_italic,
                tooltip: '斜体 (Ctrl+I)',
                onTap: _applyItalic,
              ),
              ToolbarButton(
                icon: Icons.strikethrough_s,
                tooltip: '删除线',
                onTap: _applyStrikethrough,
              ),
            ],
          ),
        if (_editorMode != EditorMode.preview)
          ToolbarGroup(
            children: [
              ToolbarButton(
                icon: Icons.looks_one,
                tooltip: '标题 1',
                onTap: () => _applyHeading(1),
              ),
              ToolbarButton(
                icon: Icons.looks_two,
                tooltip: '标题 2',
                onTap: () => _applyHeading(2),
              ),
              ToolbarButton(
                icon: Icons.looks_3,
                tooltip: '标题 3',
                onTap: () => _applyHeading(3),
              ),
            ],
          ),
        if (_editorMode != EditorMode.preview)
          ToolbarGroup(
            children: [
              ToolbarButton(
                icon: Icons.format_list_bulleted,
                tooltip: '无序列表',
                onTap: _applyUnorderedList,
              ),
              ToolbarButton(
                icon: Icons.format_list_numbered,
                tooltip: '有序列表',
                onTap: _applyOrderedList,
              ),
              ToolbarButton(
                icon: Icons.check_box,
                tooltip: '任务列表',
                onTap: _applyTaskList,
              ),
            ],
          ),
        if (_editorMode != EditorMode.preview)
          ToolbarGroup(
            children: [
              ToolbarButton(
                icon: Icons.format_quote,
                tooltip: '引用',
                onTap: _applyQuote,
              ),
              ToolbarButton(
                icon: Icons.code,
                tooltip: '行内代码',
                onTap: _applyInlineCode,
              ),
              ToolbarButton(
                icon: Icons.link,
                tooltip: '链接 (Ctrl+Shift+K)',
                onTap: _applyLink,
              ),
            ],
          ),
        if (_editorMode != EditorMode.preview)
          ToolbarGroup(
            children: [
              ToolbarButton(
                icon: Icons.horizontal_rule,
                tooltip: '分割线',
                onTap: _applyHorizontalRule,
              ),
              ToolbarButton(
                icon: Icons.image,
                tooltip: '图片',
                onTap: _insertImage,
              ),
              ToolbarButton(
                icon: Icons.add_link,
                tooltip: 'Wiki 链接',
                onTap: _insertWikiLink,
              ),
            ],
          ),
        const SizedBox(width: AeroSpacing.xs),
        ToolbarButton(
          icon: Icons.search,
          tooltip: '搜索替换 (Ctrl+F)',
          onTap: _toggleSearchBar,
        ),
      ],
    );
  }

  // ──────────────────────────────────────────────
  // 模式切换按钮 (点击循环切换，下拉菜单选择)
  // ──────────────────────────────────────────────
  Widget _buildModeSwitchButton() {
    final modeLabels = {
      EditorMode.source: '源码',
      EditorMode.livePreview: '预览',
      EditorMode.preview: '阅读',
    };
    final modeIcons = {
      EditorMode.source: Icons.edit_note,
      EditorMode.livePreview: Icons.visibility_outlined,
      EditorMode.preview: Icons.visibility,
    };

    return PopupMenuButton<EditorMode>(
      tooltip: '切换编辑模式',
      position: PopupMenuPosition.under,
      color: AeroColors.bgElevated,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AeroRadius.sm),
        side: const BorderSide(color: AeroColors.border, width: AeroBorderWidth.thin),
      ),
      itemBuilder: (context) => EditorMode.values.map((mode) {
        final isSelected = mode == _editorMode;
        return PopupMenuItem<EditorMode>(
          value: mode,
          height: 32,
          child: Row(
            children: [
              Icon(modeIcons[mode], size: AeroIconSize.md,
                  color: isSelected ? AeroColors.accentBlue : AeroColors.textSecondary),
              const SizedBox(width: AeroSpacing.sm),
              Text(modeLabels[mode]!,
                  style: TextStyle(
                    fontSize: 13,
                    color: isSelected ? AeroColors.accentBlue : AeroColors.textPrimary,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  )),
              if (isSelected) ...[
                const Spacer(),
                const Icon(Icons.check, size: AeroIconSize.sm, color: AeroColors.accentBlue),
              ],
            ],
          ),
        );
      }).toList(),
      onSelected: _switchToMode,
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.sm),
        decoration: BoxDecoration(
          color: AeroColors.bgHover,
          borderRadius: BorderRadius.circular(AeroRadius.sm),
          border: Border.all(color: AeroColors.border, width: AeroBorderWidth.thin),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(modeIcons[_editorMode], size: AeroIconSize.md, color: AeroColors.accentBlue),
            const SizedBox(width: AeroSpacing.xs),
            Text(
              modeLabels[_editorMode]!,
              style: const TextStyle(
                fontSize: 11,
                color: AeroColors.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: AeroSpacing.xxs),
            const Icon(Icons.arrow_drop_down, size: AeroIconSize.sm, color: AeroColors.textMuted),
          ],
        ),
      ),
    );
  }

  void _switchToMode(EditorMode mode) {
    setState(() {
      _editorMode = mode;
      if (mode == EditorMode.preview) {
        _focusNode.unfocus();
        if (_wikiLinkVisible) {
          _dismissWikiLinkCompleter();
        }
      }
    });
    // 持久化到 PaneState，避免面板堆叠/恢复时丢失
    ref
        .read(paneStackProvider.notifier)
        .setPaneEditorModeByNoteId(widget.noteId, mode);
  }

  // ── 格式化操作方法 ──

  void _applyBold() {
    _wrapSelection('**', '**');
  }

  void _applyItalic() {
    _wrapSelection('*', '*');
  }

  void _applyStrikethrough() {
    _wrapSelection('~~', '~~');
  }

  void _applyInlineCode() {
    _wrapSelection('`', '`');
  }

  void _applyHeading(int level) {
    final prefix = '${'#' * level} ';
    _prependToLine(prefix);
  }

  void _applyUnorderedList() {
    _prependToLine('- ');
  }

  void _applyOrderedList() {
    _prependToLine('1. ');
  }

  void _applyTaskList() {
    _prependToLine('- [ ] ');
  }

  void _applyQuote() {
    _prependToLine('> ');
  }

  void _applyHorizontalRule() {
    _insertAtCursor('\n---\n');
  }

  void _applyLink() {
    final selection = _textController.selection;
    final text = _textController.text;
    final selectedText = selection.isValid && !selection.isCollapsed
        ? text.substring(selection.start, selection.end)
        : '';
    final newText = '[$selectedText](url)';
    _replaceSelection(newText);
  }

  void _insertImage() {
    _insertAtCursor('![alt text](image-url)');
  }

  void _insertWikiLink() {
    final selection = _textController.selection;
    final text = _textController.text;
    final selectedText = selection.isValid && !selection.isCollapsed
        ? text.substring(selection.start, selection.end)
        : '';
    final newText = '[[$selectedText]]';
    _replaceSelection(newText);
  }

  // ── 辅助方法 ──

  void _wrapSelection(String before, String after) {
    final selection = _textController.selection;
    final text = _textController.text;

    if (!selection.isValid || selection.isCollapsed) {
      final newText = text.substring(0, selection.baseOffset) +
          before +
          after +
          text.substring(selection.baseOffset);
      _textController.value = TextEditingValue(
        text: newText,
        selection:
            TextSelection.collapsed(offset: selection.baseOffset + before.length),
      );
    } else {
      final selectedText =
          text.substring(selection.start, selection.end);
      final newText = text.substring(0, selection.start) +
          before +
          selectedText +
          after +
          text.substring(selection.end);
      _textController.value = TextEditingValue(
        text: newText,
        selection: TextSelection(
          baseOffset: selection.start + before.length,
          extentOffset: selection.end + before.length,
        ),
      );
    }
    _onTextChanged(_textController.text);
  }

  void _prependToLine(String prefix) {
    final selection = _textController.selection;
    final text = _textController.text;
    if (!selection.isValid) return;
    final cursorPos = selection.baseOffset.clamp(0, text.length);

    int lineStart = cursorPos;
    while (lineStart > 0 && text[lineStart - 1] != '\n') {
      lineStart--;
    }

    final newText =
        text.substring(0, lineStart) + prefix + text.substring(lineStart);
    _textController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: lineStart + prefix.length),
    );
    _onTextChanged(newText);
  }

  void _insertAtCursor(String insertText) {
    final selection = _textController.selection;
    final text = _textController.text;
    if (!selection.isValid) return;
    final cursorPos = selection.baseOffset.clamp(0, text.length);

    final newText =
        text.substring(0, cursorPos) +
        insertText +
        text.substring(cursorPos);
    _textController.value = TextEditingValue(
      text: newText,
      selection:
          TextSelection.collapsed(offset: cursorPos + insertText.length),
    );
    _onTextChanged(newText);
  }

  void _replaceSelection(String replacement) {
    final selection = _textController.selection;
    final text = _textController.text;
    if (!selection.isValid) return;
    final start = selection.start.clamp(0, text.length);
    final end = selection.end.clamp(0, text.length);

    final newText = text.substring(0, start) +
        replacement +
        text.substring(end);
    _textController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(
        offset: start + replacement.length,
      ),
    );
    _onTextChanged(newText);
  }

  // ──────────────────────────────────────────────
  // 编辑器区域
  // ──────────────────────────────────────────────
  Widget _buildEditorArea(List<EntityHighlight> entities) {
    final editorWidget = switch (_editorMode) {
      EditorMode.source => _buildEditMode(entities),
      EditorMode.livePreview => _buildLivePreviewMode(),
      EditorMode.preview => _buildReadMode(entities),
    };

    if (_editorMode == EditorMode.preview) {
      return editorWidget;
    }

    return Shortcuts(
      shortcuts: <ShortcutActivator, Intent>{
        const SingleActivator(LogicalKeyboardKey.keyB, control: true, meta: true):
            const _FormatBoldIntent(),
        const SingleActivator(LogicalKeyboardKey.keyI, control: true, meta: true):
            const _FormatItalicIntent(),
        const SingleActivator(LogicalKeyboardKey.keyK, control: true, meta: true, shift: true):
            const _InsertLinkIntent(),
        const SingleActivator(LogicalKeyboardKey.keyZ, control: true, meta: true):
            const _UndoIntent(),
        const SingleActivator(LogicalKeyboardKey.keyY, control: true, meta: true):
            const _RedoIntent(),
        const SingleActivator(LogicalKeyboardKey.keyF, control: true, meta: true):
            const _SearchIntent(),
        const SingleActivator(LogicalKeyboardKey.escape):
            const _CloseSearchIntent(),
        const SingleActivator(LogicalKeyboardKey.enter, shift: true, alt: true):
            const _FindPreviousIntent(),
        const SingleActivator(LogicalKeyboardKey.enter, alt: true):
            const _FindNextIntent(),
      },
      child: Actions(
        actions: <Type, Action<Intent>>{
          _FormatBoldIntent: CallbackAction<_FormatBoldIntent>(
            onInvoke: (_) => _applyBold(),
          ),
          _FormatItalicIntent: CallbackAction<_FormatItalicIntent>(
            onInvoke: (_) => _applyItalic(),
          ),
          _InsertLinkIntent: CallbackAction<_InsertLinkIntent>(
            onInvoke: (_) => _applyLink(),
          ),
          _UndoIntent: CallbackAction<_UndoIntent>(
            onInvoke: (_) => _undo(),
          ),
          _RedoIntent: CallbackAction<_RedoIntent>(
            onInvoke: (_) => _redo(),
          ),
          _SearchIntent: CallbackAction<_SearchIntent>(
            onInvoke: (_) {
              if (!_session.showSearchBar) _toggleSearchBar();
              return null;
            },
          ),
          _CloseSearchIntent: CallbackAction<_CloseSearchIntent>(
            onInvoke: (_) {
              if (_wikiLinkVisible) {
                setState(() => _dismissWikiLinkCompleter());
                return null;
              }
              if (_session.showSearchBar) _toggleSearchBar();
              return null;
            },
          ),
          _FindPreviousIntent: CallbackAction<_FindPreviousIntent>(
            onInvoke: (_) => _findPrevious(),
          ),
          _FindNextIntent: CallbackAction<_FindNextIntent>(
            onInvoke: (_) => _findNext(),
          ),
        },
        child: Stack(
          children: [
            editorWidget,
            if (_wikiLinkVisible)
              Positioned(
                left: _editorMode == EditorMode.source ? 20 : 16,
                top: _getCaretLocalY(),
                child: Material(
                  color: Colors.transparent,
                  child: WikiLinkCompleter(
                    query: _wikiLinkQuery,
                    selectedIndex: _wikiLinkSelectedIndex,
                    suggestions: _wikiLinkSuggestions,
                    loading: _wikiLinkLoading,
                    onSelected: _applyWikiLinkCompletion,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildLivePreviewMode() {
    return LiveMarkdownEditor(
      key: _liveEditorKey,
      controller: _textController,
      scrollController: _scrollController,
      initialCursorOffset: _textController.selection.baseOffset,
      onWikiLinkTap: _openWikiLink,
    );
  }

  // ──────────────────────────────────────────────
  // 编辑模式
  // ──────────────────────────────────────────────
  // 修复: 不再叠加两层文字 (EntityTextEditor + TextField)，
  // 编辑模式仅使用 TextField，实体高亮仅在阅读模式显示。
  // 编辑模式下通过 toolbar 的实体计数徽标提示 AI 识别状态。
  Widget _buildEditMode(List<EntityHighlight> entities) {
    return ClipRect(
      child: Stack(
        key: _editorKey,
        children: [
          TextField(
            controller: _textController,
            focusNode: _focusNode,
            scrollController: _scrollController,
            maxLines: null,
            expands: true,
            textAlignVertical: TextAlignVertical.top,
            cursorColor: AeroColors.primary,
            cursorWidth: 1.5,
            style: Theme.of(context)
                .extension<AeroTextTheme>()!
                .codeMedium
                .copyWith(
                  fontSize:
                      ref.watch(settingsProvider.select((s) => s.fontSize)),
                  height: 1.6,
                ),
            decoration: InputDecoration(
              border: InputBorder.none,
              contentPadding: const EdgeInsets.all(20),
              hintText: '开始书写...',
              hintStyle: Theme.of(context)
                  .extension<AeroTextTheme>()!
                  .codeMedium
                  .copyWith(
                    color: AeroColors.textMuted,
                    fontSize: ref
                        .watch(settingsProvider.select((s) => s.fontSize)),
                    height: 1.6,
                  ),
            ),
            onChanged: _onTextChanged,
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────
  // 阅读模式
  // ──────────────────────────────────────────────
  Widget _buildReadMode(List<EntityHighlight> entities) {
    _wikiLinkHover ??= WikiLinkHoverHandler(context, ref);
    return SingleChildScrollView(
      controller: _scrollController,
      padding: const EdgeInsets.all(16),
      child: EntityTextEditor(
        text: _rawMarkdown,
        entities: entities,
        onEntityTap: (entity) {
          if (entity.type == EntityType.reference) {
            _openWikiLink(entity.label);
          } else {
            _showEntityCard(context, entity);
          }
        },
        onWikiLinkHover: (linkText, layerLink) {
          _wikiLinkHover?.onEnter(linkText, layerLink);
        },
        onWikiLinkExit: () {
          _wikiLinkHover?.onExit();
        },
      ),
    );
  }

  /// 打开 wiki 链接：如果笔记存在则跳转，不存在则询问创建
  Future<void> _openWikiLink(String linkText) async {
    final repo = ref.read(noteRepositoryProvider);
    final allNotes = await repo.getAllNotes();
    final lowerQuery = linkText.toLowerCase().trim();
    NoteModel? target;

    for (final note in allNotes) {
      if (note.title.toLowerCase() == lowerQuery) {
        target = note;
        break;
      }
    }

    if (target != null) {
      if (mounted) {
        ref.read(paneStackProvider.notifier).openPane(target.id, target.title);
      }
      return;
    }

    if (!mounted) return;
    final create = await showConfirmDialog(
      context,
      title: '创建笔记「$linkText」?',
      content: '未找到该笔记，是否创建新笔记？',
      confirmText: '创建',
      cancelText: '取消',
      type: ConfirmDialogType.info,
    );

    if (create == true && mounted) {
      final now = DateTime.now();
      final newNote = NoteModel(
        id: repo.generateId(),
        title: linkText,
        rawMarkdown: '# $linkText\n\n',
        filePath: '',
        createdAt: now,
        updatedAt: now,
      );
      await repo.saveNote(newNote);
      ref.read(sidebarProvider.notifier).loadNoteTree();
      if (mounted) {
        ref.read(paneStackProvider.notifier).openPane(newNote.id, newNote.title);
      }
    }
  }

  // ──────────────────────────────────────────────
  // AI 联想卡片弹窗
  // ──────────────────────────────────────────────
  void _showEntityCard(BuildContext context, EntityHighlight entity) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AeroColors.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      builder: (_) => _EntityAssociationCard(entity: entity),
    );
  }

  // ──────────────────────────────────────────────
  // 预测性关联推荐列表
  // ──────────────────────────────────────────────
  Widget _buildPredictiveLinks(List<PredictiveLink> links) {
    return Container(
      constraints: const BoxConstraints(maxHeight: 120),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(top: BorderSide(color: AeroColors.border, width: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome, size: 14, color: AeroColors.accentPurple),
                const SizedBox(width: 6),
                Text(
                  'AI 推荐关联',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AeroColors.accentPurple,
                      ),
                ),
              ],
            ),
          ),
          Flexible(
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.xs, vertical: AeroSpacing.xs),
              itemCount: links.length,
              itemBuilder: (_, i) => ChipButton(
                icon: Icons.link,
                label: links[i].targetTitle,
                subtitle: '${(links[i].relevance * 100).toInt()}% 匹配',
                color: AeroColors.accentPurple,
                onTap: () => _insertLink(links[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _insertLink(PredictiveLink link) {
    // 在当前光标位置插入 [[双向链接]]
    final selection = _textController.selection;
    final text = _textController.text;
    final insertText = '[[${link.targetTitle}]]';
    final newText = text.replaceRange(
      selection.start,
      selection.end,
      insertText,
    );
    _textController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(
        offset: selection.start + insertText.length,
      ),
    );
  }

  // ──────────────────────────────────────────────
  // 搜索替换栏
  // ──────────────────────────────────────────────

  void _toggleSearchBar() {
    final sessionNotifier = ref.read(editorSessionProvider.notifier);
    final currentlyVisible = _session.showSearchBar;
    sessionNotifier.setShowSearchBar(widget.noteId, !currentlyVisible);
    if (currentlyVisible) {
      // 关闭搜索栏时清空状态
      sessionNotifier.setShowReplace(widget.noteId, false);
      sessionNotifier.setSearchText(widget.noteId, '');
      sessionNotifier.setReplaceText(widget.noteId, '');
      _textController.clearSearch();
      _searchController.clear();
      _replaceController.clear();
    }
    setState(() {});
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.sm, vertical: AeroSpacing.sm),
      color: AeroColors.bgElevated,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 28,
                  child: TextField(
                    controller: _searchController,
                    style: const TextStyle(fontSize: 12),
                    decoration: InputDecoration(
                      hintText: '查找...',
                      hintStyle: const TextStyle(
                          fontSize: 12, color: AeroColors.textMuted),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 6),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AeroRadius.sm),
                        borderSide:
                            const BorderSide(color: AeroColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AeroRadius.sm),
                        borderSide:
                            const BorderSide(color: AeroColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AeroRadius.sm),
                        borderSide:
                            const BorderSide(color: AeroColors.accentBlue),
                      ),
                      suffixIcon: _textController.searchMatches.isNotEmpty
                          ? Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Text(
                                '${_textController.currentMatchIndex + 1}/${_textController.searchMatches.length}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AeroColors.textMuted,
                                ),
                              ),
                            )
                          : null,
                      suffixIconConstraints: const BoxConstraints(
                        minWidth: 0,
                        minHeight: 0,
                      ),
                    ),
                    onChanged: (value) {
                      ref
                          .read(editorSessionProvider.notifier)
                          .setSearchText(widget.noteId, value);
                      _updateMatches();
                    },
                    onSubmitted: (_) => _findNext(),
                  ),
                ),
              ),
              const SizedBox(width: AeroSpacing.xs),
              ToolbarButton(
                icon: Icons.arrow_upward,
                tooltip: '上一个',
                onTap: _findPrevious,
                size: 24,
                iconSize: 14,
              ),
              ToolbarButton(
                icon: Icons.arrow_downward,
                tooltip: '下一个',
                onTap: _findNext,
                size: 24,
                iconSize: 14,
              ),
              ToolbarButton(
                icon: Icons.close,
                tooltip: '关闭',
                onTap: _toggleSearchBar,
                size: 24,
                iconSize: 14,
              ),
            ],
          ),
          if (_session.showReplace) ...[
            const SizedBox(height: AeroSpacing.xs),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 28,
                    child: TextField(
                      controller: _replaceController,
                      style: const TextStyle(fontSize: 12),
                      onChanged: (value) {
                        ref
                            .read(editorSessionProvider.notifier)
                            .setReplaceText(widget.noteId, value);
                      },
                      decoration: InputDecoration(
                        hintText: '替换为...',
                        hintStyle: const TextStyle(
                            fontSize: 12, color: AeroColors.textMuted),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 6),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AeroRadius.sm),
                          borderSide:
                              const BorderSide(color: AeroColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AeroRadius.sm),
                          borderSide:
                              const BorderSide(color: AeroColors.border),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AeroRadius.sm),
                          borderSide:
                              const BorderSide(color: AeroColors.accentBlue),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AeroSpacing.xs),
                ToolbarButton(
                  icon: Icons.find_replace,
                  tooltip: '替换',
                  onTap: _replaceOne,
                  size: 24,
                  iconSize: 14,
                ),
                ToolbarButton(
                  icon: Icons.select_all,
                  tooltip: '全部替换',
                  onTap: _replaceAll,
                  size: 24,
                  iconSize: 14,
                ),
              ],
            ),
          ],
          const SizedBox(height: AeroSpacing.xs / 2),
          Row(
            children: [
              InkWell(
                onTap: () {
                  ref
                      .read(editorSessionProvider.notifier)
                      .setShowReplace(widget.noteId, !_session.showReplace);
                },
                child: Text(
                  _session.showReplace ? '隐藏替换' : '显示替换',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AeroColors.accentBlue,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _updateMatches() {
    final query = _searchController.text;
    _textController.updateSearch(query);
    setState(() {});
    if (_textController.searchMatches.isNotEmpty) {
      _scrollToMatch();
    }
  }

  void _findNext() {
    final matches = _textController.searchMatches;
    if (matches.isEmpty) return;
    final nextIndex = (_textController.currentMatchIndex + 1) % matches.length;
    _textController.setCurrentMatchIndex(nextIndex);
    _scrollToMatch();
  }

  void _findPrevious() {
    final matches = _textController.searchMatches;
    if (matches.isEmpty) return;
    var prevIndex = _textController.currentMatchIndex - 1;
    if (prevIndex < 0) {
      prevIndex = matches.length - 1;
    }
    _textController.setCurrentMatchIndex(prevIndex);
    _scrollToMatch();
  }

  void _scrollToMatch() {
    final matches = _textController.searchMatches;
    final currentIndex = _textController.currentMatchIndex;
    if (currentIndex < 0 || currentIndex >= matches.length) return;
    final match = matches[currentIndex];
    _textController.selection = TextSelection(
      baseOffset: match.start,
      extentOffset: match.end,
    );
    _focusNode.requestFocus();
  }

  void _replaceOne() {
    final matches = _textController.searchMatches;
    final currentIndex = _textController.currentMatchIndex;
    if (matches.isEmpty || currentIndex < 0) return;
    final match = matches[currentIndex];
    final replaceText = _replaceController.text;
    final text = _textController.text;
    final newText = text.replaceRange(match.start, match.end, replaceText);
    _textController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: match.start + replaceText.length),
    );
    _onTextChanged(newText);
    _updateMatches();
  }

  void _replaceAll() {
    final matches = _textController.searchMatches;
    if (matches.isEmpty) return;
    final query = _searchController.text;
    final replaceText = _replaceController.text;
    final text = _textController.text;
    final newText = text.replaceAllMapped(
      RegExp(RegExp.escape(query), caseSensitive: false),
      (_) => replaceText,
    );
    _textController.value = TextEditingValue(
      text: newText,
      selection: const TextSelection.collapsed(offset: 0),
    );
    _onTextChanged(newText);
    _updateMatches();
  }

  // ──────────────────────────────────────────────
  // 状态栏
  // ──────────────────────────────────────────────

  Widget _buildStatusBar() {
    final stats = EditorService.computeStats(_textController.text);
    final selection = _textController.selection;
    final cursorLine = _getCursorLine(selection);
    final cursorCol = _getCursorColumn(selection);
    final showCursorInfo = _editorMode == EditorMode.source ||
        _editorMode == EditorMode.livePreview;

    return Container(
      height: 26,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
          top: BorderSide(color: AeroColors.border, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          // 左侧：保存状态
          _buildSaveStatus(),
          const SizedBox(width: 12),
          // 模式指示
          _buildModeIndicator(),
          const Spacer(),
          // 右侧：光标位置
          if (showCursorInfo && selection.isValid && selection.isCollapsed)
            Text(
              '行 $cursorLine, 列 $cursorCol',
              style: const TextStyle(
                color: AeroColors.textMuted,
                fontSize: 10,
              ),
            ),
          if (showCursorInfo && selection.isValid && !selection.isCollapsed)
            Text(
              '已选择 ${selection.end - selection.start} 字符',
              style: const TextStyle(
                color: AeroColors.textMuted,
                fontSize: 10,
              ),
            ),
          if (showCursorInfo) const SizedBox(width: 12),
          // 统计信息
          Text(
            '${stats.wordCount} 字',
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 10,
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '${stats.lineCount} 行',
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 10,
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '${stats.readingTimeMinutes} 分钟',
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSaveStatus() {
    if (_hasUnsavedChanges) {
      return const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: 6, color: AeroColors.accentOrange),
          SizedBox(width: 4),
          Text('未保存',
              style: TextStyle(color: AeroColors.accentOrange, fontSize: 10)),
        ],
      );
    }
    return const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.check_circle_outline, size: 12, color: AeroColors.accentGreen),
        SizedBox(width: 4),
        Text('已保存',
            style: TextStyle(color: AeroColors.accentGreen, fontSize: 10)),
      ],
    );
  }

  Widget _buildModeIndicator() {
    String label;
    IconData icon;
    switch (_editorMode) {
      case EditorMode.source:
        label = 'Markdown';
        icon = Icons.code;
        break;
      case EditorMode.livePreview:
        label = '实时预览';
        icon = Icons.visibility_outlined;
        break;
      case EditorMode.preview:
        label = '阅读';
        icon = Icons.visibility;
        break;
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AeroColors.textMuted),
        const SizedBox(width: 3),
        Text(label, style: const TextStyle(color: AeroColors.textMuted, fontSize: 10)),
      ],
    );
  }

  int _getCursorLine(TextSelection selection) {
    if (!selection.isValid || !selection.isCollapsed) return 1;
    final textBefore = _textController.text.substring(0, selection.baseOffset);
    return textBefore.split('\n').length;
  }

  int _getCursorColumn(TextSelection selection) {
    if (!selection.isValid || !selection.isCollapsed) return 1;
    final textBefore = _textController.text.substring(0, selection.baseOffset);
    final lastNewline = textBefore.lastIndexOf('\n');
    if (lastNewline == -1) return selection.baseOffset + 1;
    return selection.baseOffset - lastNewline;
  }

  Widget _buildNoteNotFound() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.error_outline,
            size: 48,
            color: AeroColors.textMuted,
          ),
          const SizedBox(height: 16),
          const Text(
            '笔记未找到',
            style: TextStyle(
              fontSize: 16,
              color: AeroColors.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            '该笔记可能已被删除',
            style: TextStyle(
              fontSize: 12,
              color: AeroColors.textMuted,
            ),
          ),
          const SizedBox(height: 20),
          TextButton.icon(
            onPressed: () {
              final paneState = ref.read(paneStackProvider);
              final index = paneState.panes.indexWhere((p) => p.noteId == widget.noteId);
              if (index >= 0) {
                ref.read(paneStackProvider.notifier).closePane(index);
              }
            },
            icon: const Icon(Icons.close, size: 16),
            label: const Text('关闭面板'),
          ),
        ],
      ),
    );
  }
}

/// AI 联想卡片 (点击实体后弹出)
class _EntityAssociationCard extends ConsumerWidget {
  final EntityHighlight entity;

  const _EntityAssociationCard({required this.entity});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final linkedNote = entity.linkedNoteId != null
        ? ref.watch(noteByIdProvider(entity.linkedNoteId!))
        : null;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 实体标签
          Row(
            children: [
              _TypeChip(type: entity.type),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  entity.label,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              // 置信度
              Text(
                '${(entity.confidence * 100).toInt()}%',
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 关联笔记
          if (entity.linkedNoteId != null && linkedNote != null)
            linkedNote.when(
              data: (note) => note != null
                  ? _LinkedNotePreview(note: note)
                  : const Text('未找到关联笔记'),
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('加载失败: $e'),
            )
          else
            Text(
              '未发现本地关联笔记。AI 建议创建新笔记。',
              style: Theme.of(context).textTheme.bodySmall,
            ),

          const SizedBox(height: 16),

          // 操作按钮
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.search, size: 16),
                  label: const Text('搜索相关笔记'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AeroColors.accentBlue,
                    side: const BorderSide(color: AeroColors.border),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.add_link, size: 16),
                  label: const Text('创建链接'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AeroColors.accentBlue,
                    foregroundColor: AeroColors.bgDeep,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  final EntityType type;

  const _TypeChip({required this.type});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (type) {
      EntityType.concept => ('概念', AeroColors.accentBlue),
      EntityType.person => ('人物', AeroColors.accentPurple),
      EntityType.task => ('任务', AeroColors.accentCyan),
      EntityType.quote => ('引文', AeroColors.accentOrange),
      EntityType.reference => ('引用', AeroColors.accentGreen),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Builder(
        builder: (context) => Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: color,
              ),
        ),
      ),
    );
  }
}

class _LinkedNotePreview extends StatelessWidget {
  final NoteModel note;

  const _LinkedNotePreview({required this.note});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AeroColors.bgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AeroColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            note.title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AeroColors.textLink,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            note.rawMarkdown.length > 100
                ? '${note.rawMarkdown.substring(0, 100)}...'
                : note.rawMarkdown,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

// ── 编辑器快捷键 Intent ──

class _FormatBoldIntent extends Intent {
  const _FormatBoldIntent();
}

class _FormatItalicIntent extends Intent {
  const _FormatItalicIntent();
}

class _InsertLinkIntent extends Intent {
  const _InsertLinkIntent();
}

class _UndoIntent extends Intent {
  const _UndoIntent();
}

class _RedoIntent extends Intent {
  const _RedoIntent();
}

class _SearchIntent extends Intent {
  const _SearchIntent();
}

class _CloseSearchIntent extends Intent {
  const _CloseSearchIntent();
}

class _FindNextIntent extends Intent {
  const _FindNextIntent();
}

class _FindPreviousIntent extends Intent {
  const _FindPreviousIntent();
}
