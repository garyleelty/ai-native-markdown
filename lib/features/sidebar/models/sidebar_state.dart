/// ══════════════════════════════════════════════════
/// SidebarState — 侧边栏状态模型
/// ══════════════════════════════════════════════════
/// 侧边栏包含: 笔记树、全局搜索、标签浏览、大纲、插件面板。
/// ──────────────────────────────────────────────────

library;

import '../../../features/editor/services/editor_service.dart';
import '../../../core/services/search_service.dart';
import '../../../core/services/task_service.dart';
import '../../../core/models/backlink_info.dart';

/// 侧边栏视图模式
enum SidebarView {
  /// 笔记文件树
  noteTree,

  /// 日历视图
  calendar,

  /// 全局搜索
  search,

  /// 标签浏览
  tags,

  /// 最近编辑
  recent,

  /// 插件面板
  plugins,

  /// 大纲/目录视图
  outline,

  /// 反向链接
  backlinks,

  /// 任务视图
  tasks,

  /// 回收站
  trash,
}

/// 侧边栏布局常量
class SidebarLayout {
  SidebarLayout._();
  static const double activityBarWidth = 48.0;
  static const double minWidth = 200.0;
  static const double maxWidth = 500.0;
  static const double defaultWidth = 270.0;
  static const double resizerWidth = 8.0;
}

/// 笔记树节点
class NoteTreeNode {
  /// 笔记 ID
  final String id;

  /// 显示标题
  final String title;

  /// 文件路径
  final String path;

  /// 是否为文件夹
  final bool isFolder;

  /// 子节点 (文件夹展开时)
  final List<NoteTreeNode> children;

  /// 是否已展开
  final bool isExpanded;

  /// 最后修改时间
  final DateTime? updatedAt;

  /// 标签列表
  final List<String> tags;

  const NoteTreeNode({
    required this.id,
    required this.title,
    this.path = '',
    this.isFolder = false,
    this.children = const [],
    this.isExpanded = false,
    this.updatedAt,
    this.tags = const [],
  });

  NoteTreeNode copyWith({
    String? title,
    List<NoteTreeNode>? children,
    bool? isExpanded,
  }) {
    return NoteTreeNode(
      id: id,
      title: title ?? this.title,
      path: path,
      isFolder: isFolder,
      children: children ?? this.children,
      isExpanded: isExpanded ?? this.isExpanded,
      updatedAt: updatedAt,
      tags: tags,
    );
  }
}

/// 侧边栏不可变状态
class SidebarState {
  /// 当前视图模式
  final SidebarView currentView;

  /// 侧边栏是否展开 (false = 仅显示图标侧栏)
  final bool isExpanded;

  /// 侧边栏宽度
  final double width;

  /// 笔记树数据
  final List<NoteTreeNode> noteTree;

  /// 搜索关键字
  final String searchQuery;

  /// 搜索结果笔记 ID 列表
  final List<SearchResult> searchResults;

  /// 是否正在搜索
  final bool isSearching;

  /// 搜索提示/警告信息（如正则降级提示）
  final String? searchMessage;

  /// 所有标签及其笔记计数
  final Map<String, int> tagCounts;

  /// 当前选中的标签
  final String? selectedTag;

  /// 选中标签下的笔记列表
  final List<NoteTreeNode> filteredTagNotes;

  /// 最近编辑的笔记列表
  final List<String> recentNoteIds;

  /// 当前选中的笔记 ID
  final String? selectedNoteId;

  /// 当前活跃笔记的大纲 (标题列表)
  final List<HeadingInfo> outlineHeadings;

  /// 大纲对应的笔记 ID
  final String? outlineNoteId;

  /// 反向链接笔记 ID 列表
  final List<String> backlinkNoteIds;

  /// 详细反向链接分析
  final BacklinkAnalysis backlinkAnalysis;

  /// 反向链接对应的笔记 ID
  final String? backlinkTargetId;

  /// 所有任务列表
  final List<TaskItem> allTasks;

  /// 是否只显示未完成任务
  final bool showOnlyIncomplete;

  const SidebarState({
    this.currentView = SidebarView.noteTree,
    this.isExpanded = true,
    this.width = SidebarLayout.defaultWidth,
    this.noteTree = const [],
    this.searchQuery = '',
    this.searchResults = const [],
    this.isSearching = false,
    this.searchMessage,
    this.tagCounts = const {},
    this.selectedTag,
    this.filteredTagNotes = const [],
    this.recentNoteIds = const [],
    this.selectedNoteId,
    this.outlineHeadings = const [],
    this.outlineNoteId,
    this.backlinkNoteIds = const [],
    this.backlinkAnalysis = const BacklinkAnalysis(),
    this.backlinkTargetId,
    this.allTasks = const [],
    this.showOnlyIncomplete = true,
  });

  SidebarState copyWith({
    SidebarView? currentView,
    bool? isExpanded,
    double? width,
    List<NoteTreeNode>? noteTree,
    String? searchQuery,
    List<SearchResult>? searchResults,
    bool? isSearching,
    String? searchMessage,
    bool clearSearchMessage = false,
    Map<String, int>? tagCounts,
    String? selectedTag,
    bool clearSelectedTag = false,
    List<NoteTreeNode>? filteredTagNotes,
    List<String>? recentNoteIds,
    String? selectedNoteId,
    bool clearSelectedNoteId = false,
    List<HeadingInfo>? outlineHeadings,
    String? outlineNoteId,
    bool clearOutlineNoteId = false,
    List<String>? backlinkNoteIds,
    BacklinkAnalysis? backlinkAnalysis,
    String? backlinkTargetId,
    bool clearBacklinkTargetId = false,
    List<TaskItem>? allTasks,
    bool? showOnlyIncomplete,
  }) {
    return SidebarState(
      currentView: currentView ?? this.currentView,
      isExpanded: isExpanded ?? this.isExpanded,
      width: width ?? this.width,
      noteTree: noteTree ?? this.noteTree,
      searchQuery: searchQuery ?? this.searchQuery,
      searchResults: searchResults ?? this.searchResults,
      isSearching: isSearching ?? this.isSearching,
      searchMessage: clearSearchMessage
          ? null
          : (searchMessage ?? this.searchMessage),
      tagCounts: tagCounts ?? this.tagCounts,
      selectedTag: clearSelectedTag
          ? null
          : (selectedTag ?? this.selectedTag),
      filteredTagNotes: filteredTagNotes ?? this.filteredTagNotes,
      recentNoteIds: recentNoteIds ?? this.recentNoteIds,
      selectedNoteId: clearSelectedNoteId
          ? null
          : (selectedNoteId ?? this.selectedNoteId),
      outlineHeadings: outlineHeadings ?? this.outlineHeadings,
      outlineNoteId: clearOutlineNoteId
          ? null
          : (outlineNoteId ?? this.outlineNoteId),
      backlinkNoteIds: backlinkNoteIds ?? this.backlinkNoteIds,
      backlinkAnalysis: backlinkAnalysis ?? this.backlinkAnalysis,
      backlinkTargetId: clearBacklinkTargetId
          ? null
          : (backlinkTargetId ?? this.backlinkTargetId),
      allTasks: allTasks ?? this.allTasks,
      showOnlyIncomplete: showOnlyIncomplete ?? this.showOnlyIncomplete,
    );
  }
}
