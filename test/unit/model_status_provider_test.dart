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
}