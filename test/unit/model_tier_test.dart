import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/semantic_engine/models/model_tier.dart';

void main() {
  group('ModelTier', () {
    test('两档配置有效', () {
      expect(ModelTier.values.length, 2);
      expect(ModelTier.light.dims, greaterThan(0));
      expect(ModelTier.base.dims, greaterThan(ModelTier.light.dims));
    });
    test('byId 查找', () {
      expect(ModelTier.byId(ModelTier.light.id), ModelTier.light);
      expect(ModelTier.byId(ModelTier.base.id), ModelTier.base);
    });
    test('URL 指向可达资源', () {
      expect(ModelTier.light.onnxUrl, contains('bge-small-zh-v1.5'));
      expect(ModelTier.light.vocabUrl, endsWith('vocab.txt'));
    });
  });
}
