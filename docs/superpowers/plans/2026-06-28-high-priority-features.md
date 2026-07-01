# 高优先级功能实现计划

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 Obsidian 对标的核心高优先级功能，提升 AeroMind 的知识管理能力。

**Architecture:** 基于现有 Riverpod + Hive 架构，扩展 SidebarState/Provider、NoteProvider、NotePanel 等模块。每个功能独立可测试。

**Tech Stack:** Flutter, Riverpod, Hive, flutter_markdown

---

## 文件结构

### 新建文件
- `lib/features/backlinks/widgets/backlinks_panel.dart` — 反向链接面板组件
- `lib/features/outline/widgets/outline_panel.dart` — 大纲目录面板组件
- `lib/features/editor/services/link_updater_service.dart` — 链接更新服务

### 修改文件
- `lib/features/sidebar/models/sidebar_state.dart` — 添加 SidebarView.backlinks/outline
- `lib/features/sidebar/widgets/sidebar_container.dart` — 添加反向链接/大纲视图
- `lib/providers/sidebar_provider.dart` — 添加反向链接/大纲数据加载
- `lib/providers/note_provider.dart` — 添加 renameNote 方法
- `lib/providers/pane_provider.dart` — 添加导航历史、renamePane
- `lib/features/editor/widgets/note_panel.dart` — 添加大纲/反向链接入口、搜索高亮
- `lib/features/sidebar/widgets/sidebar_container.dart` — 文件夹管理、标签跳转
- `lib/app.dart` — 注册新命令

---

## Task 1: 大纲/目录视图

**Files:**
- Create: `lib/features/outline/widgets/outline_panel.dart`
- Modify: `lib/features/sidebar/models/sidebar_state.dart`
- Modify: `lib/features/sidebar/widgets/sidebar_container.dart`
- Modify: `lib/providers/sidebar_provider.dart`

### Step 1: 扩展 SidebarState 添加 outline 视图

在 `sidebar_state.dart` 的 `SidebarView` 枚举中添加 `outline`：

```dart
enum SidebarView {
  noteTree,
  calendar,
  search,
  tags,
  recent,
  plugins,
  outline,   // 新增
  backlinks, // 新增
}
```

在 `SidebarState` 中添加大纲数据字段：

```dart
class SidebarState {
  // ... 现有字段 ...

  /// 当前活跃笔记的大纲 (标题列表)
  final List<HeadingInfo> outlineHeadings;

  /// 大纲对应的笔记 ID
  final String? outlineNoteId;

  const SidebarState({
    // ... 现有参数 ...
    this.outlineHeadings = const [],
    this.outlineNoteId,
  });
```

添加 copyWith 参数：

```dart
SidebarState copyWith({
  // ... 现有参数 ...
  List<HeadingInfo>? outlineHeadings,
  String? outlineNoteId,
  bool clearOutlineNoteId = false,
}) {
  return SidebarState(
    // ... 现有赋值 ...
    outlineHeadings: outlineHeadings ?? this.outlineHeadings,
    outlineNoteId: clearOutlineNoteId ? null : (outlineNoteId ?? this.outlineNoteId),
  );
}
```

需要在文件顶部添加 import：

```dart
import '../../../features/editor/services/editor_service.dart';
```

### Step 2: 添加大纲数据加载到 SidebarNotifier

在 `sidebar_provider.dart` 中添加：

```dart
/// 切换到大纲视图
void showOutline() {
  state = state.copyWith(currentView: SidebarView.outline);
}

/// 加载指定笔记的大纲
void loadOutline(String noteId) {
  // 需要同步获取笔记内容，这里先存 noteId，实际通过 provider 获取
  state = state.copyWith(
    outlineNoteId: noteId,
    currentView: SidebarView.outline,
  );
}

/// 从 Markdown 内容更新大纲
void updateOutline(String noteId, String markdown) {
  final headings = EditorService.extractHeadings(markdown);
  state = state.copyWith(
    outlineHeadings: headings,
    outlineNoteId: noteId,
  );
}
```

### Step 3: 创建大纲面板组件

