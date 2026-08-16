import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_service.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';

class FakeEmbedder implements Embedder {
  final Map<String, List<double>> table;
  FakeEmbedder(this.table);
  @override
  Future<List<double>> embed(String text) async => table[text] ?? List.filled(3, 0);
  @override
  Future<void> dispose() async {}
}

void main() {
  late Directory tempDir;
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('vec_index');
    await HiveService.initHive(testPath: tempDir.path);
  });
  tearDown(() async {
    await HiveService.closeHive();
    await tempDir.delete(recursive: true);
  });

  test('embedAndStore 后 nearest 返回最近邻', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder({
        'Flutter 开发': [1, 0, 0],
        'Dart 语言': [0.9, 0.1, 0],
        '做饭': [0, 1, 0],
      })),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'Flutter 开发', modelId: 'm');
    await idx.embedAndStore('n2', 'Dart 语言', modelId: 'm');
    await idx.embedAndStore('n3', '做饭', modelId: 'm');

    final neighbors = await idx.nearest('n1', k: 2);
    expect(neighbors.first.noteId, 'n2');
    expect(neighbors.first.score, greaterThan(neighbors.last.score));
  });

  test('vectorOf 返回存储向量', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder({'x': [1, 1, 1]})),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'x', modelId: 'm');
    final v = idx.vectorOf('n1');
    expect(v, [1, 1, 1]);
  });

  test('模型档位变化触发需要重嵌入', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder({'x': [1, 1, 1]})),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'x', modelId: 'old-model');
    expect(idx.needsReindex('new-model'), isTrue);
    expect(idx.needsReindex('old-model'), isFalse);
  });
}