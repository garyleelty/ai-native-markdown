#!/usr/bin/env python3
"""Apply Round 4 bugfixes for similar issues found in audit."""

import os
import re

BASE = "/Users/tianyi/code/ai-native-markdown"

def read(path):
    with open(os.path.join(BASE, path), 'r') as f:
        return f.read()

def write(path, content):
    with open(os.path.join(BASE, path), 'w') as f:
        f.write(content)

# ──────────────────────────────────────────────────
# Fix 1: app.dart - version history restore needs FileService import + syncToFile
# ──────────────────────────────────────────────────
print("Fix 1: app.dart - adding FileService import and syncToFile in version restore")
content = read("lib/app.dart")

# Add FileService import after hive_service import
old_import = "import 'core/services/hive_service.dart';"
new_import = """import 'core/services/hive_service.dart';
import 'core/services/file_service.dart';"""
content = content.replace(old_import, new_import, 1)

# Fix onRestore callback - add FileService.syncToFile after saveNote
old_restore = """            onRestore: (content) async {
              final repo = ref.read(noteRepositoryProvider);
              final note = await repo.getNote(noteId);
              if (note != null) {
                await repo.saveNote(note.copyWith(
                  rawMarkdown: content,
                  updatedAt: DateTime.now(),
                ));
              }
              if (mounted) Navigator.pop(ctx);
            },"""
new_restore = """            onRestore: (content) async {
              final repo = ref.read(noteRepositoryProvider);
              final note = await repo.getNote(noteId);
              if (note != null) {
                final updated = note.copyWith(
                  rawMarkdown: content,
                  updatedAt: DateTime.now(),
                );
                await repo.saveNote(updated);
                if (FileService.shouldSyncToFile(updated.filePath)) {
                  await FileService.syncToFile(updated.filePath, updated.rawMarkdown);
                }
              }
              if (mounted) Navigator.pop(ctx);
            },"""
content = content.replace(old_restore, new_restore, 1)

write("lib/app.dart", content)
print("  Done.")

# ──────────────────────────────────────────────────
# Fix 2: plugin_api_impl.dart - add FileService.syncToFile in saveNote
# ──────────────────────────────────────────────────
print("Fix 2: plugin_api_impl.dart - adding file sync in saveNote")
content = read("lib/core/services/plugin_api_impl.dart")

# Add FileService import (note: file is in core/services/ so relative import is '../services/file_service.dart')
old_import = """import '../plugin/plugin_api.dart';
import '../plugin/plugin_storage.dart';
import '../models/note_model.dart';
import '../../providers/note_provider.dart';"""
new_import = """import '../plugin/plugin_api.dart';
import '../plugin/plugin_storage.dart';
import '../models/note_model.dart';
import 'file_service.dart';
import '../../providers/note_provider.dart';"""
content = content.replace(old_import, new_import, 1)

# Fix saveNote to sync to file
old_save = """  @override
  Future<void> saveNote(NoteModel note) async {
    final repo = _ref.read(noteRepositoryProvider);
    await repo.saveNote(note);
  }"""
new_save = """  @override
  Future<void> saveNote(NoteModel note) async {
    final repo = _ref.read(noteRepositoryProvider);
    await repo.saveNote(note);
    if (FileService.shouldSyncToFile(note.filePath)) {
      await FileService.syncToFile(note.filePath, note.rawMarkdown);
    }
  }"""
content = content.replace(old_save, new_save, 1)

write("lib/core/services/plugin_api_impl.dart", content)
print("  Done.")

# ──────────────────────────────────────────────────
# Fix 3: daily_note_panel.dart - refresh _daysWithNotes after creating new diary
# ──────────────────────────────────────────────────
print("Fix 3: daily_note_panel.dart - refresh after new diary creation")
content = read("lib/features/daily_notes/widgets/daily_note_panel.dart")

old_open = """  void _openDailyNote(DateTime date) async {
    final service = ref.read(dailyNoteServiceProvider);
    final repo = ref.read(noteRepositoryProvider);
    final (note, isNew) = await service.getNoteForDate(date);
    final existing = await repo.getNote(note.id);
    if (existing == null) {
      await repo.saveNote(note);
    }
    if (mounted) {
      ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
    }
  }"""
