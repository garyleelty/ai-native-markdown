import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';
import '../models/note_model.dart';
import 'hive_service.dart';

class FileService {
  final String vaultRoot;

  static const _uuid = Uuid();
  static String? _globalVaultRoot;

  static void initializeVaultRoot(String root) {
    _globalVaultRoot = p.canonicalize(root);
  }

  static String get globalVaultRoot {
    if (_globalVaultRoot == null) {
      throw StateError('FileService 未初始化，请先调用 FileService.initializeVaultRoot()');
    }
    return _globalVaultRoot!;
  }

  FileService({required this.vaultRoot}) {
    if (_globalVaultRoot == null) {
      initializeVaultRoot(vaultRoot);
    }
  }

  static String _safePath(String filePath) {
    if (kIsWeb) return filePath;
    final root = _globalVaultRoot;
    if (root == null) return filePath;

    final normalized = p.canonicalize(filePath);
    if (!p.isWithin(root, normalized) && normalized != root) {
      throw SecurityException('路径越界访问: $filePath (vault: $root)');
    }
    return normalized;
  }

  String generateId(String filePath) {
    final relative = p.relative(filePath, from: vaultRoot);
    return relative.hashCode.toRadixString(36);
  }

  static String generateNewId() => _uuid.v4();

  static String extractTitle(String content, String filePath) {
    final h1Match = RegExp(r'^#\s+(.+)$', multiLine: true).firstMatch(content);
    if (h1Match != null) return h1Match.group(1)!.trim();
    return p.basenameWithoutExtension(filePath);
  }

  static Future<void> syncToFile(String filePath, String content) async {
    if (kIsWeb || filePath.isEmpty) return;
    try {
      final safePath = _safePath(filePath);
      final file = File(safePath);
      final parent = file.parent;
      if (!await parent.exists()) {
        await parent.create(recursive: true);
      }
      await file.writeAsString(content);
    } catch (e) {
      debugPrint('syncToFile 失败: $e');
    }
  }

  static bool shouldSyncToFile(String filePath) {
    return !kIsWeb && filePath.isNotEmpty;
  }

  Future<void> saveNote(NoteModel note) async {
    await HiveService.noteBox.put(note.id, note);
  }

  Future<NoteModel?> getNote(String id) async {
    return HiveService.noteBox.get(id);
  }

  Future<List<NoteModel>> getAllNotes() async {
    final notes = <NoteModel>[];
    for (final key in HiveService.noteBox.keys) {
      try {
        final note = await HiveService.noteBox.get(key);
        if (note != null) notes.add(note);
      } catch (e) {
        debugPrint('读取笔记 $key 失败: $e');
      }
    }
    notes.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return notes;
  }

  Future<NoteModel> createNote({
    String title = '新笔记',
    String content = '',
    String? filePath,
  }) async {
    final now = DateTime.now();
    final id = _uuid.v4();
    final targetPath = filePath ?? p.join(vaultRoot, '$id.md');
    final safePath = _safePath(targetPath);

    final note = NoteModel(
      id: id,
      title: title,
      rawMarkdown: content,
      filePath: safePath,
      createdAt: now,
      updatedAt: now,
    );

    await HiveService.noteBox.put(id, note);
    return note;
  }

  Future<void> deleteNote(String id) async {
    await HiveService.noteBox.delete(id);
  }

  String exportAsMarkdown(NoteModel note) => note.rawMarkdown;

  String exportAsJson(NoteModel note) {
    return jsonEncode({
      'id': note.id,
      'title': note.title,
      'content': note.rawMarkdown,
      'tags': note.tags,
      'createdAt': note.createdAt.toIso8601String(),
      'updatedAt': note.updatedAt.toIso8601String(),
    });
  }
}

class SecurityException implements Exception {
  final String message;
  SecurityException(this.message);
  @override
  String toString() => 'SecurityException: $message';
}
