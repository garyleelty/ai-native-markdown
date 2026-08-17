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

  test('search 返回高于阈值的排序结果，远离阈值向量结果更少', () async {
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

    final hits = await idx.search([0.9, 0.1, 0]);
    expect(hits.length, 2);
    expect(hits.first.noteId, 'n2');
    expect(hits.map((h) => h.noteId), containsAll(['n1', 'n2']));

    // 与全部向量正交的查询向量低于阈值
    final far = await idx.search([0, 0, 1]);
    expect(far.length, lessThan(hits.length));
    expect(far, isEmpty);
  });

  test('load 从 Hive 往返恢复向量与模型档位', () async {
    final container1 = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder({'x': [1, 1, 1]})),
    ]);
    addTearDown(container1.dispose);
    await container1.read(vectorIndexProvider.notifier)
        .embedAndStore('n1', 'x', modelId: 'm');

    // 新建容器与 Provider，模拟重启后重新 load
    final container2 = ProviderContainer();
    addTearDown(container2.dispose);
    final idx = container2.read(vectorIndexProvider.notifier);
    expect(idx.vectorOf('n1'), isNull);
    await idx.load();
    expect(idx.vectorOf('n1'), [1, 1, 1]);
    expect(idx.needsReindex('m'), isFalse);
    expect(idx.needsReindex('new-model'), isTrue);
  });

  test('remove 清除内存与 Hive 中的向量', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder({'x': [1, 1, 1]})),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'x', modelId: 'm');
    await idx.remove('n1');
    expect(idx.vectorOf('n1'), isNull);
    expect(await idx.state.store.get('n1'), isNull);
  });

  test('无嵌入器时 embedAndStore 空操作', () async {
    // 不 override embedderProvider，保持默认 null 回退模式
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    final embedded = await idx.embedAndStore('n1', 'x', modelId: 'm');
    expect(embedded, isFalse);
    expect(idx.vectorOf('n1'), isNull);
    expect(await idx.state.store.get('n1'), isNull);
  });
}