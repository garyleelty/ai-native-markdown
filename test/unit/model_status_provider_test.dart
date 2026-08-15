import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/features/semantic_engine/providers/model_status_provider.dart';

void main() {
  test('初始为 notEnabled', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(container.read(modelStatusProvider).status, SemanticEngineStatus.notEnabled);
  });

  test('enable 后进入 idle（未下载）', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(modelStatusProvider.notifier).enable();
    expect(container.read(modelStatusProvider).status, SemanticEngineStatus.idle);
  });

  test('disable 回到 notEnabled', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final n = container.read(modelStatusProvider.notifier);
    n.enable();
    n.disable();
    expect(container.read(modelStatusProvider).status, SemanticEngineStatus.notEnabled);
  });

  test('下载成功：downloading → 进度更新 → ready', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final n = container.read(modelStatusProvider.notifier);
    n.enable();
    n.startDownload();
    var s = container.read(modelStatusProvider);
    expect(s.status, SemanticEngineStatus.downloading);
    expect(s.progress, 0);
    expect(s.error, isNull);

    n.updateDownloadProgress(0.5);
    expect(container.read(modelStatusProvider).progress, 0.5);

    n.finishDownload('m');
    s = container.read(modelStatusProvider);
    expect(s.status, SemanticEngineStatus.ready);
    expect(s.progress, 1);
    expect(s.currentModelId, 'm');
  });

  test('fail 进入 error', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final n = container.read(modelStatusProvider.notifier);
    n.enable();
    n.fail('boom');
    final s = container.read(modelStatusProvider);
    expect(s.status, SemanticEngineStatus.error);
    expect(s.error, 'boom');
  });

  test('失败后重试会清除 error', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final n = container.read(modelStatusProvider.notifier);
    n.enable();
    n.fail('boom');
    n.startDownload();
    final s = container.read(modelStatusProvider);
    expect(s.status, SemanticEngineStatus.downloading);
    expect(s.error, isNull);
  });

  test('重建索引周期：reindexing → ready', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final n = container.read(modelStatusProvider.notifier);
    n.enable();
    n.startReindex();
    expect(container.read(modelStatusProvider).status, SemanticEngineStatus.reindexing);

    n.finishReindex('m');
    final s = container.read(modelStatusProvider);
    expect(s.status, SemanticEngineStatus.ready);
    expect(s.currentModelId, 'm');
  });

  test('clearError 回到 idle 并清除 error', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final n = container.read(modelStatusProvider.notifier);
    n.enable();
    n.fail('boom');
    n.clearError();
    final s = container.read(modelStatusProvider);
    expect(s.status, SemanticEngineStatus.idle);
    expect(s.error, isNull);
  });
}