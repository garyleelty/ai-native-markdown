/// ══════════════════════════════════════════════════
/// Sidebar Provider — 侧边栏状态管理
/// ══════════════════════════════════════════════════
/// 管理笔记树、全局搜索、标签过滤、大纲等侧边栏功能。
/// ──────────────────────────────────────────────────

library;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/models/note_model.dart';
import '../core/models/backlink_info.dart';
import '../core/services/search_service.dart';
import '../core/services/task_service.dart';
import '../core/services/file_service.dart';
import '../core/services/trash_service.dart';
import '../features/sidebar/models/sidebar_state.dart';
import '../features/editor/services/editor_service.dart';
import '../features/semantic_engine/providers/semantic_search_provider.dart';
import '../features/semantic_engine/providers/model_status_provider.dart';
import 'note_provider.dart';
import 'pane_provider.dart';

/// 侧边栏 Notifier
class SidebarNotifier extends Notifier<SidebarState> {
  @override
  SidebarState build() {
    Future.microtask(() => loadNoteTree());
    return const SidebarState();
  }

  // ── 视图切换 ──

  /// 切换到笔记树视图
  void showNoteTree() {
    state = state.copyWith(currentView: SidebarView.noteTree);
  }

  /// 切换到搜索视图
  void showSearch() {
    state = state.copyWith(currentView: SidebarView.search);
  }

  /// 切换到标签视图
  void showTags() {
    _buildTagCounts();
    state = state.copyWith(currentView: SidebarView.tags);
  }

  /// 切换到最近编辑视图
  void showRecent() {
    _loadRecentNotes();
    state = state.copyWith(currentView: SidebarView.recent);
  }

  /// 切换到日历视图
  void showCalendar() {
    state = state.copyWith(currentView: SidebarView.calendar);
  }

  /// 切换到插件视图
  void showPlugins() {
    state = state.copyWith(currentView: SidebarView.plugins);
  }

  /// 切换到大纲视图，并自动加载当前活动笔记的大纲
  Future<void> showOutline() async {
    final activeNoteId = ref.read(paneStackProvider).activeNoteId;
    if (activeNoteId != null) {
      try {
        final repo = ref.read(noteRepositoryProvider);
        final note = await repo.getNote(activeNoteId);
        if (note != null) {
          final headings = EditorService.extractHeadings(note.rawMarkdown);
          state = state.copyWith(
            currentView: SidebarView.outline,
            outlineHeadings: headings,
            outlineNoteId: activeNoteId,
          );
          return;
        }
      } catch (e) {
        debugPrint('Error loading outline: $e');
      }
    }
    state = state.copyWith(currentView: SidebarView.outline);
  }

  /// 切换到反向链接视图
  void showBacklinks() {
    state = state.copyWith(currentView: SidebarView.backlinks);
  }

  /// 显示任务视图
  Future<void> showTasks() async {
    await loadAllTasks();
  }

  /// 切换到指定视图（通用方法）
  Future<void> switchView(SidebarView view) async {
    if (view == SidebarView.tasks) {
      await showTasks();
    } else if (view == SidebarView.tags) {
      showTags();
    } else if (view == SidebarView.recent) {
      showRecent();
    } else if (view == SidebarView.outline) {
      await showOutline();
    } else {
      state = state.copyWith(currentView: view);
    }
  }

  /// 切换到回收站视图
  void showTrash() {
    state = state.copyWith(currentView: SidebarView.trash);
  }

