import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_service.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';

class FakeEmbedder implements Embedder {
  @override
  Future<List<double>> embed(String text) async => [1, 0, 0];
  @override
  Future<void> dispose() async {}
}

void main() {
  late Directory tempDir;
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('reindex');
    await HiveService.initHive(testPath: tempDir.path);
  });
  tearDown(() async {
    await HiveService.closeHive();
    await tempDir.delete(recursive: true);
  });

  test('reindexAll 更新 modelId 并覆盖旧向量', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder()),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', '旧文本', modelId: 'old-model');

    var done = 0, total = 0;
    await idx.reindexAll([
      NoteModel(id: 'n1', title: '新标题', rawMarkdown: '新正文',
          filePath: '/n1.md', createdAt: DateTime(2026,1,1),
          updatedAt: DateTime(2026,1,1)),
    ], 'new-model', onProgress: (d, t) { done = d; total = t; });

    expect(done, 1);
    expect(total, 1);
    expect(idx.needsReindex('new-model'), isFalse);
    expect(idx.vectorOf('n1'), isNotNull);
  });
}