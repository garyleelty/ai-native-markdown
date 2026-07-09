#!/usr/bin/env python3
import os

NOTE_PANEL = '/Users/tianyi/code/ai-native-markdown/lib/features/editor/widgets/note_panel.dart'
PANE_PROVIDER = '/Users/tianyi/code/ai-native-markdown/lib/providers/pane_provider.dart'
CALENDAR_VIEW = '/Users/tianyi/code/ai-native-markdown/lib/features/calendar/widgets/calendar_view.dart'

# Fix A-E for note_panel.dart
with open(NOTE_PANEL, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix B: Add _noteNotFound state flag after line 48
old_b = '  DateTime? _lastHandledScrollRequest;\n\n  // 撤销/重做'
new_b = '  DateTime? _lastHandledScrollRequest;\n  bool _noteNotFound = false;\n\n  // 撤销/重做'
assert old_b in content, "Fix B anchor not found"
content = content.replace(old_b, new_b, 1)

# Fix A: Replace _syncToFile method
old_a = '''  void _syncToFile(String filePath, String content) {
    try {
      File(filePath).writeAsString(content).catchError((_) => File(filePath));
    } catch (_) {}
  }'''
new_a = '''  Future<void> _syncToFile(String filePath, String content) async {
    try {
      final file = File(filePath);
      final parent = file.parent;
      if (!await parent.exists()) {
        await parent.create(recursive: true);
      }
      await file.writeAsString(content);
    } catch (_) {}
  }'''
assert old_a in content, "Fix A anchor not found"
content = content.replace(old_a, new_a, 1)

# Fix C: Update _loadNote method
old_c = '''  Future<void> _loadNote() async {
    final repo = ref.read(noteRepositoryProvider);
    final note = await repo.getNote(widget.noteId);
    if (note != null && mounted) {
      setState(() {
        _rawMarkdown = note.rawMarkdown;
        _lastSavedText = note.rawMarkdown;
        _hasUnsavedChanges = false;
        _textController.text = note.rawMarkdown;
      });
      // 加载完成后立即触发一次实体识别
      _triggerEntityRecognition(note.rawMarkdown);
      // 同步大纲数据
      ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, note.rawMarkdown);
      // 加载反向链接
      ref.read(sidebarProvider.notifier).loadBacklinks(widget.noteId);
    }
  }'''
new_c = '''  Future<void> _loadNote() async {
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
    _triggerEntityRecognition(note.rawMarkdown);
    ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, note.rawMarkdown);
    ref.read(sidebarProvider.notifier).loadBacklinks(widget.noteId);
  }'''
assert old_c in content, "Fix C anchor not found"
content = content.replace(old_c, new_c, 1)

# Fix D: Update build method to show error state
old_d = '''    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── 模式切换工具栏 ──
        _buildToolbar(),'''
new_d = '''    if (_noteNotFound) {
      return _buildNoteNotFound();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── 模式切换工具栏 ──
        _buildToolbar(),'''
assert old_d in content, "Fix D anchor not found"
content = content.replace(old_d, new_d, 1)

# Fix E: Add _buildNoteNotFound method after _buildStatusBar
old_e = '''  Widget _buildStatusBar() {
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
}'''
new_e = '''  Widget _buildStatusBar() {
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
}'''
assert old_e in content, "Fix E anchor not found"
content = content.replace(old_e, new_e, 1)

with open(NOTE_PANEL, 'w', encoding='utf-8') as f:
    f.write(content)
print("note_panel.dart: Fix A-E applied successfully")

# Fix F for pane_provider.dart
with open(PANE_PROVIDER, 'r', encoding='utf-8') as f:
    content = f.read()

# Update aiContextProvider
old_f1 = '''final aiContextProvider = Provider<AIContext>((ref) {
  final paneState = ref.watch(paneStackProvider);

  // 聚合可见面板 (非堆叠) 的内容
  // 实际使用时通过 noteRepository 获取各面板的 Markdown 内容
  return AIContext(
    visiblePaneIds: paneState.visiblePaneIds,
    activePaneId: paneState.activeNoteId ?? '',
    stackedPaneIds: paneState.stackedPaneIds,
    // fullPrompt 在 service 层组装，此处只提供结构信息
  );
});'''
new_f1 = '''final aiContextProvider = Provider<AIContext>((ref) {
  final paneState = ref.watch(paneStackProvider);

  return AIContext(
    visiblePaneIds: paneState.visiblePaneIds,
    activePaneId: paneState.activeNoteId,
    stackedPaneIds: paneState.stackedPaneIds,
  );
});'''
assert old_f1 in content, "Fix F1 anchor not found"
content = content.replace(old_f1, new_f1, 1)

# Update AIContext class
old_f2 = '''class AIContext {
  final List<String> visiblePaneIds;
  final String activePaneId;
  final List<String> stackedPaneIds;

  const AIContext({
    required this.visiblePaneIds,
    required this.activePaneId,
    required this.stackedPaneIds,
  });
}'''
new_f2 = '''class AIContext {
  final List<String> visiblePaneIds;
  final String? activePaneId;
  final List<String> stackedPaneIds;

  const AIContext({
    required this.visiblePaneIds,
    this.activePaneId,
    required this.stackedPaneIds,
  });
}'''
assert old_f2 in content, "Fix F2 anchor not found"
content = content.replace(old_f2, new_f2, 1)

with open(PANE_PROVIDER, 'w', encoding='utf-8') as f:
    f.write(content)
print("pane_provider.dart: Fix F applied successfully")

# Fix G for calendar_view.dart
with open(CALENDAR_VIEW, 'r', encoding='utf-8') as f:
    content = f.read()

old_g = '''  void _openNoteForDay(int day) async {
    final date = DateTime(_displayMonth.year, _displayMonth.month, day);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (date.isAfter(today)) return;

    try {
      final service = ref.read(dailyNoteServiceProvider);
      final repo = ref.read(noteRepositoryProvider);
      final (note, _) = await service.getNoteForDate(date);
      final existing = await repo.getNote(note.id);
      if (existing == null) {
        await repo.saveNote(note);
      }
      if (mounted) {
        ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
      }
    } catch (_) {}
  }'''
new_g = '''  void _openNoteForDay(int day) async {
    final date = DateTime(_displayMonth.year, _displayMonth.month, day);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (date.isAfter(today)) return;

    try {
      final service = ref.read(dailyNoteServiceProvider);
      final repo = ref.read(noteRepositoryProvider);
      final (note, isNew) = await service.getNoteForDate(date);
      final existing = await repo.getNote(note.id);
      final wasNew = existing == null;
      if (wasNew) {
        await repo.saveNote(note);
      }
      if (mounted) {
        ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
        if (wasNew) {
          _loadMonthData();
        }
      }
    } catch (_) {}
  }'''
assert old_g in content, "Fix G anchor not found"
content = content.replace(old_g, new_g, 1)

with open(CALENDAR_VIEW, 'w', encoding='utf-8') as f:
    f.write(content)
print("calendar_view.dart: Fix G applied successfully")

print("\nAll fixes applied successfully!")
