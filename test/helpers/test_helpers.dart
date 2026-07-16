/// 测试辅助工具
/// 提供测试中常用的数据构建和 Provider override 辅助函数

library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/core/plugin/plugin_manifest.dart';
import 'package:aeromind/providers/note_provider.dart';

/// 创建测试用 NoteModel
NoteModel createTestNote({
  String id = 'test-id-1',
  String title = '测试笔记',
  String content = '# 测试笔记\n\n这是测试内容',
  String filePath = '/test/path.md',
  List<String> tags = const [],
  List<String> backlinks = const [],
  List<String> outgoingLinks = const [],
  List<EntityHighlight> entities = const [],
}) {
  return NoteModel(
    id: id,
    title: title,
    rawMarkdown: content,
    filePath: filePath,
    createdAt: DateTime(2024, 1, 1),
    updatedAt: DateTime(2024, 6, 1),
    tags: tags,
    backlinks: backlinks,
    outgoingLinks: outgoingLinks,
    entities: entities,
  );
}

/// 创建测试用 Widget 包裹器 (带 ProviderScope)
Widget createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: Scaffold(body: child),
    ),
  );
}

/// 创建测试用 PluginManifest
PluginManifest createTestManifest({
  String id = 'com.test.example',
  String name = '测试插件',
  String version = '1.0.0',
}) {
  return PluginManifest(
    id: id,
    name: name,
    version: version,
    description: '用于测试的示例插件',
  );
}

/// 内存中的 NoteRepository 实现，用于测试
class InMemoryNoteRepository implements NoteRepository {
  final Map<String, NoteModel> _notes = {};
  final _changesController = StreamController<NoteChangeEvent>.broadcast();
  int _idCounter = 0;

  @override
  Stream<NoteChangeEvent> get changes => _changesController.stream;

  @override
  Future<NoteModel?> getNote(String id) async => _notes[id];

  @override
  Future<List<NoteModel>> getAllNotes() async => _notes.values.toList();

  @override
  Future<NoteModel> saveNote(NoteModel note) async {
    final id = note.id.isEmpty ? generateId() : note.id;
    final saved = note.copyWith(id: id);
    _notes[id] = saved;
    _changesController.add(NoteChangeEvent(NoteChangeType.saved, id));
    return saved;
  }

  @override
  Future<void> deleteNote(String id) async {
    _notes.remove(id);
    _changesController.add(NoteChangeEvent(NoteChangeType.deleted, id));
  }

  @override
  Future<List<NoteModel>> searchBySemantic(String query) async => [];

  @override
  Future<int> getNoteCount() async => _notes.length;

  @override
  Future<bool> noteExists(String id) async => _notes.containsKey(id);

  @override
  String generateId() {
    _idCounter++;
    return 'note-$_idCounter';
  }

  @override
  void dispose() {
    _changesController.close();
  }
}