创建 `lib/features/outline/widgets/outline_panel.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/sidebar_provider.dart';
import '../../editor/services/editor_service.dart';

class OutlinePanel extends ConsumerWidget {
  final void Function(int offset)? onHeadingTap;

  const OutlinePanel({super.key, this.onHeadingTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sidebarProvider);

    if (state.outlineHeadings.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.list_alt, size: 32, color: AeroColors.textMuted),
            SizedBox(height: 8),
            Text(
              '暂无大纲',
              style: TextStyle(color: AeroColors.textMuted, fontSize: 12),
            ),
            SizedBox(height: 4),
            Text(
              '打开一篇包含标题的笔记',
              style: TextStyle(color: AeroColors.textMuted, fontSize: 10),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: state.outlineHeadings.length,
      itemBuilder: (context, index) {
        final heading = state.outlineHeadings[index];
        return _OutlineTile(
          heading: heading,
          onTap: () => onHeadingTap?.call(heading.offset),
        );
      },
    );
  }
}

class _OutlineTile extends StatelessWidget {
  final HeadingInfo heading;
  final VoidCallback onTap;

  const _OutlineTile({required this.heading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final indent = (heading.level - 1) * 16.0;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.only(left: 12 + indent, right: 12, top: 4, bottom: 4),
        child: Row(
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: _levelColor(heading.level),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                heading.title,
                style: TextStyle(
                  fontSize: 12,
                  color: AeroColors.textPrimary,
                  fontWeight: heading.level <= 2 ? FontWeight.w600 : FontWeight.normal,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              'H${heading.level}',
              style: TextStyle(
                fontSize: 9,
                color: AeroColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _levelColor(int level) {
    switch (level) {
      case 1: return AeroColors.accentBlue;
      case 2: return AeroColors.accentPurple;
      case 3: return AeroColors.accentCyan;
      case 4: return AeroColors.accentOrange;
      default: return AeroColors.textMuted;
    }
  }
}
```

### Step 4: 在侧边栏容器中集成大纲视图

在 `sidebar_container.dart` 的 `_SidebarContent` build 方法中添加 outline case：

```dart
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
        // 跳转到编辑器中的对应位置
      },
    ),
    SidebarView.backlinks => const SizedBox.shrink(), // 后续实现
  },
),
```

在 `_ViewTabBar` 中添加大纲图标：

```dart
_TabIcon(
  icon: Icons.list_alt,
  isActive: currentView == SidebarView.outline,
  tooltip: '大纲',
  onTap: notifier.showOutline,
),
```

添加 import：

```dart
import '../../outline/widgets/outline_panel.dart';
```

### Step 5: 在 NotePanel 中同步大纲数据

在 `note_panel.dart` 的 `_loadNote` 方法中，加载完成后更新大纲：

```dart
Future<void> _loadNote() async {
  final repo = ref.read(noteRepositoryProvider);
  final note = await repo.getNote(widget.noteId);
  if (note != null && mounted) {
    setState(() {
      _rawMarkdown = note.rawMarkdown;
      _textController.text = note.rawMarkdown;
    });
    _triggerEntityRecognition(note.rawMarkdown);
    // 同步大纲
    ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, note.rawMarkdown);
  }
}
```

在 `_onTextChanged` 中也同步：

```dart
void _onTextChanged(String text) {
  _rawMarkdown = text;
  _triggerEntityRecognition(text);
  _autoSave(text);
  // 实时更新大纲
  ref.read(sidebarProvider.notifier).updateOutline(widget.noteId, text);
}
```

### Step 6: 运行测试验证

```bash
dart analyze lib/features/outline/ lib/features/sidebar/ lib/providers/sidebar_provider.dart
```

---

## Task 2: 反向链接面板

**Files:**
- Create: `lib/features/backlinks/widgets/backlinks_panel.dart`
- Modify: `lib/features/sidebar/models/sidebar_state.dart` (已在 Task 1 添加)
- Modify: `lib/features/sidebar/widgets/sidebar_container.dart`
- Modify: `lib/providers/sidebar_provider.dart`
- Modify: `lib/providers/note_provider.dart`

### Step 1: 在 NoteProvider 中添加反向链接查询方法

在 `note_provider.dart` 中添加：

```dart
/// 查询引用了指定笔记的所有笔记
Future<List<NoteModel>> getBacklinks(String noteId) async {
  final repo = ref.read(noteRepositoryProvider);
  final allNotes = await repo.getAllNotes();
  final targetNote = await repo.getNote(noteId);
  if (targetNote == null) return [];

  final backlinks = <NoteModel>[];
  for (final note in allNotes) {
    if (note.id == noteId) continue;
    // 检查是否包含指向目标笔记的 wiki 链接
    final links = EditorService.extractLinks(note.rawMarkdown);
    for (final link in links) {
      if (link.isWikiLink && link.text == targetNote.title) {
        backlinks.add(note);
        break;
      }
    }
  }
  return backlinks;
}
```

