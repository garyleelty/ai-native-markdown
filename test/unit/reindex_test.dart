import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/providers/model_status_provider.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_service.dart';
import 'package:aeromind/providers/note_provider.dart';
import '../helpers/test_helpers.dart';

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

  test('下载完成后自动触发首次全量嵌入', () async {
    final repo = InMemoryNoteRepository();
    await repo.saveNote(createTestNote(id: 'n1', title: '新标题', content: '新正文'));

    final container = ProviderContainer(overrides: [
      noteRepositoryProvider.overrideWithValue(repo),
      embedderProvider.overrideWithValue(FakeEmbedder()),
    ]);
    addTearDown(container.dispose);

    final statusN = container.read(modelStatusProvider.notifier);
    final idx = container.read(vectorIndexProvider.notifier);

    // 模拟：模型下载完成（首次，向量索引为空）
    statusN.finishDownload('new-model');

    // 触发换档编排（应完成首次全量嵌入）
    await statusN.ensureModelForTier('new-model');

    expect(container.read(modelStatusProvider).status,
        SemanticEngineStatus.ready);
    expect(container.read(modelStatusProvider).currentModelId, 'new-model');
    expect(idx.needsReindex('new-model'), isFalse);
    expect(idx.vectorOf('n1'), isNotNull);
  });
}