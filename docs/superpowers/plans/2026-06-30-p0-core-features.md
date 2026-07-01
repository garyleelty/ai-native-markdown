# P0 核心基础功能实现计划

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 8 项 P0 核心缺失功能，让 AeroMind 从「技术演示」转变为「日常可用」的笔记工具。

**Architecture:** 基于现有 Riverpod + Hive + Feature-based 架构，每个功能独立可测试。优先复用现有组件和模式。

**Tech Stack:** Flutter, Riverpod, Hive, flutter_markdown

**当前状态基线：**
- ✅ NoteModel 已有 folderPath 字段
- ✅ NoteRepository 已有 deleteNote 方法
- ✅ SidebarState 已有 outline/backlinks 相关字段和视图
- ✅ SidebarNotifier 已有文件夹树构建、大纲更新、反向链接加载
- ✅ 大纲面板和反向链接面板 UI 已实现
- ❌ 笔记管理 CRUD UI（新建/删除/重命名/右键菜单）
- ❌ 编辑器工具栏扩展（目前仅 4 个按钮）
- ❌ 大纲点击跳转
- ❌ 模板内容写入
- ❌ 设置页面功能接入
- ❌ 知识图谱真实数据
- ❌ 标签管理功能
- ❌ Live Preview（技术复杂度最高，放最后）

---

## 文件结构总览

### 新建文件
- `lib/core/services/settings_service.dart` — 设置持久化服务
- `lib/features/editor/services/link_updater_service.dart` — 链接更新服务（重命名时更新引用）
- `test/unit/note_crud_test.dart` — 笔记 CRUD 单元测试

### 修改文件
- `lib/features/sidebar/widgets/sidebar_container.dart` — 添加新建按钮、右键菜单、删除/重命名对话框
- `lib/features/editor/widgets/note_panel.dart` — 工具栏扩展、大纲跳转、标题编辑
- `lib/features/templates/widgets/template_gallery.dart` — 模板内容写入
- `lib/features/settings/widgets/settings_page.dart` — 设置功能接入
- `lib/app.dart` — 知识图谱真实数据接入、新命令注册
- `lib/features/knowledge_graph/services/graph_layout.dart` — 从真实笔记构建图谱
- `lib/providers/sidebar_provider.dart` — 添加删除笔记、重命名笔记方法
- `lib/providers/graph_provider.dart` — （如存在）图谱数据 provider
- `lib/features/command_palette/services/command_registry.dart` — 注册新命令

---

## Phase 1: 笔记管理 CRUD

### Task 1.1: SidebarNotifier 添加删除/重命名方法

**Files:**
- Modify: `lib/providers/sidebar_provider.dart`

- [ ] **Step 1: 添加 deleteNote 方法到 SidebarNotifier**

在 `sidebar_provider.dart` 中 `selectNote` 方法之后添加：