  /// 加载指定笔记的反向链接
  Future<void> loadBacklinks(String noteId) async {
    state = state.copyWith(
      backlinkTargetId: noteId,
      currentView: SidebarView.backlinks,
    );

    try {
      final repo = ref.read(noteRepositoryProvider);
      final allNotes = await repo.getAllNotes();
      final targetNote = await repo.getNote(noteId);
      if (targetNote == null) return;

      final backlinks = <BacklinkReference>[];
      final unlinkedMentions = <BacklinkReference>[];
      final outgoingLinks = <String>[];

      // 提取当前笔记的前向链接
      final currentLinks = EditorService.extractLinks(targetNote.rawMarkdown);
      for (final link in currentLinks) {
        if (link.isWikiLink) {
          outgoingLinks.add(link.text);
        }
      }

      // 在所有笔记中搜索反向链接和未链接提及
      for (final note in allNotes) {
        if (note.id == noteId) continue;

        // 搜索 [[目标笔记]] 格式的双向链接
        final wikiPattern = RegExp(r'\[\[' + RegExp.escape(targetNote.title) + r'\]\]');
        final wikiMatches = wikiPattern.allMatches(note.rawMarkdown);
        for (final match in wikiMatches) {
          final context = _extractContext(note.rawMarkdown, match.start, match.end);
          backlinks.add(BacklinkReference(
            noteId: note.id,
            noteTitle: note.title,
            type: BacklinkType.linked,
            context: context,
            startOffset: match.start,
            endOffset: match.end,
          ));
        }

        // 搜索未链接提及（文本中出现笔记标题但没有 [[]]）
        // 只在没有双向链接的笔记中搜索
        if (wikiMatches.isEmpty) {
          final titlePattern = RegExp(
            r'(?<!\[)' + RegExp.escape(targetNote.title) + r'(?!\])',
            caseSensitive: false,
          );
          final titleMatches = titlePattern.allMatches(note.rawMarkdown);
          for (final match in titleMatches.take(3)) {
            // 确保不是在代码块或某些特殊上下文中
            final context = _extractContext(note.rawMarkdown, match.start, match.end);
            unlinkedMentions.add(BacklinkReference(
              noteId: note.id,
              noteTitle: note.title,
              type: BacklinkType.unlinked,
              context: context,
              startOffset: match.start,
              endOffset: match.end,
            ));
          }
        }
      }

      // 提取唯一的笔记 ID（用于旧版 API 兼容）
      final backlinkIds = backlinks.map((b) => b.noteId).toSet().toList();

      state = state.copyWith(
        backlinkNoteIds: backlinkIds,
        backlinkAnalysis: BacklinkAnalysis(
          backlinks: backlinks,
          outgoingLinks: outgoingLinks,
          unlinkedMentions: unlinkedMentions,
        ),
      );
    } catch (e) {
      debugPrint('Error loading backlinks: $e');
    }
  }

  /// 提取匹配位置的上下文
  String _extractContext(String text, int start, int end) {
    const contextLen = 60;
    final contextStart = (start - contextLen).clamp(0, text.length);
    final contextEnd = (end + contextLen).clamp(0, text.length);

    var context = text.substring(contextStart, contextEnd);
    // 清理换行
    context = context.replaceAll('\n', ' ').replaceAll(RegExp(r'\s+'), ' ');

    final prefix = contextStart > 0 ? '...' : '';
    final suffix = contextEnd < text.length ? '...' : '';

    return '$prefix$context$suffix';
  }

  // ── 任务管理 ──

  /// 加载所有任务
  Future<void> loadAllTasks() async {
    state = state.copyWith(currentView: SidebarView.tasks);
    try {
      final repo = ref.read(noteRepositoryProvider);
      final allNotes = await repo.getAllNotes();
      final tasks = TaskService.extractAllTasks(allNotes);
      state = state.copyWith(allTasks: tasks);
    } catch (e) {
      debugPrint('Error loading tasks: $e');
    }
  }

  /// 切换任务过滤（仅显示未完成/显示全部）
  void toggleTaskFilter() {
    state = state.copyWith(showOnlyIncomplete: !state.showOnlyIncomplete);
  }

  /// 切换任务完成状态
  Future<void> toggleTask(TaskItem task) async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(task.noteId);
      if (note == null) return;

      final newMarkdown = TaskService.toggleTaskInMarkdown(
        note.rawMarkdown,
        task.startOffset,
      );

      final updatedNote = note.copyWith(
        rawMarkdown: newMarkdown,
        updatedAt: DateTime.now(),
      );
      await repo.saveNote(updatedNote);
      if (FileService.shouldSyncToFile(updatedNote.filePath)) {
        await FileService.syncToFile(updatedNote.filePath, updatedNote.rawMarkdown);
      }