需要在文件顶部添加 import：

```dart
import '../features/editor/services/editor_service.dart';
```

### Step 2: 添加反向链接状态到 SidebarState

在 `SidebarState` 中添加字段（如果 Task 1 已执行，outline 字段已添加）：

```dart
/// 反向链接笔记 ID 列表
final List<String> backlinkNoteIds;

/// 反向链接对应的笔记 ID
final String? backlinkTargetId;

const SidebarState({
  // ... 现有参数 ...
  this.backlinkNoteIds = const [],
  this.backlinkTargetId,
});
```

copyWith 中添加：

```dart
List<String>? backlinkNoteIds,
String? backlinkTargetId,
bool clearBacklinkTargetId = false,
```

### Step 3: 添加反向链接加载到 SidebarNotifier

在 `sidebar_provider.dart` 中添加：

```dart
/// 切换到反向链接视图
void showBacklinks() {
  state = state.copyWith(currentView: SidebarView.backlinks);
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

    final backlinkIds = <String>[];
    for (final note in allNotes) {
      if (note.id == noteId) continue;
      final links = EditorService.extractLinks(note.rawMarkdown);
      for (final link in links) {
        if (link.isWikiLink && link.text == targetNote.title) {
          backlinkIds.add(note.id);
          break;
        }
      }
    }

    state = state.copyWith(backlinkNoteIds: backlinkIds);
  } catch (_) {}
}
```

### Step 4: 创建反向链接面板组件

创建 `lib/features/backlinks/widgets/backlinks_panel.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/sidebar_provider.dart';
import '../../../providers/note_provider.dart';

class BacklinksPanel extends ConsumerWidget {
  final void Function(String noteId, String title)? onNoteTap;

  const BacklinksPanel({super.key, this.onNoteTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sidebarProvider);

    if (state.backlinkTargetId == null) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.link, size: 32, color: AeroColors.textMuted),
            SizedBox(height: 8),
            Text(
              '暂无反向链接',
              style: TextStyle(color: AeroColors.textMuted, fontSize: 12),
            ),
            SizedBox(height: 4),
            Text(
              '打开一篇笔记查看引用',
              style: TextStyle(color: AeroColors.textMuted, fontSize: 10),
            ),
          ],
        ),
      );
    }

    if (state.backlinkNoteIds.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.link_off, size: 32, color: AeroColors.textMuted),
            const SizedBox(height: 8),
            const Text(
              '没有笔记引用当前笔记',
              style: TextStyle(color: AeroColors.textMuted, fontSize: 12),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Text(
            '${state.backlinkNoteIds.length} 篇笔记引用',
            style: TextStyle(
              color: AeroColors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 4),
            itemCount: state.backlinkNoteIds.length,
            itemBuilder: (context, index) {
              final noteId = state.backlinkNoteIds[index];
              return _BacklinkTile(
                noteId: noteId,
                onTap: (id, title) => onNoteTap?.call(id, title),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _BacklinkTile extends ConsumerWidget {
  final String noteId;
  final void Function(String noteId, String title)? onTap;

  const _BacklinkTile({required this.noteId, this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final noteAsync = ref.watch(noteByIdProvider(noteId));

    return noteAsync.when(
      loading: () => const SizedBox(height: 28),
      error: (_, __) => const SizedBox.shrink(),
      data: (note) {
        if (note == null) return const SizedBox.shrink();
        return InkWell(
          onTap: () => onTap?.call(note.id, note.title),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.description_outlined,
                        size: 12, color: AeroColors.accentGreen),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        note.title,
                        style: const TextStyle(
                          color: AeroColors.textPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  note.rawMarkdown.length > 80
                      ? '${note.rawMarkdown.substring(0, 80)}...'
                      : note.rawMarkdown,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AeroColors.textMuted,
                    fontSize: 10,
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
```

### Step 5: 在侧边栏容器中集成反向链接视图

更新 `sidebar_container.dart` 的 switch：

