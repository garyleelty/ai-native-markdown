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
    test('URL 指向正确路径', () {
      expect(ModelTier.light.onnxUrl, contains('bge-small-zh-v1.5'));
      expect(ModelTier.light.vocabUrl, endsWith('vocab.txt'));
      expect(ModelTier.base.onnxUrl, contains('bge-base-zh-v1.5'));
      expect(ModelTier.base.vocabUrl, endsWith('vocab.txt'));
    });
    test('数据锁定：id/维度/大小/URL/hash 全量固定', () {
      expect(ModelTier.light.id, 'bge-small-zh-v1.5');
      expect(ModelTier.base.id, 'bge-base-zh-v1.5');
      expect(ModelTier.light.dims, 512);
      expect(ModelTier.base.dims, 768);
      expect(ModelTier.light.sizeLabel, '~95MB fp32（可换 int8 ~25MB）');
      expect(ModelTier.base.sizeLabel, '~180MB fp32');
      expect(ModelTier.light.onnxUrl,
          'https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/main/onnx/model.onnx');
      expect(ModelTier.light.vocabUrl,
          'https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/main/vocab.txt');
      expect(ModelTier.base.onnxUrl,
          'https://huggingface.co/Xenova/bge-base-zh-v1.5/resolve/main/onnx/model.onnx');
      expect(ModelTier.base.vocabUrl,
          'https://huggingface.co/Xenova/bge-base-zh-v1.5/resolve/main/vocab.txt');
      expect(
        ModelTier.light.expectedHash,
        '69a0b846f4f116b5e6aabf9546ea6754d02264f3211a13a1bd69b31b8040749a',
      );
      expect(ModelTier.base.expectedHash, isNull);
    });
  });
}