new_open = """  void _openDailyNote(DateTime date) async {
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
        _loadDaysWithNotes();
      }
    }
  }"""
content = content.replace(old_open, new_open, 1)

write("lib/features/daily_notes/widgets/daily_note_panel.dart", content)
print("  Done.")

# ──────────────────────────────────────────────────
# Fix 4: sliding_panes_container.dart _finishEditing - add H1 update, file sync, note tree refresh
# ──────────────────────────────────────────────────
print("Fix 4: sliding_panes_container.dart _finishEditing - H1 update, file sync, tree refresh")
content = read("lib/features/sliding_panes/widgets/sliding_panes_container.dart")

# Check imports - need sidebarProvider and FileService
# First check if FileService is already imported
if "import '../../core/services/file_service.dart';" not in content and "import 'package:aeromind/core/services/file_service.dart';" not in content:
    # Find the last import line in the file (before class definitions or main code)
    # Look for existing core/services imports
    if "import '../../core/services/" in content:
        # Add after other core services imports
        old_svc_import = "import '../../core/services/hive_service.dart';"
        if old_svc_import in content:
            content = content.replace(old_svc_import, old_svc_import + "\nimport '../../core/services/file_service.dart';", 1)
        else:
            # Try to add after note_provider import
            old_np = "import '../../providers/note_provider.dart';"
            if old_np in content:
                content = content.replace(old_np, old_np + "\nimport '../../core/services/file_service.dart';", 1)

# Check if sidebarProvider is imported
if "import '../../providers/sidebar_provider.dart';" not in content:
    old_np2 = "import '../../providers/note_provider.dart';"
    if old_np2 in content and "sidebar_provider" not in content:
        content = content.replace(old_np2, old_np2 + "\nimport '../../providers/sidebar_provider.dart';", 1)

# Fix _finishEditing method
old_finish = """  Future<void> _finishEditing() async {
    final newTitle = _controller.text.trim();
    if (newTitle.isEmpty) {
      _controller.text = widget.title;
      setState(() => _isEditing = false);
      return;
    }

    if (newTitle != widget.title) {
      // 更新面板标题
      ref.read(paneStackProvider.notifier).updatePaneTitle(widget.index, newTitle);
      // 更新笔记标题
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(widget.noteId);
      if (note != null) {
        await repo.saveNote(note.copyWith(
          title: newTitle,
          updatedAt: DateTime.now(),
        ));
        // 失效相关缓存
        ref.invalidate(noteByIdProvider(widget.noteId));
        ref.invalidate(allNotesProvider);
      }
    }

    setState(() => _isEditing = false);
  }"""

new_finish = """  Future<void> _finishEditing() async {
    final newTitle = _controller.text.trim();
    if (newTitle.isEmpty) {
      _controller.text = widget.title;
      setState(() => _isEditing = false);
      return;
    }

    if (newTitle != widget.title) {
      ref.read(paneStackProvider.notifier).updatePaneTitle(widget.index, newTitle);
      final repo = ref.read(noteRepositoryProvider);
      final note = await repo.getNote(widget.noteId);
      if (note != null) {
        var newMarkdown = note.rawMarkdown;
        final h1Regex = RegExp(r'^#\\s+.+$', multiLine: true);
        final h1Match = h1Regex.firstMatch(newMarkdown);
        if (h1Match != null) {
          newMarkdown = newMarkdown.replaceFirst(h1Match.group(0)!, '# $newTitle');
        }
        final updated = note.copyWith(
          title: newTitle,
          rawMarkdown: newMarkdown,
          updatedAt: DateTime.now(),
        );
        await repo.saveNote(updated);
        if (FileService.shouldSyncToFile(updated.filePath)) {
          await FileService.syncToFile(updated.filePath, updated.rawMarkdown);
        }
        ref.invalidate(noteByIdProvider(widget.noteId));
        ref.invalidate(allNotesProvider);
        await ref.read(sidebarProvider.notifier).loadNoteTree();
      }
    }

    setState(() => _isEditing = false);
  }"""

content = content.replace(old_finish, new_finish, 1)

write("lib/features/sliding_panes/widgets/sliding_panes_container.dart", content)
print("  Done.")

print("\nAll fixes applied successfully!")