```dart
SidebarView.backlinks => BacklinksPanel(
  onNoteTap: (noteId, title) {
    onNoteSelected?.call(noteId, title);
  },
),
```

在 `_ViewTabBar` 中添加反向链接图标：

```dart
_TabIcon(
  icon: Icons.link,
  isActive: currentView == SidebarView.backlinks,
  tooltip: '反向链接',
  onTap: notifier.showBacklinks,
),
```

添加 import：

```dart
import '../../backlinks/widgets/backlinks_panel.dart';
```

### Step 6: 在 NotePanel 中自动加载反向链接

在 `note_panel.dart` 的 `_loadNote` 中添加：

```dart
// 加载反向链接
ref.read(sidebarProvider.notifier).loadBacklinks(widget.noteId);
```

### Step 7: 运行测试验证

```bash
dart analyze lib/features/backlinks/ lib/features/sidebar/ lib/providers/
```

---

## Task 3: 文件夹管理

**Files:**
- Modify: `lib/features/sidebar/models/sidebar_state.dart`
- Modify: `lib/providers/sidebar_provider.dart`
- Modify: `lib/features/sidebar/widgets/sidebar_container.dart`
- Modify: `lib/core/models/note_model.dart` (添加 folderPath 字段)

### Step 1: 添加 folderPath 到 NoteModel

在 `note_model.dart` 中添加文件夹路径字段：

```dart
class NoteModel {
  // ... 现有字段 ...
  final String folderPath; // 所属文件夹路径，如 'diary', 'projects/flutter'

  const NoteModel({
    // ... 现有参数 ...
    this.folderPath = '',
  });

  NoteModel copyWith({
    // ... 现有参数 ...
    String? folderPath,
  }) {
    return NoteModel(
      // ... 现有赋值 ...
      folderPath: folderPath ?? this.folderPath,
    );
  }
}
```

### Step 2: 修改 _buildTree 构建层级文件夹结构

在 `sidebar_provider.dart` 的 `_buildTree` 方法中实现文件夹分组：

```dart
/// 从笔记列表构建树结构 (支持文件夹层级)
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
```

### Step 3: 添加文件夹操作到 SidebarNotifier

```dart
/// 创建文件夹 (实际上是给笔记设置 folderPath)
Future<void> createFolder(String folderName) async {
  // 文件夹通过笔记的 folderPath 隐式创建
  // 这里只需要刷新树
  await loadNoteTree();
}

/// 移动笔记到文件夹
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

/// 重命名笔记
Future<void> renameNote(String noteId, String newTitle) async {
  final repo = ref.read(noteRepositoryProvider);
  final note = await repo.getNote(noteId);
  if (note == null) return;

  await repo.saveNote(note.copyWith(
    title: newTitle,
    updatedAt: DateTime.now(),
  ));

  await loadNoteTree();
}
```

### Step 4: 在侧边栏添加文件夹右键菜单

在 `_NoteTreeTile` 中添加长按菜单（创建文件夹、移动笔记）：

```dart
class _NoteTreeTile extends StatelessWidget {
  // ... 现有代码 ...

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      onLongPress: () => _showContextMenu(context),
      // ... 现有 build ...
    );
  }

  void _showContextMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AeroColors.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      builder: (_) => _NodeContextMenu(node: node),
    );
  }
}

class _NodeContextMenu extends StatelessWidget {
  final NoteTreeNode node;

  const _NodeContextMenu({required this.node});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.edit, size: 20),
            title: const Text('重命名'),
            onTap: () {
              Navigator.pop(context);
              _showRenameDialog(context);
            },
          ),
          if (!node.isFolder)
            ListTile(
              leading: const Icon(Icons.drive_file_move, size: 20),
              title: const Text('移动到文件夹'),
              onTap: () {
                Navigator.pop(context);
                _showMoveDialog(context);
              },
            ),
          ListTile(
            leading: const Icon(Icons.delete_outline, size: 20, color: Colors.red),
            title: const Text('删除', style: TextStyle(color: Colors.red)),
            onTap: () {
              Navigator.pop(context);
              _confirmDelete(context);
            },
          ),
        ],
      ),
    );
  }

  void _showRenameDialog(BuildContext context) {
    // 实现重命名对话框
  }

  void _showMoveDialog(BuildContext context) {
    // 实现移动对话框
  }

  void _confirmDelete(BuildContext context) {
    // 实现删除确认
  }
}
```

