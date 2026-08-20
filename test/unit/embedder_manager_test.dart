/// ══════════════════════════════════════════════════
/// EmbedderManager 生产接线测试
/// ══════════════════════════════════════════════════
/// 生产环境 embedderProvider 委托 EmbedderManager：未就绪时回退 null，
/// 模型文件不可加载（测试环境 path_provider 不可用）时静默降级不崩溃。

library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:aeromind/features/semantic_engine/providers/embedder_manager_provider.dart';
import 'package:aeromind/features/semantic_engine/providers/model_status_provider.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';

void main() {
  test('未启用语义引擎时 embedderProvider 为 null（回退模式）', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(container.read(embedderProvider), isNull);
    expect(container.read(embedderManagerProvider), isNull);
  });

  test('生产接线：模型就绪但无法加载模型文件时回退 null（不崩溃）', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.read(modelStatusProvider.notifier).finishDownload('bge-small-zh-v1.5');

    // 测试环境 path_provider 不可用 → 捕获异常回退 null
    final embedder = await container
        .read(embedderManagerProvider.notifier)
        .ready();
    expect(embedder, isNull);
    expect(container.read(embedderProvider), isNull);
  });

  test('关闭语义引擎后嵌入器回退 null', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.read(modelStatusProvider.notifier).finishDownload('bge-small-zh-v1.5');
    await container.read(embedderManagerProvider.notifier).ready();

    container.read(modelStatusProvider.notifier).disable();
    expect(container.read(embedderManagerProvider), isNull);
    expect(container.read(embedderProvider), isNull);
  });
}