/// ══════════════════════════════════════════════════
/// EmbedderManager 生产接线测试
/// ══════════════════════════════════════════════════
/// 生产环境 embedderProvider 委托 EmbedderManager：未就绪时回退 null，
/// 模型文件不可加载（测试环境 path_provider 不可用）时静默降级不崩溃。
/// 通过注入 fake 工厂验证真实状态流（含 C1 回归：reindexing 期间可创建）。

library;

import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/providers/embedder_manager_provider.dart';
import 'package:aeromind/features/semantic_engine/providers/model_status_provider.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_service.dart';

class FakeEmbedder implements Embedder {
  final String modelId;
  bool disposed = false;
  FakeEmbedder(this.modelId);
  @override
  Future<List<double>> embed(String text) async => List.filled(4, 1);
  @override
  Future<void> dispose() async => disposed = true;
}

/// 记录调用的 fake 创建器
class FakeFactory {
  final List<String> created = <String>[];

  Future<Embedder> call(String modelId) {
    created.add(modelId);
    return Future.value(FakeEmbedder(modelId));
  }
}

void main() {
  test('未启用语义引擎时 embedderProvider 为 null（回退模式）', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(container.read(embedderProvider), isNull);
    expect(container.read(embedderManagerProvider).current, isNull);
  });

  test('生产接线：模型就绪但无法加载模型文件时回退 null（不崩溃）', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.read(modelStatusProvider.notifier).finishDownload('bge-small-zh-v1.5');

    // 测试环境 path_provider 不可用 → 捕获异常回退 null
    final embedder = await container.read(embedderManagerProvider).ready();
    expect(embedder, isNull);
    expect(container.read(embedderProvider), isNull);
  });

  test('关闭语义引擎后嵌入器回退 null', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.read(modelStatusProvider.notifier).finishDownload('bge-small-zh-v1.5');
    await container.read(embedderManagerProvider).ready();

    container.read(modelStatusProvider.notifier).disable();
    expect(container.read(embedderManagerProvider).current, isNull);
    expect(container.read(embedderProvider), isNull);
  });

  test('C1 回归：reindexing 期间 ready() 也能创建嵌入器', () async {
    final factory = FakeFactory();
    final container = ProviderContainer(overrides: [
      embedderFactoryProvider.overrideWithValue((m) => factory(m)),
    ]);
    addTearDown(container.dispose);
    final statusN = container.read(modelStatusProvider.notifier);

    // 下载完成 → ready，随后进入 reindexing（生产重嵌入的真实状态流）
    statusN.finishDownload('bge-small-zh-v1.5');
    statusN.startReindex();

    final embedder = await container.read(embedderManagerProvider).ready();
    expect(embedder, isNotNull);
    expect(factory.created, isNotEmpty);
  });

  test('C1 回归：reindexing 期间 embedAndStore 走真实生产流并写入向量', () async {
    final tempDir = await Directory.systemTemp.createTemp('embed_mgr');
    await HiveService.initHive(testPath: tempDir.path);
    addTearDown(() async {
      await HiveService.closeHive();
      await tempDir.delete(recursive: true);
    });

    final factory = FakeFactory();
    final container = ProviderContainer(overrides: [
      embedderFactoryProvider.overrideWithValue((m) => factory(m)),
    ]);
    addTearDown(container.dispose);
    final statusN = container.read(modelStatusProvider.notifier);
    final idx = container.read(vectorIndexProvider.notifier);

    statusN.finishDownload('bge-small-zh-v1.5');
    statusN.startReindex();

    // 不 override embedderProvider：走 EmbedderManager 真实流
    final embedded =
        await idx.embedAndStore('n1', '新标题\n新正文', modelId: 'bge-small-zh-v1.5');
    expect(embedded, isTrue);
    expect(idx.vectorOf('n1'), isNotNull);
  });

  test('换档后 ready() 释放旧嵌入器并创建新档位嵌入器', () async {
    final factory = FakeFactory();
    final container = ProviderContainer(overrides: [
      embedderFactoryProvider.overrideWithValue((m) => factory(m)),
    ]);
    addTearDown(container.dispose);
    final statusN = container.read(modelStatusProvider.notifier);
    final manager = container.read(embedderManagerProvider);

    statusN.finishDownload('bge-small-zh-v1.5');
    final first = await manager.ready();
    expect(first, isNotNull);

    // 切到 base 档位：下载完成进入 ready，随后 reindexing
    statusN.finishDownload('bge-base-zh-v1.5');
    statusN.startReindex();
    final second = await manager.ready();

    expect(second, isNotNull);
    expect(factory.created.length, 2);
    expect((first as FakeEmbedder).disposed, isTrue,
        reason: '换档后旧嵌入器应被释放');
  });

  test('创建失败后不重复尝试，直到模型切换', () async {
    var calls = 0;
    final container = ProviderContainer(overrides: [
      embedderFactoryProvider.overrideWithValue(
        (modelId) {
          calls++;
          throw StateError('create failed');
        },
      ),
    ]);
    addTearDown(container.dispose);
    final statusN = container.read(modelStatusProvider.notifier);
    final manager = container.read(embedderManagerProvider);

    statusN.finishDownload('bge-small-zh-v1.5');
    expect(await manager.ready(), isNull);
    expect(await manager.ready(), isNull);
    expect(calls, 1, reason: '失败后不应重复创建');

    // 模型切换后重置失败标记，允许重试
    statusN.finishDownload('bge-base-zh-v1.5');
    expect(await manager.ready(), isNull);
    expect(calls, 2);
  });
}