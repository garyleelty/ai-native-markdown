import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/note_model.dart';
import '../../../core/models/predictive_link.dart';
import '../../../core/services/version_service.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/ai_provider.dart';
import '../../../providers/note_provider.dart';
import '../../../providers/sidebar_provider.dart';
import '../../../providers/pane_provider.dart';
import '../../../providers/settings_provider.dart';
import '../services/editor_service.dart';
import 'entity_text_editor.dart';
import 'live_markdown_editor.dart';
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
  late final TextEditingController _textController;
  late final FocusNode _focusNode;
  late final ScrollController _scrollController;
  EditorMode _editorMode = EditorMode.source; // 三种模式
  String _rawMarkdown = '';
  DateTime? _lastHandledScrollRequest;

  // 撤销/重做
  final List<_HistoryItem> _undoStack = [];
  final List<_HistoryItem> _redoStack = [];
  bool _isUndoRedo = false;
  static const int _maxHistorySize = 100;

  // 搜索替换
  bool _showSearchBar = false;
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _replaceController = TextEditingController();
  int _currentMatchIndex = -1;
  final List<TextRange> _matches = [];
  bool _showReplace = false;

  // wiki link 悬浮预览
  WikiLinkHoverHandler? _wikiLinkHover;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController();
    _focusNode = FocusNode();
    _scrollController = ScrollController();
    _textController.addListener(_onControllerTextChanged);
    _loadNote();
  }

  void _onControllerTextChanged() {
    if (_editorMode == EditorMode.livePreview) {
      _onTextChanged(_textController.text);
    }
  }

  @override
  void dispose() {
    _autoSaveTimer?.cancel();
    _textController.removeListener(_onControllerTextChanged);
    _textController.dispose();
    _focusNode.dispose();
    _scrollController.dispose();
    _searchController.dispose();
    _replaceController.dispose();
    _wikiLinkHover?.dispose();
    super.dispose();
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
            _lastHandledScrollRequest == req.timestamp) return;
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── 模式切换工具栏 ──
        _buildToolbar(),
        const Divider(height: 1, thickness: 0.5),

        // ── 搜索替换栏 ──
        if (_showSearchBar) _buildSearchBar(),

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

    // 编辑模式：通过移动光标来触发滚动
    if (_editorMode == EditorMode.source) {
      _textController.selection = TextSelection.collapsed(offset: clampedOffset);
      _focusNode.requestFocus();
      // 给一帧时间让 TextField 响应 selection 变化并自动滚动
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_scrollController.hasClients) return;
        // 额外调整：确保光标在可视区域中间
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
    final repo = ref.read(noteRepositoryProvider);
    final note = await repo.getNote(widget.noteId);
    if (note != null && mounted) {
      setState(() {
        _rawMarkdown = note.rawMarkdown;
        _textController.text = note.rawMarkdown;
      });
      // 加载完成后立即触发一次实体识别
      _triggerEntityRecognition(note.rawMarkdown);
      // 同步大纲数据
      ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, note.rawMarkdown);
      // 加载反向链接
      ref.read(sidebarProvider.notifier).loadBacklinks(widget.noteId);
    }
  }

  /// 文本变化时防抖触发 AI 实体识别
  void _onTextChanged(String text) {
    // 保存历史记录 (撤销/重做)
    if (!_isUndoRedo) {
      _addToHistory(_textController.value);
    }

    _rawMarkdown = text;
    _triggerEntityRecognition(text);
    _autoSave(text);
    // 同步大纲数据
    ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, text);

    // 更新搜索匹配
    if (_showSearchBar && _searchController.text.isNotEmpty) {
      _updateMatches();
    }
  }

  // ── 撤销/重做 ──

  void _addToHistory(TextEditingValue value) {
    if (_undoStack.isNotEmpty && _undoStack.last.value.text == value.text) {
      return;
    }
    _undoStack.add(_HistoryItem(
      value: value,
      timestamp: DateTime.now(),
    ));
    if (_undoStack.length > _maxHistorySize) {
      _undoStack.removeAt(0);
    }
    _redoStack.clear();
  }

  void _undo() {
    if (_undoStack.isEmpty) return;
    _isUndoRedo = true;
    final item = _undoStack.removeLast();
    _redoStack.add(_HistoryItem(
      value: _textController.value,
      timestamp: DateTime.now(),
    ));
    _textController.value = item.value;
    _rawMarkdown = item.value.text;
    _triggerEntityRecognition(_rawMarkdown);
    _autoSave(_rawMarkdown);
    ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, _rawMarkdown);
    _isUndoRedo = false;
  }

  void _redo() {
    if (_redoStack.isEmpty) return;
    _isUndoRedo = true;
    final item = _redoStack.removeLast();
    _undoStack.add(_HistoryItem(
      value: _textController.value,
      timestamp: DateTime.now(),
    ));
    _textController.value = item.value;
    _rawMarkdown = item.value.text;
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
  void _autoSave(String text) {
    _autoSaveTimer?.cancel();
    _autoSaveTimer = Timer(const Duration(seconds: 2), () async {
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(widget.noteId);
      if (note != null) {
        // 提取链接
        final links = EditorService.extractLinks(text);
        final wikiLinks = links
            .where((l) => l.isWikiLink)
            .map((l) => l.text)
            .toList();

        await repo.saveNote(note.copyWith(
          rawMarkdown: text,
          updatedAt: DateTime.now(),
          outgoingLinks: wikiLinks,
        ));

        // 保存版本快照
        await VersionService.saveSnapshot(widget.noteId, text);
      }
    });
  }

  // ──────────────────────────────────────────────
  // 工具栏
  // ──────────────────────────────────────────────
  Widget _buildToolbar() {
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      color: AeroColors.bgSurface,
      child: Row(
        children: [
          // 编辑模式切换 (三态循环)
          _buildModeSwitchButton(),
          const SizedBox(width: 4),
          // 实体统计
          if (ref.watch(entityCacheProvider).getEntities(widget.noteId).isNotEmpty)
            _EntityCountBadge(
              entities:
                  ref.watch(entityCacheProvider).getEntities(widget.noteId),
            ),
          const SizedBox(width: 8),
          // Markdown 格式快捷按钮 (源码和实时预览模式下显示)
          if (_editorMode != EditorMode.preview)
            Expanded(
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _ToolbarButton(
                    icon: Icons.undo,
                    tooltip: '撤销 (Ctrl+Z)',
                    onTap: _undo,
                  ),
                  _ToolbarButton(
                    icon: Icons.redo,
                    tooltip: '重做 (Ctrl+Y)',
                    onTap: _redo,
                  ),
                  _toolbarDivider(),
                  _ToolbarButton(
                    icon: Icons.format_bold,
                    tooltip: '粗体 (Ctrl+B)',
                    onTap: _applyBold,
                  ),
                  _ToolbarButton(
                    icon: Icons.format_italic,
                    tooltip: '斜体 (Ctrl+I)',
                    onTap: _applyItalic,
                  ),
                  _ToolbarButton(
                    icon: Icons.strikethrough_s,
                    tooltip: '删除线',
                    onTap: _applyStrikethrough,
                  ),
                  _toolbarDivider(),
                  _ToolbarButton(
                    icon: Icons.looks_one,
                    tooltip: '标题 1',
                    onTap: () => _applyHeading(1),
                  ),
                  _ToolbarButton(
                    icon: Icons.looks_two,
                    tooltip: '标题 2',
                    onTap: () => _applyHeading(2),
                  ),
                  _ToolbarButton(
                    icon: Icons.looks_3,
                    tooltip: '标题 3',
                    onTap: () => _applyHeading(3),
                  ),
                  _toolbarDivider(),
                  _ToolbarButton(
                    icon: Icons.format_list_bulleted,
                    tooltip: '无序列表',
                    onTap: _applyUnorderedList,
                  ),
                  _ToolbarButton(
                    icon: Icons.format_list_numbered,
                    tooltip: '有序列表',
                    onTap: _applyOrderedList,
                  ),
                  _ToolbarButton(
                    icon: Icons.check_box,
                    tooltip: '任务列表',
                    onTap: _applyTaskList,
                  ),
                  _toolbarDivider(),
                  _ToolbarButton(
                    icon: Icons.format_quote,
                    tooltip: '引用',
                    onTap: _applyQuote,
                  ),
                  _ToolbarButton(
                    icon: Icons.code,
                    tooltip: '行内代码',
                    onTap: _applyInlineCode,
                  ),
                  _ToolbarButton(
                    icon: Icons.horizontal_rule,
                    tooltip: '分割线',
                    onTap: _applyHorizontalRule,
                  ),
                  _toolbarDivider(),
                  _ToolbarButton(
                    icon: Icons.link,
                    tooltip: '链接 (Ctrl+K)',
                    onTap: _applyLink,
                  ),
                  _ToolbarButton(
                    icon: Icons.image,
                    tooltip: '图片',
                    onTap: _insertImage,
                  ),
                  _ToolbarButton(
                    icon: Icons.insert_link,
                    tooltip: '双向链接',
                    onTap: _insertWikiLink,
                  ),
                ],
              ),
            ),
          if (_editorMode == EditorMode.preview) const Spacer(),
          // 搜索按钮
          _ToolbarButton(
            icon: Icons.search,
            tooltip: '搜索替换 (Ctrl+F)',
            onTap: _toggleSearchBar,
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────
  // 模式切换按钮 (三态循环)
  // ──────────────────────────────────────────────
  Widget _buildModeSwitchButton() {
    IconData icon;
    String tooltip;
    switch (_editorMode) {
      case EditorMode.source:
        icon = Icons.edit_note;
        tooltip = '源码模式（点击切换到实时预览）';
        break;
      case EditorMode.livePreview:
        icon = Icons.visibility_outlined;
        tooltip = '实时预览（点击切换到阅读模式）';
        break;
      case EditorMode.preview:
        icon = Icons.visibility;
        tooltip = '阅读模式（点击切换到源码模式）';
        break;
    }

    return PopupMenuButton<EditorMode>(
      itemBuilder: (context) => [
        PopupMenuItem(
          value: EditorMode.source,
          child: Row(
            children: [
              Icon(Icons.edit_note, size: 16,
                  color: _editorMode == EditorMode.source
                      ? AeroColors.accentBlue
                      : AeroColors.textSecondary),
              const SizedBox(width: 8),
              Text('源码模式',
                  style: TextStyle(
                    fontSize: 12,
                    color: _editorMode == EditorMode.source
                        ? AeroColors.accentBlue
                        : AeroColors.textPrimary,
                    fontWeight: _editorMode == EditorMode.source
                        ? FontWeight.w600
                        : FontWeight.w400,
                  )),
            ],
          ),
        ),
        PopupMenuItem(
          value: EditorMode.livePreview,
          child: Row(
            children: [
              Icon(Icons.visibility_outlined, size: 16,
                  color: _editorMode == EditorMode.livePreview
                      ? AeroColors.accentBlue
                      : AeroColors.textSecondary),
              const SizedBox(width: 8),
              Text('实时预览',
                  style: TextStyle(
                    fontSize: 12,
                    color: _editorMode == EditorMode.livePreview
                        ? AeroColors.accentBlue
                        : AeroColors.textPrimary,
                    fontWeight: _editorMode == EditorMode.livePreview
                        ? FontWeight.w600
                        : FontWeight.w400,
                  )),
            ],
          ),
        ),
        PopupMenuItem(
          value: EditorMode.preview,
          child: Row(
            children: [
              Icon(Icons.visibility, size: 16,
                  color: _editorMode == EditorMode.preview
                      ? AeroColors.accentBlue
                      : AeroColors.textSecondary),
              const SizedBox(width: 8),
              Text('阅读模式',
                  style: TextStyle(
                    fontSize: 12,
                    color: _editorMode == EditorMode.preview
                        ? AeroColors.accentBlue
                        : AeroColors.textPrimary,
                    fontWeight: _editorMode == EditorMode.preview
                        ? FontWeight.w600
                        : FontWeight.w400,
                  )),
            ],
          ),
        ),
      ],
      onSelected: (mode) {
        setState(() {
          _editorMode = mode;
          if (mode == EditorMode.preview) {
            _focusNode.unfocus();
          }
        });
      },
      child: _ToolbarButton(
        icon: icon,
        tooltip: tooltip,
        onTap: () {
          // 单击循环切换
          setState(() {
            switch (_editorMode) {
              case EditorMode.source:
                _editorMode = EditorMode.livePreview;
                break;
              case EditorMode.livePreview:
                _editorMode = EditorMode.preview;
                _focusNode.unfocus();
                break;
              case EditorMode.preview:
                _editorMode = EditorMode.source;
                break;
            }
          });
        },
      ),
    );
  }

  Widget _toolbarDivider() {
    return Container(
      width: 1,
      height: 16,
      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      color: AeroColors.divider,
    );
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
    final cursorPos = selection.baseOffset;

    int lineStart = cursorPos;
    while (lineStart > 0 && text[lineStart - 1] != '\n') {
      lineStart--;
    }

    final newText =
        text.substring(0, lineStart) + prefix + text.substring(lineStart);
    _textController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: cursorPos + prefix.length),
    );
    _onTextChanged(newText);
  }

  void _insertAtCursor(String insertText) {
    final selection = _textController.selection;
    final text = _textController.text;
    final cursorPos = selection.baseOffset;

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

    final newText = text.substring(0, selection.start) +
        replacement +
        text.substring(selection.end);
    _textController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(
        offset: selection.start + replacement.length,
      ),
    );
    _onTextChanged(newText);
  }

  // ──────────────────────────────────────────────
  // 编辑器区域
  // ──────────────────────────────────────────────
  Widget _buildEditorArea(List<EntityHighlight> entities) {
    switch (_editorMode) {
      case EditorMode.source:
        return _buildEditMode(entities);
      case EditorMode.livePreview:
        return _buildLivePreviewMode();
      case EditorMode.preview:
        return _buildReadMode(entities);
    }
  }

  Widget _buildLivePreviewMode() {
    return LiveMarkdownEditor(
      controller: _textController,
      scrollController: _scrollController,
    );
  }

  // ──────────────────────────────────────────────
  // 编辑模式
  // ──────────────────────────────────────────────
  // 修复: 不再叠加两层文字 (EntityTextEditor + TextField)，
  // 编辑模式仅使用 TextField，实体高亮仅在阅读模式显示。
  // 编辑模式下通过 toolbar 的实体计数徽标提示 AI 识别状态。
  Widget _buildEditMode(List<EntityHighlight> entities) {
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
        const SingleActivator(LogicalKeyboardKey.enter, shift: true):
            const _FindPreviousIntent(),
        const SingleActivator(LogicalKeyboardKey.enter):
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
              if (!_showSearchBar) _toggleSearchBar();
              return null;
            },
          ),
          _CloseSearchIntent: CallbackAction<_CloseSearchIntent>(
            onInvoke: (_) {
              if (_showSearchBar) _toggleSearchBar();
              return null;
            },
          ),
          _FindNextIntent: CallbackAction<_FindNextIntent>(
            onInvoke: (_) => _findNext(),
          ),
          _FindPreviousIntent: CallbackAction<_FindPreviousIntent>(
            onInvoke: (_) => _findPrevious(),
          ),
        },
        child: Focus(
          autofocus: true,
          child: TextField(
            controller: _textController,
            focusNode: _focusNode,
            scrollController: _scrollController,
            maxLines: null,
            expands: true,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontSize: ref.watch(settingsProvider.select((s) => s.fontSize)),
                ),
            decoration: InputDecoration(
              border: InputBorder.none,
              contentPadding: const EdgeInsets.all(16),
              hintText: '开始书写...',
              hintStyle: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(
                    color: AeroColors.textMuted,
                    fontSize: ref.watch(settingsProvider.select((s) => s.fontSize)),
                  ),
            ),
            onChanged: _onTextChanged,
          ),
        ),
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
        onEntityTap: (entity) => _showEntityCard(context, entity),
        onWikiLinkHover: (linkText, layerLink) {
          _wikiLinkHover?.onEnter(linkText, layerLink);
        },
        onWikiLinkExit: () {
          _wikiLinkHover?.onExit();
        },
      ),
    );
  }

  // ──────────────────────────────────────────────
  // AI 联想卡片弹窗
  // ──────────────────────────────────────────────
  void _showEntityCard(BuildContext context, EntityHighlight entity) {
    showModalBottomSheet(
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
                Icon(Icons.auto_awesome, size: 14, color: AeroColors.accentPurple),
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
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              itemCount: links.length,
              itemBuilder: (_, i) => _PredictiveLinkChip(
                link: links[i],
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
    setState(() {
      _showSearchBar = !_showSearchBar;
      if (!_showSearchBar) {
        _showReplace = false;
        _matches.clear();
        _currentMatchIndex = -1;
        _searchController.clear();
        _replaceController.clear();
      }
    });
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
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
                        borderRadius: BorderRadius.circular(4),
                        borderSide:
                            const BorderSide(color: AeroColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(4),
                        borderSide:
                            const BorderSide(color: AeroColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(4),
                        borderSide:
                            const BorderSide(color: AeroColors.accentBlue),
                      ),
                      suffixIcon: _matches.isNotEmpty
                          ? Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Text(
                                '${_currentMatchIndex + 1}/${_matches.length}',
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
                    onChanged: (_) => _updateMatches(),
                    onSubmitted: (_) => _findNext(),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              _SearchMiniButton(
                icon: Icons.arrow_upward,
                tooltip: '上一个',
                onTap: _findPrevious,
              ),
              _SearchMiniButton(
                icon: Icons.arrow_downward,
                tooltip: '下一个',
                onTap: _findNext,
              ),
              _SearchMiniButton(
                icon: Icons.close,
                tooltip: '关闭',
                onTap: _toggleSearchBar,
              ),
            ],
          ),
          if (_showReplace) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 28,
                    child: TextField(
                      controller: _replaceController,
                      style: const TextStyle(fontSize: 12),
                      decoration: InputDecoration(
                        hintText: '替换为...',
                        hintStyle: const TextStyle(
                            fontSize: 12, color: AeroColors.textMuted),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 6),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(4),
                          borderSide:
                              const BorderSide(color: AeroColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(4),
                          borderSide:
                              const BorderSide(color: AeroColors.border),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(4),
                          borderSide:
                              const BorderSide(color: AeroColors.accentBlue),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                _SearchMiniButton(
                  icon: Icons.find_replace,
                  tooltip: '替换',
                  onTap: _replaceOne,
                ),
                _SearchMiniButton(
                  icon: Icons.select_all,
                  tooltip: '全部替换',
                  onTap: _replaceAll,
                ),
              ],
            ),
          ],
          const SizedBox(height: 4),
          Row(
            children: [
              InkWell(
                onTap: () => setState(() => _showReplace = !_showReplace),
                child: Text(
                  _showReplace ? '隐藏替换' : '显示替换',
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
    final text = _textController.text;
    _matches.clear();

    if (query.isEmpty) {
      setState(() {
        _currentMatchIndex = -1;
      });
      return;
    }

    int start = 0;
    while (true) {
      final index = text.toLowerCase().indexOf(query.toLowerCase(), start);
      if (index == -1) break;
      _matches.add(TextRange(start: index, end: index + query.length));
      start = index + query.length;
    }

    setState(() {
      if (_matches.isNotEmpty) {
        _currentMatchIndex = 0;
        _scrollToMatch();
      } else {
        _currentMatchIndex = -1;
      }
    });
  }

  void _findNext() {
    if (_matches.isEmpty) return;
    setState(() {
      _currentMatchIndex = (_currentMatchIndex + 1) % _matches.length;
      _scrollToMatch();
    });
  }

  void _findPrevious() {
    if (_matches.isEmpty) return;
    setState(() {
      _currentMatchIndex = _currentMatchIndex - 1;
      if (_currentMatchIndex < 0) {
        _currentMatchIndex = _matches.length - 1;
      }
      _scrollToMatch();
    });
  }

  void _scrollToMatch() {
    if (_currentMatchIndex < 0 || _currentMatchIndex >= _matches.length) return;
    final match = _matches[_currentMatchIndex];
    _textController.selection = TextSelection(
      baseOffset: match.start,
      extentOffset: match.end,
    );
    _focusNode.requestFocus();
  }

  void _replaceOne() {
    if (_matches.isEmpty || _currentMatchIndex < 0) return;
    final match = _matches[_currentMatchIndex];
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
    if (_matches.isEmpty) return;
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

    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      color: AeroColors.bgSurface,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Text(
            '${stats.wordCount} 字',
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 10,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '${stats.charCount} 字符',
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 10,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '${stats.lineCount} 行',
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 10,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '${stats.paragraphCount} 段',
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 10,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '阅读 ${stats.readingTimeMinutes} 分钟',
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────
// 子组件
// ──────────────────────────────────────────────

class _ToolbarButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _ToolbarButton({
    required this.icon,
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
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Icon(icon, size: 16, color: AeroColors.textSecondary),
        ),
      ),
    );
  }
}

/// 实体计数徽标
class _EntityCountBadge extends StatelessWidget {
  final List<EntityHighlight> entities;

  const _EntityCountBadge({required this.entities});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AeroColors.accentPurple.withOpacity(0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Builder(
        builder: (context) => Text(
          '${entities.length} 个实体',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                fontSize: 10,
                color: AeroColors.accentPurple,
              ),
        ),
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
            linkedNote!.when(
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
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
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

class _PredictiveLinkChip extends StatelessWidget {
  final PredictiveLink link;
  final VoidCallback onTap;

  const _PredictiveLinkChip({
    required this.link,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: ActionChip(
        onPressed: onTap,
        backgroundColor: AeroColors.bgSurface,
        side: BorderSide(color: AeroColors.accentGreen.withOpacity(0.3)),
        avatar: Icon(Icons.link, size: 14, color: AeroColors.accentGreen),
        label: Builder(
          builder: (context) => Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                link.targetTitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AeroColors.textPrimary,
                    ),
              ),
              Text(
                link.reason,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontSize: 9,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── 历史记录项 ──

class _HistoryItem {
  final TextEditingValue value;
  final DateTime timestamp;

  _HistoryItem({
    required this.value,
    required this.timestamp,
  });
}

// ── 搜索栏小按钮 ──

class _SearchMiniButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _SearchMiniButton({
    required this.icon,
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
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Icon(icon, size: 14, color: AeroColors.textSecondary),
        ),
      ),
    );
  }
}

// ── 编辑器模式 ──

enum EditorMode {
  source,    // 源码模式
  livePreview, // 实时预览
  preview,   // 阅读模式
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
