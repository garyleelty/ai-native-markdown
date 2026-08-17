/// ══════════════════════════════════════════════════
/// 预测链接语义推荐测试
/// ══════════════════════════════════════════════════
/// 模型就绪时走语义路径，未就绪时回退 TF-IDF。
library;

import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/providers/model_status_provider.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_service.dart';
import 'package:aeromind/providers/ai_provider.dart';
import 'package:aeromind/providers/note_provider.dart';

import '../helpers/test_helpers.dart';

class FakeEmbedder implements Embedder {
  @override
  Future<List<double>> embed(String text) async {
    if (text.contains('Flutter')) return [1, 0, 0];
    if (text.contains('Dart')) return [0.9, 0.1, 0];
    return [0, 1, 0];
  }

  @override
  Future<void> dispose() async {}
}

void main() {
  late Directory tempDir;
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('reco');
    await HiveService.initHive(testPath: tempDir.path);
  });
  tearDown(() async {
    await HiveService.closeHive();
    await tempDir.delete(recursive: true);
  });

  test('模型就绪时走语义推荐', () async {
    // 嵌入用标题、TF-IDF 用正文：正文刻意不含 Flutter/Dart 关键词，
    // 使 TF-IDF 无法命中（空结果），仅语义路径能产出推荐。
    final repo = InMemoryNoteRepository();
    await repo.saveNote(createTestNote(id: 'n1', title: 'Flutter 开发', content: '跨平台开发框架'));
    await repo.saveNote(createTestNote(id: 'n2', title: 'Dart 语言', content: '强类型静态语言'));
    await repo.saveNote(createTestNote(id: 'n3', title: '菜谱', content: '红烧肉做法'));

    final container = ProviderContainer(overrides: [
      noteRepositoryProvider.overrideWithValue(repo),
      embedderProvider.overrideWithValue(FakeEmbedder()),
    ]);
    addTearDown(container.dispose);

    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'Flutter 开发', modelId: 'm');
    await idx.embedAndStore('n2', 'Dart 语言', modelId: 'm');
    await idx.embedAndStore('n3', '菜谱', modelId: 'm');

    container.read(modelStatusProvider.notifier).finishDownload('m');

    final links = await container.read(predictiveLinksProvider('n1').future);
    expect(links, isNotEmpty);
    expect(links.first.targetNoteId, 'n2');
  });

  test('模型未就绪时回退 TF-IDF', () async {
    final repo = InMemoryNoteRepository();
    await repo.saveNote(createTestNote(id: 'n1', title: 'Flutter 开发', content: 'Flutter 跨平台开发框架'));
    await repo.saveNote(createTestNote(id: 'n2', title: 'Dart 语言', content: 'Dart 是 Flutter 的语言'));

    final container = ProviderContainer(overrides: [
      noteRepositoryProvider.overrideWithValue(repo),
    ]);
    addTearDown(container.dispose);

    final links = await container.read(predictiveLinksProvider('n1').future);
    expect(links, isNotEmpty);
  });
}