      await loadAllTasks();
    } catch (e) {
      debugPrint('Error toggling task: $e');
      rethrow;
    }
  }

  /// 加载指定笔记的大纲并切换到大纲视图
  void loadOutline(String noteId) {
    state = state.copyWith(
      outlineNoteId: noteId,
      currentView: SidebarView.outline,
    );
  }

  /// 更新大纲数据 (从 Markdown 提取标题)
  void updateOutline(String noteId, String markdown) {
    final headings = EditorService.extractHeadings(markdown);
    state = state.copyWith(
      outlineHeadings: headings,
      outlineNoteId: noteId,
    );
  }

  // ── 侧边栏展开/折叠 ──

  /// 展开侧边栏
  void expand() {
    state = state.copyWith(isExpanded: true);
  }

  /// 折叠侧边栏 (仅保留图标栏)
  void collapse() {
    state = state.copyWith(isExpanded: false);
  }

  /// 切换展开状态
  void toggleExpanded() {
    state = state.copyWith(isExpanded: !state.isExpanded);
  }

  /// 设置侧边栏宽度 (在拖拽调整时调用)
  void setWidth(double width) {
    final clamped = width.clamp(SidebarLayout.minWidth, SidebarLayout.maxWidth);
    state = state.copyWith(width: clamped);
  }

  // ── 搜索 ──

  /// 执行全局搜索
  Future<void> search(String query) async {
    state = state.copyWith(
      searchQuery: query,
      isSearching: true,
      clearSearchMessage: true,
    );

    if (query.trim().isEmpty) {
      state = state.copyWith(
        searchResults: const [],
        isSearching: false,
        clearSearchMessage: true,
      );
      return;
    }

    try {
      final repo = ref.read(noteRepositoryProvider);
      final allNotes = await repo.getAllNotes();
      final response = SearchService.searchNotes(allNotes, query);
      final results = List<SearchResult>.of(response.results);

      // 语义引擎就绪时合并语义搜索结果，去重后按分数排序
      final status = ref.read(modelStatusProvider);
      if (status.status == SemanticEngineStatus.ready &&
          status.currentModelId != null) {
        final hits = await ref.read(semanticSearchProvider(query).future);
        final existingIds = results.map((r) => r.note.id).toSet();
        final byId = {for (final n in allNotes) n.id: n};
        for (final hit in hits) {
          if (existingIds.contains(hit.noteId)) continue;
          final note = byId[hit.noteId];
          if (note == null) continue;
          results.add(SearchResult(
            note: note,
            matches: const [],
            preview: note.rawMarkdown.length > 100
                ? note.rawMarkdown.substring(0, 100)
                : note.rawMarkdown,
            score: hit.score * 100,
          ));
          existingIds.add(hit.noteId);
        }
        results.sort((a, b) => b.score.compareTo(a.score));
      }

      state = state.copyWith(
        searchResults: results,
        isSearching: false,
        searchMessage: response.message,
      );
    } catch (e) {
      debugPrint('Error searching notes: $e');
      state = state.copyWith(
        searchResults: const [],
        isSearching: false,
        clearSearchMessage: true,
      );
    }
  }

  /// 清空搜索
  void clearSearch() {
    state = state.copyWith(
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      clearSearchMessage: true,
    );
  }

  // ── 标签 ──

  /// 选中一个标签进行过滤
  Future<void> selectTag(String tag) async {
    final notes = await _loadNotesWithTag(tag);
    state = state.copyWith(
      selectedTag: tag,
      filteredTagNotes: notes,
    );
  }

  /// 清除标签选择
  void clearTagSelection() {
    state = state.copyWith(
      clearSelectedTag: true,
      filteredTagNotes: const [],
    );
  }

  /// 重命名标签：遍历所有笔记，更新 tags 字段和正文中的 #tag
  Future<void> renameTag(String oldTag, String newTag) async {
    try {
      if (oldTag == newTag || newTag.isEmpty) return;
      final repo = ref.read(noteRepositoryProvider);
      final allNotes = await repo.getAllNotes();
      final oldTagPattern = RegExp('#${RegExp.escape(oldTag)}(?![A-Za-z0-9_])');

      for (final note in allNotes) {
        var changed = false;
        final newTags = note.tags.map((t) {
          if (t == oldTag) {
            changed = true;
            return newTag;
          }
          return t;
        }).toList();
        var newMarkdown = note.rawMarkdown;
        if (oldTagPattern.hasMatch(newMarkdown)) {
          newMarkdown = newMarkdown.replaceAll(oldTagPattern, '#$newTag');
          changed = true;
        }
        if (changed) {
          final updatedNote = note.copyWith(
            rawMarkdown: newMarkdown,
            tags: newTags,
            updatedAt: DateTime.now(),
          );
          await repo.saveNote(updatedNote);
          if (FileService.shouldSyncToFile(updatedNote.filePath)) {
            await FileService.syncToFile(updatedNote.filePath, updatedNote.rawMarkdown);
          }
        }
      }
      await _buildTagCounts();
      if (state.selectedTag == oldTag) {
        await selectTag(newTag);
      }
    } catch (e) {
      debugPrint('Error renaming tag: $e');
      rethrow;
    }
  }

  /// 删除标签：从所有笔记的 tags 字段和正文中移除该标签
  Future<void> deleteTag(String tag) async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final allNotes = await repo.getAllNotes();
      final tagPattern = RegExp('#${RegExp.escape(tag)}(?![A-Za-z0-9_])');

      for (final note in allNotes) {
        var changed = false;
        final newTags = note.tags.where((t) {
          if (t == tag) {
            changed = true;
            return false;
          }
          return true;
        }).toList();
        var newMarkdown = note.rawMarkdown;
        if (tagPattern.hasMatch(newMarkdown)) {
          newMarkdown = newMarkdown.replaceAll(
            RegExp(r'^[ \t]*#' + RegExp.escape(tag) + r'[ \t]*$\n?', multiLine: true),
            '',
          );
          newMarkdown = newMarkdown.replaceAll(tagPattern, '');
          changed = true;
        }
        if (changed) {
          final updatedNote = note.copyWith(
            rawMarkdown: newMarkdown,
            tags: newTags,
            updatedAt: DateTime.now(),
          );
          await repo.saveNote(updatedNote);
          if (FileService.shouldSyncToFile(updatedNote.filePath)) {
            await FileService.syncToFile(updatedNote.filePath, updatedNote.rawMarkdown);
          }
        }
      }
      if (state.selectedTag == tag) {
        clearTagSelection();
      }
      await _buildTagCounts();
    } catch (e) {
      debugPrint('Error deleting tag: $e');
      rethrow;
    }
  }

  /// 加载带有指定标签的笔记
  Future<List<NoteTreeNode>> _loadNotesWithTag(String tag) async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final allNotes = await repo.getAllNotes();
      final result = <NoteTreeNode>[];

      for (final note in allNotes) {
        // 检查笔记的 tags 字段
        if (note.tags.contains(tag)) {
          result.add(NoteTreeNode(
            id: note.id,
            title: note.title,
            path: note.filePath,
            updatedAt: note.updatedAt,
            tags: note.tags,
          ));
          continue;
        }
        // 检查 markdown 内容中的 #标签
        if (note.rawMarkdown.contains('#$tag')) {
          result.add(NoteTreeNode(
            id: note.id,
            title: note.title,
            path: note.filePath,
            updatedAt: note.updatedAt,
            tags: note.tags,
          ));
        }
      }

      // 按更新时间排序
      result.sort((a, b) {
        final aTime = a.updatedAt ?? DateTime(0);
        final bTime = b.updatedAt ?? DateTime(0);
        return bTime.compareTo(aTime);
      });

      return result;
    } catch (_) {
      return const [];
    }
  }

  /// 构建标签统计
  Future<void> _buildTagCounts() async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final notes = await repo.getAllNotes();
      final counts = <String, int>{};

      for (final note in notes) {
        // 从 tags 字段统计
        for (final tag in note.tags) {
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
        // 从 markdown 内容中提取 #标签
        final tagPattern = RegExp(r'#(\w+)');
        final matches = tagPattern.allMatches(note.rawMarkdown);
        for (final match in matches) {
          final tag = match.group(1)!;
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }

      state = state.copyWith(tagCounts: counts);
    } catch (e) {
      debugPrint('Error building tag counts: $e');
    }
  }

  // ── 最近编辑 ──

  /// 加载最近编辑的笔记
  Future<void> _loadRecentNotes() async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final notes = await repo.getAllNotes();
      // notes 已按 updatedAt 降序排列
      final recentIds = notes.take(20).map((n) => n.id).toList();
      state = state.copyWith(recentNoteIds: recentIds);
    } catch (e) {
      debugPrint('Error loading recent notes: $e');
    }
  }

  // ── 笔记树 ──

  /// 从存储加载笔记树
  Future<void> loadNoteTree() async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final notes = await repo.getAllNotes();
      final tree = _buildTree(notes);
      state = state.copyWith(noteTree: tree);
    } catch (e) {
      debugPrint('Error loading note tree: $e');
    }
  }

  /// 从笔记列表构建树结构
  /// 支持文件夹层级
  List<NoteTreeNode> _buildTree(List<NoteModel> notes) {
    final folderMap = <String, List<NoteModel>>{};
    final rootNotes = <NoteModel>[];

    for (final note in notes) {
      if (note.folderPath.isEmpty) {
        rootNotes.add(note);
      } else {
        folderMap.putIfAbsent(note.folderPath, () => []).add(note);
      }
    }

    final nodes = <NoteTreeNode>[];

    // 添加文件夹节点
    final sortedFolders = folderMap.keys.toList()..sort();
    for (final folder in sortedFolders) {
      final folderNotes = folderMap[folder]!;
      final children = folderNotes.map((note) => NoteTreeNode(
        id: note.id,
        title: note.title,
        path: note.filePath,
        updatedAt: note.updatedAt,
        tags: note.tags,
      )).toList();

      nodes.add(NoteTreeNode(
        id: 'folder_$folder',
        title: folder.split('/').last,
        path: folder,
        isFolder: true,
        children: children,
        isExpanded: false,
      ));
    }

    // 添加根目录笔记
    for (final note in rootNotes) {
      nodes.add(NoteTreeNode(
        id: note.id,
        title: note.title,
        path: note.filePath,
        updatedAt: note.updatedAt,
        tags: note.tags,
      ));
    }

    return nodes;
  }

  /// 移动笔记到指定文件夹
  Future<void> moveNoteToFolder(String noteId, String folderPath) async {
    final repo = ref.read(noteRepositoryProvider);
    final note = await repo.getNote(noteId);
    if (note == null) return;

    await repo.saveNote(note.copyWith(
      folderPath: folderPath,
      updatedAt: DateTime.now(),
    ));

    await loadNoteTree();
  }

  /// 展开/折叠树节点
  void toggleTreeNode(String nodeId) {
    final updatedTree = _toggleNode(state.noteTree, nodeId);
    state = state.copyWith(noteTree: updatedTree);
  }

  List<NoteTreeNode> _toggleNode(List<NoteTreeNode> nodes, String nodeId) {
    return nodes.map((node) {
      if (node.id == nodeId) {
        return node.copyWith(isExpanded: !node.isExpanded);
      }
      if (node.children.isNotEmpty) {
        return node.copyWith(
          children: _toggleNode(node.children, nodeId),
        );
      }
      return node;
    }).toList();
  }

  /// 选中一个笔记
  void selectNote(String noteId) {
    state = state.copyWith(selectedNoteId: noteId);
  }

  /// 清除笔记选中
  void clearSelection() {
    state = state.copyWith(clearSelectedNoteId: true);
  }

  /// 删除笔记（移入回收站）
  Future<void> deleteNote(String noteId) async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(noteId);
      if (note != null) {
        await TrashService.moveToTrash(note);
      }
      await repo.deleteNote(noteId);
      ref.read(paneStackProvider.notifier).closePaneByNoteId(noteId);
      await loadNoteTree();
      if (state.selectedNoteId == noteId) {
        clearSelection();
      }
    } catch (e) {
      debugPrint('Error deleting note: $e');
      rethrow;
    }
  }

  /// 重命名笔记
  Future<void> renameNote(String noteId, String newTitle) async {
    try {
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(noteId);
      if (note == null) return;

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

      final updatedNote = note.copyWith(
        title: newTitle,
        rawMarkdown: newMarkdown,
        updatedAt: DateTime.now(),
      );
      await repo.saveNote(updatedNote);
      if (FileService.shouldSyncToFile(updatedNote.filePath)) {
        await FileService.syncToFile(updatedNote.filePath, updatedNote.rawMarkdown);
      }

      await loadNoteTree();
    } catch (e) {
      debugPrint('Error renaming note: $e');
      rethrow;
    }
  }
}

/// 侧边栏 Provider
final sidebarProvider =
    NotifierProvider<SidebarNotifier, SidebarState>(SidebarNotifier.new);