```dart
/// 删除笔记
Future<void> deleteNote(String noteId) async {
  final repo = ref.read(noteRepositoryProvider);
  await repo.deleteNote(noteId);
  await loadNoteTree();
  // 如果删除的是选中的笔记，清除选中状态
  if (state.selectedNoteId == noteId) {
    clearSelection();
  }
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

- [ ] **Step 2: 运行分析验证**

```bash
dart analyze lib/providers/sidebar_provider.dart
```
Expected: 无错误

---

### Task 1.2: 侧边栏添加新建笔记按钮

**Files:**
- Modify: `lib/features/sidebar/widgets/sidebar_container.dart`

- [ ] **Step 1: 在 _SidebarHeader 中添加新建笔记按钮**

找到 `_SidebarHeader` 组件，在标题右侧添加新建按钮。在现有 `_SidebarHeader` 的 Row 中添加：

```dart
// 在 "笔记" 文字后添加 SizedBox 和新建按钮
const Spacer(),
IconButton(
  icon: const Icon(Icons.add, size: 18, color: AeroColors.textSecondary),
  tooltip: '新建笔记',
  onPressed: () => _showNewNoteDialog(context),
  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
  padding: EdgeInsets.zero,
),
```

需要添加 `_showNewNoteDialog` 方法到 `_SidebarContainerState`：

```dart
void _showNewNoteDialog(BuildContext context) {
  final controller = TextEditingController();
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AeroColors.bgElevated,
      title: const Text('新建笔记', style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
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

void _createNote(BuildContext ctx, String title) async {
  if (title.trim().isEmpty) {
    Navigator.pop(ctx);
    return;
  }

  final repo = ref.read(noteRepositoryProvider);
  final note = NoteModel(
    id: uuid.v4(),
    title: title.trim(),
    rawMarkdown: '# ${title.trim()}\n\n',
    filePath: '',
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );
  await repo.saveNote(note);
  await ref.read(sidebarProvider.notifier).loadNoteTree();
  
  if (mounted) {
    Navigator.pop(ctx);
    widget.onNoteSelected?.call(note.id, note.title);
  }
}
```

需要添加 import：
```dart
import 'package:uuid/uuid.dart';
import '../../core/models/note_model.dart';
```

注意：先检查项目中 uuid 的使用方式（是否是全局实例）。

- [ ] **Step 2: 运行分析验证**

```bash
dart analyze lib/features/sidebar/widgets/sidebar_container.dart
```
Expected: 无错误

---

### Task 1.3: 笔记树节点添加上下文菜单（右键/长按）

**Files:**
- Modify: `lib/features/sidebar/widgets/sidebar_container.dart`

- [ ] **Step 1: 为 _NoteTreeTile 添加右键菜单**

找到 `_NoteTreeTile` 组件，将 `InkWell` 的 `onTap` 保留，添加 `onSecondaryTap`（右键）和 `onLongPress`（长按触摸）来显示上下文菜单。

在 `_NoteTreeTile` 的 build 方法中修改 InkWell：

```dart
return InkWell(
  onTap: widget.onTap,
  onSecondaryTap: () => _showContextMenu(context),
  onLongPress: () => _showContextMenu(context),
  child: Container(
    // ... 现有内容 ...
  ),
);
```

添加 `_showContextMenu` 方法到 `_NoteTreeTileState`（如果是 StatefulWidget）或 `_NoteTreeTile`（如果是 StatelessWidget）：

```dart
void _showContextMenu(BuildContext context) {
  final position = _getTapPosition(context);
  showMenu(
    context: context,
    position: position,
    color: AeroColors.bgElevated,
    items: [
      const PopupMenuItem(
        value: 'rename',
        child: Row(
          children: [
            Icon(Icons.edit, size: 16, color: AeroColors.textSecondary),
            SizedBox(width: 8),
            Text('重命名', style: TextStyle(color: AeroColors.textPrimary, fontSize: 12)),
          ],
        ),
      ),
      const PopupMenuItem(
        value: 'duplicate',
        child: Row(
          children: [
            Icon(Icons.copy, size: 16, color: AeroColors.textSecondary),
            SizedBox(width: 8),
            Text('复制笔记', style: TextStyle(color: AeroColors.textPrimary, fontSize: 12)),
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
    ],
  ).then((value) {
    if (value == null) return;
    switch (value) {
      case 'rename':
        _showRenameDialog(context);
        break;
      case 'duplicate':
        _duplicateNote(context);
        break;
      case 'delete':
        _confirmDelete(context);
        break;
    }
  });
}

RelativeRect _getTapPosition(BuildContext context) {
  final renderBox = context.findRenderObject() as RenderBox?;
  if (renderBox == null) {
    return RelativeRect.fromLTRB(0, 0, 0, 0);
  }
  final offset = renderBox.localToGlobal(Offset.zero);
  return RelativeRect.fromLTRB(
    offset.dx,
    offset.dy + renderBox.size.height,
    offset.dx + renderBox.size.width,
    offset.dy + renderBox.size.height,
  );
}

void _showRenameDialog(BuildContext context) {
  final controller = TextEditingController(text: widget.node.title);
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AeroColors.bgElevated,
      title: const Text('重命名笔记', style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
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

void _doRename(BuildContext ctx, String newTitle) async {
  if (newTitle.trim().isEmpty || newTitle.trim() == widget.node.title) {
    Navigator.pop(ctx);
    return;
  }
  await ref.read(sidebarProvider.notifier).renameNote(widget.node.id, newTitle.trim());
  if (ctx.mounted) Navigator.pop(ctx);
}

void _duplicateNote(BuildContext context) async {
  final repo = ref.read(noteRepositoryProvider);
  final note = await repo.getNote(widget.node.id);
  if (note == null) return;

  final newNote = note.copyWith(
    title: '${note.title} 副本',
    updatedAt: DateTime.now(),
  );
  // 注意：copyWith 不会生成新 ID，需要手动创建
  final duplicated = NoteModel(
    id: const Uuid().v4(),
    title: '${note.title} 副本',
    rawMarkdown: note.rawMarkdown,
    filePath: note.filePath,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
    tags: note.tags,
    folderPath: note.folderPath,
  );
  await repo.saveNote(duplicated);
  await ref.read(sidebarProvider.notifier).loadNoteTree();
}

void _confirmDelete(BuildContext context) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AeroColors.bgElevated,
      title: const Text('确认删除', style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
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
```

注意：
- 如果 `_NoteTreeTile` 是 StatelessWidget，需要改为 ConsumerStatefulWidget 才能使用 ref
- 文件夹节点也需要菜单（新建子笔记、重命名文件夹、删除文件夹）

- [ ] **Step 2: 为文件夹节点添加菜单**

如果 `_NoteTreeTile` 同时用于文件夹和笔记，需要根据 `isFolder` 区分菜单项：

```dart
List<PopupMenuEntry<String>> _buildMenuItems() {
  if (widget.node.isFolder) {
    return [
      const PopupMenuItem(
        value: 'new_note',
        child: Row(
          children: [
            Icon(Icons.note_add, size: 16, color: AeroColors.textSecondary),
            SizedBox(width: 8),
            Text('新建笔记', style: TextStyle(color: AeroColors.textPrimary, fontSize: 12)),
          ],
        ),
      ),
      const PopupMenuItem(
        value: 'rename',
        child: Row(
          children: [
            Icon(Icons.edit, size: 16, color: AeroColors.textSecondary),
            SizedBox(width: 8),
            Text('重命名', style: TextStyle(color: AeroColors.textPrimary, fontSize: 12)),
          ],
        ),
      ),
    ];
  } else {
    return [
      // ... 笔记菜单项（重命名、复制、删除）
    ];
  }
}
```

- [ ] **Step 3: 运行分析验证**

```bash
dart analyze lib/features/sidebar/widgets/sidebar_container.dart
```
Expected: 无错误

---

### Task 1.4: 注册笔记 CRUD 命令

**Files:**
- Modify: `lib/features/command_palette/services/command_registry.dart`
- Modify: `lib/app.dart`

- [ ] **Step 1: 在 command_registry.dart 中注册新命令**

在现有命令列表中添加：

```dart
// 新建笔记
CommandDef(
  id: 'note.new',
  name: '新建笔记',
  icon: Icons.add,
  shortcut: 'Ctrl+N',
  category: CommandCategory.note,
  description: '创建一篇新笔记',
),
// 删除当前笔记
CommandDef(
  id: 'note.delete',
  name: '删除笔记',
  icon: Icons.delete_outline,
  category: CommandCategory.note,
  description: '删除当前打开的笔记',
),
// 重命名当前笔记
CommandDef(
  id: 'note.rename',
  name: '重命名笔记',
  icon: Icons.edit,
  category: CommandCategory.note,
  description: '重命名当前笔记',
),
```

- [ ] **Step 2: 在 app.dart 中绑定 action**

在 `_initCommandActions` 中添加：

```dart
'note.new': () {
  // 显示新建笔记对话框 (需要通过全局 Key 或状态管理触发)
  // 简单做法：创建一个新笔记并打开
  _quickCreateNote();
},
'note.delete': () {
  final paneState = ref.read(paneStackProvider);
  if (paneState.activeNoteId != null) {
    // 需要确认对话框
  }
},
'note.rename': () {
  final paneState = ref.read(paneStackProvider);
  if (paneState.activeNoteId != null) {
    // 触发重命名
  }
},
```

添加 `_quickCreateNote` 辅助方法：

```dart
Future<void> _quickCreateNote() async {
  final repo = ref.read(noteRepositoryProvider);
  final now = DateTime.now();
  final title = '未命名笔记 ${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  final note = NoteModel(
    id: const Uuid().v4(),
    title: title,
    rawMarkdown: '# $title\n\n',
    filePath: '',
    createdAt: now,
    updatedAt: now,
  );
  await repo.saveNote(note);
  ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
  ref.read(sidebarProvider.notifier).loadNoteTree();
}
```

- [ ] **Step 3: 运行分析验证**

```bash
dart analyze
```
Expected: 无错误

---

### Task 1.5: 单元测试

**Files:**
- Create: `test/unit/note_crud_test.dart`

- [ ] **Step 1: 编写笔记 CRUD 测试**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/providers/note_provider.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:aeromind/core/services/hive_service.dart';
import '../helpers/test_helpers.dart';

void main() {
  group('Note CRUD Operations', () {
    late LocalNoteRepository repo;

    setUp(() async {
      await initTestHive();
      repo = LocalNoteRepository();
    });

    tearDown(() async {
      await HiveService.noteBox.clear();
    });

    test('创建笔记后可以通过 ID 获取', () async {
      final note = NoteModel(
        id: 'test-1',
        title: '测试笔记',
        rawMarkdown: '# 测试\n内容',
        filePath: '',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await repo.saveNote(note);
      final fetched = await repo.getNote('test-1');

      expect(fetched, isNotNull);
      expect(fetched!.title, equals('测试笔记'));
    });

    test('删除笔记后无法再获取', () async {
      final note = NoteModel(
        id: 'test-2',
        title: '待删除',
        rawMarkdown: '内容',
        filePath: '',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await repo.saveNote(note);
      expect(await repo.noteExists('test-2'), isTrue);

      await repo.deleteNote('test-2');
      expect(await repo.noteExists('test-2'), isFalse);
    });

    test('重命名笔记后标题更新', () async {
      final note = NoteModel(
        id: 'test-3',
        title: '旧标题',
        rawMarkdown: '# 旧标题\n内容',
        filePath: '',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await repo.saveNote(note);
      final updated = note.copyWith(title: '新标题');
      await repo.saveNote(updated);

      final fetched = await repo.getNote('test-3');
      expect(fetched!.title, equals('新标题'));
    });

    test('getAllNotes 返回所有笔记并按更新时间排序', () async {
      final now = DateTime.now();
      final note1 = NoteModel(
        id: 'n1',
        title: '笔记1',
        rawMarkdown: '',
        filePath: '',
        createdAt: now,
        updatedAt: now.subtract(const Duration(hours: 2)),
      );
      final note2 = NoteModel(
        id: 'n2',
        title: '笔记2',
        rawMarkdown: '',
        filePath: '',
        createdAt: now,
        updatedAt: now.subtract(const Duration(hours: 1)),
      );

      await repo.saveNote(note1);
      await repo.saveNote(note2);

      final all = await repo.getAllNotes();
      expect(all.length, equals(2));
      expect(all[0].id, equals('n2')); // 最近更新的在前
    });
  });
}
```

- [ ] **Step 2: 运行测试**

```bash
flutter test test/unit/note_crud_test.dart -v
```
Expected: 所有测试通过

---

## Phase 2: 编辑器工具栏扩展

### Task 2.1: 扩展工具栏按钮

**Files:**
- Modify: `lib/features/editor/widgets/note_panel.dart`

- [ ] **Step 1: 扩展 _buildToolbar 方法**

找到 `_buildToolbar` 方法，将按钮从 4 个扩展到至少 12 个：

当前按钮：粗体、斜体、代码、双向链接
新增按钮：H1、H2、无序列表、有序列表、任务列表、引用、链接、图片、分割线

```dart
Widget _buildToolbar() {
  return Container(
    height: 36,
    padding: const EdgeInsets.symmetric(horizontal: 8),
    decoration: const BoxDecoration(
      color: AeroColors.bgElevated,
      border: Border(bottom: BorderSide(color: AeroColors.border, width: 1)),
    ),
    child: ListView(
      scrollDirection: Axis.horizontal,
      children: [
        _toolbarButton(Icons.format_bold, '粗体', _applyBold),
        _toolbarButton(Icons.format_italic, '斜体', _applyItalic),
        _toolbarButton(Icons.strikethrough_s, '删除线', _applyStrikethrough),
        _toolbarDivider(),
        _toolbarButton(Icons.looks_one, '标题 1', () => _applyHeading(1)),
        _toolbarButton(Icons.looks_two, '标题 2', () => _applyHeading(2)),
        _toolbarButton(Icons.text_fields, '标题 3', () => _applyHeading(3)),
        _toolbarDivider(),
        _toolbarButton(Icons.format_list_bulleted, '无序列表', _applyUnorderedList),
        _toolbarButton(Icons.format_list_numbered, '有序列表', _applyOrderedList),
        _toolbarButton(Icons.check_box, '任务列表', _applyTaskList),
        _toolbarDivider(),
        _toolbarButton(Icons.format_quote, '引用', _applyQuote),
        _toolbarButton(Icons.code, '代码块', _applyCodeBlock),
        _toolbarButton(Icons.horizontal_rule, '分割线', _applyHorizontalRule),
        _toolbarDivider(),
        _toolbarButton(Icons.link, '链接', _applyLink),
        _toolbarButton(Icons.image, '图片', _insertImage),
        _toolbarButton(Icons.insert_link, '双向链接', _insertWikiLink),
      ],
    ),
  );
}

Widget _toolbarDivider() {
  return Container(
    width: 1,
    height: 20,
    margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
    color: AeroColors.border,
  );
}
```

- [ ] **Step 2: 实现所有格式化方法**

在 `_NotePanelState` 中添加所有格式化方法：

```dart
void _applyBold() {
  _wrapSelection('**', '**');
}

void _applyItalic() {
  _wrapSelection('*', '*');
}

void _applyStrikethrough() {
  _wrapSelection('~~', '~~');
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

void _applyCodeBlock() {
  _wrapSelection('\n```\n', '\n```\n');
}

void _applyHorizontalRule() {
  _insertAtCursor('\n---\n');
}

void _applyLink() {
  // 简单实现：包裹选中文字为 [text](url)
  final selection = _textController.selection;
  final text = _textController.text;
  final selectedText = selection.isValid
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
  final selectedText = selection.isValid
      ? text.substring(selection.start, selection.end)
      : '';
  
  final newText = '[[$selectedText]]';
  _replaceSelection(newText);
}

// 辅助方法
void _wrapSelection(String before, String after) {
  final selection = _textController.selection;
  final text = _textController.text;
  
  if (!selection.isValid || selection.isCollapsed) {
    // 无选中文本，插入前后标记并将光标放中间
    final newText = text.substring(0, selection.baseOffset) + before + after + text.substring(selection.baseOffset);
    _textController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: selection.baseOffset + before.length),
    );
  } else {
    // 有选中文本，包裹
    final selectedText = text.substring(selection.start, selection.end);
    final newText = text.substring(0, selection.start) + before + selectedText + after + text.substring(selection.end);
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
  
  // 找到当前行的起始位置
  final cursorPos = selection.baseOffset;
  int lineStart = cursorPos;
  while (lineStart > 0 && text[lineStart - 1] != '\n') {
    lineStart--;
  }
  
  final newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
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
  
  final newText = text.substring(0, cursorPos) + insertText + text.substring(cursorPos);
  _textController.value = TextEditingValue(
    text: newText,
    selection: TextSelection.collapsed(offset: cursorPos + insertText.length),
  );
  _onTextChanged(newText);
}

void _replaceSelection(String replacement) {
  final selection = _textController.selection;
  final text = _textController.text;
  
  final newText = text.substring(0, selection.start) + replacement + text.substring(selection.end);
  _textController.value = TextEditingValue(
    text: newText,
    selection: TextSelection(
      baseOffset: selection.start + replacement.length,
      extentOffset: selection.start + replacement.length,
    ),
  );
  _onTextChanged(newText);
}
```

注意：这些辅助方法可能已有部分实现，请检查 EditorService 和 note_panel 中的现有代码，避免重复。

- [ ] **Step 2: 运行分析验证**

```bash
dart analyze lib/features/editor/widgets/note_panel.dart
```
Expected: 无错误

---

### Task 2.2: 添加键盘快捷键支持

**Files:**
- Modify: `lib/features/editor/widgets/note_panel.dart`

- [ ] **Step 1: 使用 RawKeyboardListener 或 Shortcuts 组件**

用 `Shortcuts` 和 `Intent` 包裹编辑器部分，或使用 `CallbackShortcuts`：

```dart
// 在 NotePanel 的 build 中，包裹编辑器部分：
CallbackShortcuts(
  bindings: {
    const SingleActivator(LogicalKeyboardKey.keyB, control: true, meta: true): _applyBold,
    const SingleActivator(LogicalKeyboardKey.keyI, control: true, meta: true): _applyItalic,
    const SingleActivator(LogicalKeyboardKey.keyK, control: true, meta: true): _applyLink,
    // ... 更多快捷键
  },
  child: Focus(
    autofocus: true,
    child: _buildEditor(),
  ),
)
```

- [ ] **Step 2: 运行分析验证**

```bash
dart analyze lib/features/editor/widgets/note_panel.dart
```

---

### Task 2.3: 编辑器服务单元测试补充

**Files:**
- Modify: `test/unit/editor_service_test.dart`

- [ ] **Step 1: 补充格式化操作测试（如果 EditorService 有这些方法）**

- [ ] **Step 2: 运行测试**

```bash
flutter test test/unit/editor_service_test.dart -v
```

---

## Phase 3: 大纲跳转 + 模板内容写入

### Task 3.1: 大纲点击跳转到编辑器对应位置

**Files:**
- Modify: `lib/features/editor/widgets/note_panel.dart`
- Modify: `lib/features/outline/widgets/outline_panel.dart`

- [ ] **Step 1: 在 NotePanel 中实现滚动到指定位置的方法**

首先，将 `_textController` 暴露或添加跳转方法：

```dart
/// 滚动到指定字符偏移位置
void scrollToOffset(int offset) {
  if (!_textController.value.isValid) return;
  
  // 将光标移动到指定位置
  _textController.selection = TextSelection.collapsed(offset: offset);
  
  // 尝试滚动到可视区域
  // 注意：Flutter 的 TextField 没有直接的滚动方法
  // 需要使用 ScrollController 或通过确保光标可见来实现
  _ensureCursorVisible();
}

void _ensureCursorVisible() {
  // 给 TextField 的 focusNode 调用 ensureVisible
  _focusNode?.ensureVisible();
}
```

实际上更简单的方式是使用 `TextEditingController` 的 `selection` 并让 TextField 自动滚动。但 TextField 的 `scrollController` 可以手动控制。

让我找一个更实际的方案：

```dart
// 添加 ScrollController
final ScrollController _scrollController = ScrollController();

// 在 TextField 上设置 scrollController
TextField(
  controller: _textController,
  scrollController: _scrollController,
  // ...
)

// 跳转方法
void scrollToOffset(int charOffset) {
  if (charOffset < 0 || charOffset > _textController.text.length) return;
  
  // 移动光标
  _textController.selection = TextSelection.collapsed(offset: charOffset);
  
  // 粗略估算滚动位置（每行约 20px）
  // 更精确的方式需要使用 TextPainter 计算
  final textBefore = _textController.text.substring(0, charOffset);
  final lineCount = '\n'.allMatches(textBefore).length;
  final estimatedScrollOffset = lineCount * 24.0; // 估算行高
  
  _scrollController.animateTo(
    estimatedScrollOffset.clamp(0.0, _scrollController.position.maxScrollExtent),
    duration: const Duration(milliseconds: 200),
    curve: Curves.easeOut,
  );
  
  // 聚焦编辑器
  _focusNode.requestFocus();
}
```

- [ ] **Step 2: 将跳转方法通过回调传到侧边栏**

在 `app.dart` 中，需要建立 NotePanel 和 OutlinePanel 的通信。有几种方案：

1. **通过 PaneProvider + 全局状态**：在 PaneStackState 中记录跳转请求
2. **通过 app.dart 中的回调传递**：在 SlidingPanesContainer 外层管理
3. **最简单方案**：在 OutlinePanel 的 onHeadingTap 中，通过 Provider 找到当前活跃的 NotePanel

推荐方案 1：在 PaneStackNotifier 中添加一个跳转请求

在 `pane_provider.dart` 中添加：
```dart
/// 大纲跳转请求 (每次变化触发一次跳转)
final int? outlineJumpOffset;
final String? outlineJumpNoteId;
```

然后 NotePanel 监听这个值变化，执行滚动。

或者更简单：直接在 app.dart 中通过全局 Key 找到当前 NotePanel。

让我选择一个简单但可靠的方案：**通过 SidebarProvider 的回调机制**。

实际上，当前代码中 `OutlinePanel` 已经有 `onHeadingTap` 回调。问题是这个回调在 `sidebar_container.dart` 中是空的。

我们需要：
1. 在 `app.dart` 中，为 SidebarContainer 提供 `onOutlineHeadingTap` 回调
2. 回调中找到对应笔记的面板，执行滚动

由于 SlidingPanes 中可能有多个 NotePanel，我们需要用一个 Map 来存储每个 noteId 对应的滚动回调。

让我用 Provider 方案：

**步骤：**

1. 创建一个 `outlineJumpProvider` 或在 `pane_provider` 中添加跳转状态
2. NotePanel 监听这个状态，当 noteId 匹配时执行滚动
3. OutlinePanel 点击时更新这个状态

修改 `pane_provider.dart` 的 PaneStackState：
```dart
class PaneStackState {
  // ... 现有字段 ...
  
  /// 大纲跳转请求
  final String? jumpToNoteId;
  final int? jumpToOffset;
}
```

在 PaneStackNotifier 中添加：
```dart
/// 请求跳转到笔记的指定位置
void requestJump(String noteId, int offset) {
  state = state.copyWith(
    jumpToNoteId: noteId,
    jumpToOffset: offset,
  );
  
  // 立即清空，避免重复触发
  Future.microtask(() {
    state = state.copyWith(
      jumpToNoteId: null,
      jumpToOffset: null,
    );
  });
}
```

然后 NotePanel 中监听：
```dart
// 在 build 方法中
ref.listen(paneStackProvider.select((s) => s.jumpToNoteId), (prev, next) {
  if (next == widget.noteId && state.jumpToOffset != null) {
    scrollToOffset(state.jumpToOffset!);
  }
});
```

最后在 sidebar_container.dart 的 OutlinePanel 回调中：
```dart
OutlinePanel(
  onHeadingTap: (offset) {
    final paneState = ref.read(paneStackProvider);
    if (paneState.activeNoteId != null) {
      ref.read(paneStackProvider.notifier).requestJump(
        paneState.activeNoteId!,
        offset,
      );
    }
  },
),
```

- [ ] **Step 3: 实现具体代码并验证**

- [ ] **Step 4: 运行分析**

```bash
dart analyze
```

---

### Task 3.2: 模板内容写入

**Files:**
- Modify: `lib/features/templates/widgets/template_gallery.dart`
- Modify: `lib/features/templates/services/template_service.dart`

- [ ] **Step 1: 检查 TemplateService 的模板内容结构**

先读取 template_service.dart 确认模板数据结构。

- [ ] **Step 2: 修改模板应用逻辑，创建笔记时写入内容**

在 `_applyTemplate` 方法中，将模板内容写入新笔记：

```dart
void _applyTemplate(TemplateModel template) async {
  final repo = ref.read(noteRepositoryProvider);
  final now = DateTime.now();
  
  // 根据模板生成标题（如果模板有标题模板的话）
  final title = template.name + ' 笔记';
  
  final note = NoteModel(
    id: const Uuid().v4(),
    title: title,
    rawMarkdown: template.content, // 使用模板内容
    filePath: '',
    createdAt: now,
    updatedAt: now,
    tags: template.tags, // 如果模板有标签的话
  );
  
  await repo.saveNote(note);
  ref.read(sidebarProvider.notifier).loadNoteTree();
  
  if (mounted) {
    Navigator.of(context).pop();
    // 打开新笔记
    ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
  }
}
```

- [ ] **Step 3: 运行分析验证**

```bash
dart analyze lib/features/templates/
```

---

## Phase 4: 设置页面核心功能接入

### Task 4.1: 创建设置服务

**Files:**
- Create: `lib/core/services/settings_service.dart`

- [ ] **Step 1: 实现 SettingsService 使用 Hive 存储**

```dart
import 'package:hive_flutter/hive_flutter.dart';

/// 设置服务 — 持久化用户偏好设置
class SettingsService {
  static const String _boxName = 'settings';
  static late Box<dynamic> _box;

  static Future<void> init() async {
    _box = await Hive.openBox<dynamic>(_boxName);
  }

  // === 通用设置 ===
  
  static bool get autoSave => _box.get('autoSave', defaultValue: true);
  static set autoSave(bool value) => _box.put('autoSave', value);

  static String get defaultOpenMode => _box.get('defaultOpenMode', defaultValue: 'edit');
  static set defaultOpenMode(String value) => _box.put('defaultOpenMode', value);

  static String get themeMode => _box.get('themeMode', defaultValue: 'dark');
  static set themeMode(String value) => _box.put('themeMode', value);

  static double get fontSize => _box.get('fontSize', defaultValue: 14.0);
  static set fontSize(double value) => _box.put('fontSize', value);

  // === AI 设置 ===
  
  static String get aiRecognitionStrategy => _box.get('aiStrategy', defaultValue: 'local');
  static set aiRecognitionStrategy(String value) => _box.put('aiStrategy', value);

  static String get aiApiEndpoint => _box.get('aiApiEndpoint', defaultValue: '');
  static set aiApiEndpoint(String value) => _box.put('aiApiEndpoint', value);

  static String get aiApiKey => _box.get('aiApiKey', defaultValue: '');
  static set aiApiKey(String value) => _box.put('aiApiKey', value);

  static String get aiModel => _box.get('aiModel', defaultValue: 'gpt-3.5-turbo');
  static set aiModel(String value) => _box.put('aiModel', value);

  // === 存储设置 ===
  
  static String get storagePath => _box.get('storagePath', defaultValue: '');
  static set storagePath(String value) => _box.put('storagePath', value);

  /// 清除所有设置
  static Future<void> clearAll() async {
    await _box.clear();
  }
}
```

- [ ] **Step 2: 在 main.dart 中初始化 SettingsService**

在 Hive 初始化后添加：
```dart
await SettingsService.init();
```

- [ ] **Step 3: 运行分析验证**

```bash
dart analyze lib/core/services/settings_service.dart
```

---

### Task 4.2: 设置页面功能接入

**Files:**
- Modify: `lib/features/settings/widgets/settings_page.dart`

- [ ] **Step 1: 将设置页面改为 StatefulWidget 并接入 SettingsService**

将所有静态的 Switch/Checkbox/Slider 改为有状态的，从 SettingsService 读取值，变更时写入。

例如自动保存开关：

```dart
// 改为 StatefulWidget 后
bool _autoSave = true;

@override
void initState() {
  super.initState();
  _loadSettings();
}

void _loadSettings() {
  setState(() {
    _autoSave = SettingsService.autoSave;
    // ... 加载其他设置
  });
}

// build 中
Switch(
  value: _autoSave,
  onChanged: (value) {
    setState(() => _autoSave = value);
    SettingsService.autoSave = value;
  },
)
```

- [ ] **Step 2: 实现所有核心设置项**

至少实现：
- 自动保存开关
- 默认打开模式（编辑/阅读）
- 字体大小滑块
- AI 识别策略选择
- 清除数据按钮（带确认）

- [ ] **Step 3: 运行分析验证**

```bash
dart analyze lib/features/settings/widgets/settings_page.dart
```

---

## Phase 5: 知识图谱接入真实数据

### Task 5.1: 从真实笔记构建图谱数据

**Files:**
- Modify: `lib/app.dart` 或 `lib/features/knowledge_graph/services/graph_layout.dart`
- Modify: `lib/features/knowledge_graph/widgets/graph_canvas.dart`

- [ ] **Step 1: 检查现有图谱数据结构**

读取 graph_node.dart, graph_edge.dart, graph_layout.dart 了解数据结构。

- [ ] **Step 2: 实现从笔记列表构建图谱的方法**

```dart
/// 从笔记列表构建知识图谱
Future<(List<GraphNode>, List<GraphEdge>)> buildGraphFromNotes(List<NoteModel> notes) async {
  final nodes = <GraphNode>[];
  final edges = <GraphEdge>[];
  
  // 创建节点映射
  final nodeMap = <String, GraphNode>{};
  
  for (final note in notes) {
    final node = GraphNode(
      id: note.id,
      label: note.title,
      type: 'note',
      x: 0, // 后续由布局算法计算
      y: 0,
    );
    nodeMap[note.id] = node;
    nodes.add(node);
  }
  
  // 从 wiki links 构建边
  for (final note in notes) {
    final links = EditorService.extractLinks(note.rawMarkdown);
    for (final link in links) {
      if (!link.isWikiLink) continue;
      
      // 查找链接目标笔记（通过标题匹配）
      final targetNote = notes.firstWhere(
        (n) => n.title.toLowerCase() == link.text.toLowerCase(),
        orElse: () => null as NoteModel,
      );
      
      if (targetNote != null && nodeMap.containsKey(targetNote.id)) {
        edges.add(GraphEdge(
          id: '${note.id}_${targetNote.id}',
          source: note.id,
          target: targetNote.id,
          type: 'link',
        ));
      }
    }
  }
  
  return (nodes, edges);
}
```

- [ ] **Step 3: 在 GraphOverlay 或 GraphCanvas 中接入真实数据**

修改 `_buildGraphData` 或类似方法，从 Provider 获取笔记列表并构建图谱。

- [ ] **Step 4: 运行分析验证**

```bash
dart analyze lib/features/knowledge_graph/
```

---

## Phase 6: 标签管理功能

### Task 6.1: 标签重命名/删除

**Files:**
- Modify: `lib/features/sidebar/widgets/sidebar_container.dart`
- Modify: `lib/providers/sidebar_provider.dart`

- [ ] **Step 1: 在 SidebarNotifier 中添加标签重命名和删除方法**

```dart
/// 重命名标签（更新所有包含该标签的笔记）
Future<void> renameTag(String oldTag, String newTag) async {
  final repo = ref.read(noteRepositoryProvider);
  final notes = await repo.getAllNotes();
  
  for (final note in notes) {
    if (note.tags.contains(oldTag)) {
      final updatedTags = List<String>.from(note.tags.map(
        (t) => t == oldTag ? newTag : t,
      ));
      await repo.saveNote(note.copyWith(
        tags: updatedTags,
        updatedAt: DateTime.now(),
      ));
    }
  }
  
  _buildTagCounts(); // 刷新标签计数
}

/// 删除标签（从所有笔记中移除该标签）
Future<void> deleteTag(String tag) async {
  final repo = ref.read(noteRepositoryProvider);
  final notes = await repo.getAllNotes();
  
  for (final note in notes) {
    if (note.tags.contains(tag)) {
      final updatedTags = List<String>.from(note.tags.where((t) => t != tag));
      await repo.saveNote(note.copyWith(
        tags: updatedTags,
        updatedAt: DateTime.now(),
      ));
    }
  }
  
  _buildTagCounts();
  if (state.selectedTag == tag) {
    clearTagSelection();
  }
}
```

注意：`_buildTagCounts` 是私有方法，需要改为公有或添加调用入口。

- [ ] **Step 2: 在标签视图中添加上下文菜单**

为 `_TagView` 中的每个标签项添加长按/右键菜单（重命名、删除）。

- [ ] **Step 3: 运行分析验证**

```bash
dart analyze lib/features/sidebar/ lib/providers/
```

---

## 总体验证清单

- [ ] **笔记 CRUD**: 新建笔记 → 笔记树出现 → 右键重命名 → 标题变更 → 右键删除 → 确认后消失
- [ ] **工具栏扩展**: 12+ 个格式化按钮均可正常工作，选中文本后点击按钮正确包裹
- [ ] **大纲跳转**: 打开含标题的笔记 → 大纲面板显示标题 → 点击标题 → 编辑器滚动到对应位置
- [ ] **模板写入**: 打开模板画廊 → 选择模板 → 创建的笔记包含模板内容
- [ ] **设置功能**: 修改自动保存/字体大小等设置 → 重启应用后设置保持
- [ ] **知识图谱**: 打开图谱 → 显示所有笔记为节点，wiki 链接为边
- [ ] **标签管理**: 右键标签 → 重命名/删除 → 所有笔记同步更新
- [ ] **代码分析**: `dart analyze` 无错误
- [ ] **单元测试**: `flutter test` 所有测试通过