### Step 5: 运行测试验证

```bash
dart analyze lib/features/sidebar/ lib/providers/ lib/core/models/
```

---

## Task 4: 笔记重命名 + 链接更新

**Files:**
- Create: `lib/features/editor/services/link_updater_service.dart`
- Modify: `lib/providers/note_provider.dart`
- Modify: `lib/providers/sidebar_provider.dart`

### Step 1: 创建链接更新服务

创建 `lib/features/editor/services/link_updater_service.dart`：

```dart
/// 链接更新服务 — 重命名笔记时自动更新所有引用
class LinkUpdaterService {
  /// 重命名笔记并更新所有相关链接
  ///
  /// 返回受影响的笔记数量
  static Future<int> renameNoteAndUpdateLinks({
    required NoteRepository repo,
    required String noteId,
    required String newTitle,
  }) async {
    final note = await repo.getNote(noteId);
    if (note == null) return 0;

    final oldTitle = note.title;

    // 1. 更新笔记标题
    await repo.saveNote(note.copyWith(
      title: newTitle,
      updatedAt: DateTime.now(),
    ));

    // 2. 查找所有引用旧标题的笔记
    final allNotes = await repo.getAllNotes();
    int updatedCount = 0;

    for (final otherNote in allNotes) {
      if (otherNote.id == noteId) continue;

      if (otherNote.rawMarkdown.contains('[[$oldTitle]]')) {
        final updatedMarkdown = otherNote.rawMarkdown.replaceAll(
          '[[$oldTitle]]',
          '[[$newTitle]]',
        );
        await repo.saveNote(otherNote.copyWith(
          rawMarkdown: updatedMarkdown,
          updatedAt: DateTime.now(),
        ));
        updatedCount++;
      }
    }

    return updatedCount;
  }
}
```

需要在文件顶部添加：

```dart
import '../../../core/models/note_model.dart';
import '../../../providers/note_provider.dart';
```

### Step 2: 在 SidebarNotifier 中集成链接更新

修改 `renameNote` 方法：

```dart
/// 重笔记并更新所有链接
Future<int> renameNoteWithLinkUpdate(String noteId, String newTitle) async {
  final updatedCount = await LinkUpdaterService.renameNoteAndUpdateLinks(
    repo: ref.read(noteRepositoryProvider),
    noteId: noteId,
    newTitle: newTitle,
  );

  await loadNoteTree();
  return updatedCount;
}
```

### Step 3: 运行测试验证

```bash
dart analyze lib/features/editor/services/link_updater_service.dart
```

---

## Task 5: 导航历史 (前进/后退)

**Files:**
- Modify: `lib/providers/pane_provider.dart`
- Modify: `lib/app.dart`

### Step 1: 添加导航历史到 PaneStackState

在 `pane_provider.dart` 中：

```dart
class PaneStackState {
  // ... 现有字段 ...

  /// 导航历史 (noteId 列表)
  final List<String> navigationHistory;

  /// 当前历史位置索引
  final int historyIndex;

  const PaneStackState({
    // ... 现有参数 ...
    this.navigationHistory = const [],
    this.historyIndex = -1,
  });

  /// 是否可以后退
  bool get canGoBack => historyIndex > 0;

  /// 是否可以前进
  bool get canGoForward => historyIndex < navigationHistory.length - 1;

  PaneStackState copyWith({
    // ... 现有参数 ...
    List<String>? navigationHistory,
    int? historyIndex,
  }) {
    return PaneStackState(
      // ... 现有赋值 ...
      navigationHistory: navigationHistory ?? this.navigationHistory,
      historyIndex: historyIndex ?? this.historyIndex,
    );
  }
}
```

### Step 2: 添加导航方法到 PaneStackNotifier

