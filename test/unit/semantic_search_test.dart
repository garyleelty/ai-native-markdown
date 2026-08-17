/// ══════════════════════════════════════════════════
/// 语义搜索测试
/// ══════════════════════════════════════════════════
/// 模型未就绪时返回空结果，就绪后按查询返回 Top-K。
library;

import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/providers/model_status_provider.dart';
import 'package:aeromind/features/semantic_engine/providers/semantic_search_provider.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_service.dart';

class FakeEmbedder implements Embedder {
  @override
  Future<List<double>> embed(String text) async {
    if (text.contains('Flutter')) return [1, 0, 0];
    return [0, 1, 0];
  }

  @override
  Future<void> dispose() async {}
}

void main() {
  late Directory tempDir;
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('semsearch');
    await HiveService.initHive(testPath: tempDir.path);
  });
  tearDown(() async {
    await HiveService.closeHive();
    await tempDir.delete(recursive: true);
  });

  test('模型未就绪时返回空结果', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final hits = await container.read(semanticSearchProvider('Flutter').future);
    expect(hits, isEmpty);
  });

  test('模型就绪且查询命中时返回 Top-K', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder()),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'Flutter 开发', modelId: 'm');
    await idx.embedAndStore('n2', '做饭', modelId: 'm');
    container.read(modelStatusProvider.notifier).finishDownload('m');

    final hits = await container.read(semanticSearchProvider('Flutter').future);
    expect(hits, isNotEmpty);
    expect(hits.first.noteId, 'n1');
    expect(hits.first.score, greaterThan(0));
  });
}
