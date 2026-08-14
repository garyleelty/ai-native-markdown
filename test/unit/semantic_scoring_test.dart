import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/semantic_engine/services/semantic_scoring.dart';

void main() {
  group('cosineSimilarity', () {
    test('相同向量为 1', () {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3]), closeTo(1, 1e-6));
    });
    test('正交向量为 0', () {
      expect(cosineSimilarity([1, 0], [0, 1]), closeTo(0, 1e-6));
    });
    test('维度不一致返回 0', () {
      expect(cosineSimilarity([1, 0], [1]), 0);
    });
    test('零向量返回 0', () {
      expect(cosineSimilarity([0, 0], [1, 1]), 0);
    });
  });

  group('SemanticScoring.score', () {
    test('语义相关权重主导', () {
      final s = SemanticScoring.score(
        sourceVector: [1, 0, 0],
        targetVector: [0.99, 0.01, 0.01],
        sourceTags: [],
        targetTags: [],
        sourceContent: 'Flutter 开发',
        targetTitle: '无关标题',
        targetContent: '无',
      );
      expect(s.total, closeTo(0.7, 0.01));
      expect(s.reason, contains('语义'));
    });

    test('共同标签叠加', () {
      final s = SemanticScoring.score(
        sourceVector: [1, 0, 0],
        targetVector: [0, 1, 0],
        sourceTags: ['技术', 'Flutter'],
        targetTags: ['技术'],
        sourceContent: '',
        targetTitle: '',
        targetContent: '',
      );
      expect(s.total, greaterThan(0));
      expect(s.reason, contains('标签'));
    });

    test('空向量或低于阈值返回低分', () {
      final s = SemanticScoring.score(
        sourceVector: [0, 0],
        targetVector: [0, 0],
        sourceTags: [],
        targetTags: [],
        sourceContent: 'x',
        targetTitle: 'y',
        targetContent: 'z',
      );
      expect(s.total, lessThan(SemanticScoring.minThreshold));
    });
  });
}