```dart
/// 记录导航历史
void _recordNavigation(String noteId) {
  final history = [...state.navigationHistory];
  final currentIndex = state.historyIndex;

  // 如果在历史中间位置，截断后续记录
  if (currentIndex >= 0 && currentIndex < history.length - 1) {
    history.removeRange(currentIndex + 1, history.length);
  }

  // 避免连续重复
  if (history.isEmpty || history.last != noteId) {
    history.add(noteId);
  }

  state = state.copyWith(
    navigationHistory: history,
    historyIndex: history.length - 1,
  );
}

/// 后退
void goBack() {
  if (!state.canGoBack) return;
  final newIndex = state.historyIndex - 1;
  final noteId = state.navigationHistory[newIndex];
  state = state.copyWith(historyIndex: newIndex);
  _activateNoteById(noteId);
}

/// 前进
void goForward() {
  if (!state.canGoForward) return;
  final newIndex = state.historyIndex + 1;
  final noteId = state.navigationHistory[newIndex];
  state = state.copyWith(historyIndex: newIndex);
  _activateNoteById(noteId);
}

void _activateNoteById(String noteId) {
  final index = state.panes.indexWhere((p) => p.noteId == noteId);
  if (index >= 0) {
    activatePane(index);
  }
}
```

在 `openPane` 方法开头添加导航记录：

```dart
void openPane(String noteId, String title) {
  _recordNavigation(noteId);
  // ... 现有代码 ...
}
```

### Step 3: 注册导航命令

在 `app.dart` 的 `_initCommandActions` 中添加：

```dart
// 后退
'nav.back': () {
  ref.read(paneStackProvider.notifier).goBack();
},

// 前进
'nav.forward': () {
  ref.read(paneStackProvider.notifier).goForward();
},
```

在 `command_registry.dart` 中注册命令：

```dart
CommandDef(
  id: 'nav.back',
  name: '后退',
  icon: Icons.arrow_back,
  shortcut: 'Ctrl+[',
  category: CommandCategory.nav,
  description: '返回上一个笔记',
),
CommandDef(
  id: 'nav.forward',
  name: '前进',
  icon: Icons.arrow_forward,
  shortcut: 'Ctrl+]',
  category: CommandCategory.nav,
  description: '前进到下一个笔记',
),
```

### Step 4: 运行测试验证

```bash
dart analyze lib/providers/pane_provider.dart lib/app.dart
```

---

## Task 6: 搜索结果高亮

**Files:**
- Modify: `lib/features/sidebar/widgets/sidebar_container.dart`

### Step 1: 修改 _SearchResultTile 添加高亮

在 `sidebar_container.dart` 中修改 `_SearchResultTile`：

```dart
class _SearchResultTile extends ConsumerWidget {
  final String noteId;
  final String searchQuery; // 新增
  final VoidCallback onTap;

  const _SearchResultTile({
    required this.noteId,
    this.searchQuery = '', // 新增
    required this.onTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final noteAsync = ref.watch(noteByIdProvider(noteId));

    return noteAsync.when(
      loading: () => const SizedBox(height: 28),
      error: (_, __) => const SizedBox.shrink(),
      data: (note) {
        if (note == null) return const SizedBox.shrink();

        // 找到匹配的片段
        final snippet = _extractSnippet(note.rawMarkdown, searchQuery);

        return InkWell(
          onTap: onTap,
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  note.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AeroColors.textPrimary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                if (snippet.isNotEmpty)
                  _HighlightedText(
                    text: snippet,
                    query: searchQuery,
                    style: const TextStyle(
                      color: AeroColors.textMuted,
                      fontSize: 10,
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// 提取包含搜索关键词的片段
  String _extractSnippet(String markdown, String query) {
    if (query.isEmpty) {
      return markdown.length > 80
          ? '${markdown.substring(0, 80)}...'
          : markdown;
    }

    final lowerMarkdown = markdown.toLowerCase();
    final lowerQuery = query.toLowerCase();
    final index = lowerMarkdown.indexOf(lowerQuery);

    if (index < 0) {
      return markdown.length > 80
          ? '${markdown.substring(0, 80)}...'
          : markdown;
    }

    final start = (index - 20).clamp(0, markdown.length);
    final end = (index + query.length + 40).clamp(0, markdown.length);
    final snippet = markdown.substring(start, end);

    return '${start > 0 ? '...' : ''}$snippet${end < markdown.length ? '...' : ''}';
  }
}

/// 高亮文本组件
class _HighlightedText extends StatelessWidget {
  final String text;
  final String query;
  final TextStyle? style;

  const _HighlightedText({
    required this.text,
    required this.query,
    this.style,
  });

  @override
  Widget build(BuildContext context) {
    if (query.isEmpty) {
      return Text(text, maxLines: 2, overflow: TextOverflow.ellipsis, style: style);
    }

    final spans = <TextSpan>[];
    final lowerText = text.toLowerCase();
    final lowerQuery = query.toLowerCase();
    int lastEnd = 0;

    while (true) {
      final index = lowerText.indexOf(lowerQuery, lastEnd);
      if (index < 0) break;

      if (index > lastEnd) {
        spans.add(TextSpan(text: text.substring(lastEnd, index)));
      }

      spans.add(TextSpan(
        text: text.substring(index, index + query.length),
        style: const TextStyle(
          backgroundColor: AeroColors.accentCyan,
          color: AeroColors.bgDeep,
          fontWeight: FontWeight.w600,
        ),
      ));

      lastEnd = index + query.length;
    }

    if (lastEnd < text.length) {
      spans.add(TextSpan(text: text.substring(lastEnd)));
    }

    return RichText(
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: style,
        children: spans,
      ),
    );
  }
}
```

### Step 2: 传递 searchQuery 到结果组件

在 `_SearchView` 的 ListView.builder 中传递查询：

```dart
_SearchResultTile(
  noteId: noteId,
  searchQuery: state.searchQuery, // 新增
  onTap: () {
    widget.onNoteSelected?.call(noteId, noteId);
  },
),
```

### Step 3: 运行测试验证

```bash
dart analyze lib/features/sidebar/widgets/sidebar_container.dart
```

---

## Task 7: 注册所有新命令并绑定

**Files:**
- Modify: `lib/features/command_palette/services/command_registry.dart`
- Modify: `lib/app.dart`

### Step 1: 在 command_registry.dart 中注册新命令

```dart
CommandDef(
  id: 'view.outline',
  name: '打开大纲',
  icon: Icons.list_alt,
  category: CommandCategory.view,
  description: '显示当前笔记的大纲目录',
),
CommandDef(
  id: 'view.backlinks',
  name: '查看反向链接',
  icon: Icons.link,
  category: CommandCategory.view,
  description: '查看引用当前笔记的其他笔记',
),
CommandDef(
  id: 'note.rename',
  name: '重命名笔记',
  icon: Icons.edit,
  category: CommandCategory.note,
  description: '重命名当前笔记并更新所有链接',
),
CommandDef(
  id: 'nav.back',
  name: '后退',
  icon: Icons.arrow_back,
  shortcut: 'Ctrl+[',
  category: CommandCategory.nav,
  description: '返回上一个笔记',
),
CommandDef(
  id: 'nav.forward',
  name: '前进',
  icon: Icons.arrow_forward,
  shortcut: 'Ctrl+]',
  category: CommandCategory.nav,
  description: '前进到下一个笔记',
),
```

### Step 2: 在 app.dart 中绑定新命令 action

```dart
// 打开大纲
'view.outline': () {
  final paneState = ref.read(paneStackProvider);
  if (paneState.activeNoteId != null) {
    ref.read(sidebarProvider.notifier).loadOutline(paneState.activeNoteId!);
  }
},

// 查看反向链接
'view.backlinks': () {
  final paneState = ref.read(paneStackProvider);
  if (paneState.activeNoteId != null) {
    ref.read(sidebarProvider.notifier).loadBacklinks(paneState.activeNoteId!);
  }
},

// 重命名笔记
'note.rename': () {
  // 显示重命名对话框 (需要在 UI 层处理)
},

// 后退
'nav.back': () {
  ref.read(paneStackProvider.notifier).goBack();
},

// 前进
'nav.forward': () {
  ref.read(paneStackProvider.notifier).goForward();
},
```

### Step 3: 运行全部分析

```bash
dart analyze
```

---

## 验证清单

- [ ] 大纲视图: 打开含标题的笔记 → 侧边栏切换到大纲 → 显示标题列表 → 点击跳转
- [ ] 反向链接: 创建两个笔记 A 和 B，B 中写 `[[A]]` → 打开 A → 反向链接面板显示 B
- [ ] 文件夹管理: 侧边栏显示文件夹层级 → 长按笔记可移动/重命名/删除
- [ ] 链接更新: 重命名笔记 A → 笔记 B 中的 `[[A]]` 自动更新为新标题
- [ ] 导航历史: 打开多个笔记 → Ctrl+[ 后退 → Ctrl+] 前进
- [ ] 搜索高亮: 搜索关键词 → 结果中关键词高亮显示
- [ ] 命令面板: Ctrl+K 搜索新命令均可执行
