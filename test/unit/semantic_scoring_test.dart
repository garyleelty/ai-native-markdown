import 'dart:math';

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

  group('l2Normalize', () {
    test('非零向量归一化后 L2 范数为 1', () {
      final v = l2Normalize([3, 4]);
      final norm = sqrt(v[0] * v[0] + v[1] * v[1]);
      expect(norm, closeTo(1, 1e-9));
      expect(v, [closeTo(0.6, 1e-9), closeTo(0.8, 1e-9)]);
    });
    test('零向量原样返回', () {
      expect(l2Normalize([0, 0]), [0, 0]);
    });
    test('空列表不抛异常', () {
      expect(l2Normalize([]), isEmpty);
    });
    test('返回新列表，不共享调用方引用', () {
      final input = [0.0, 0.0];
      expect(l2Normalize(input), isNot(same(input)));
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
      );
      expect(s.tag, closeTo(0.5, 1e-9));
      expect(s.total, closeTo(0.1, 1e-9));
      expect(s.reason, contains('标签'));
    });

    test('标题关键词命中提升总分', () {
      final base = SemanticScoring.score(
        sourceVector: [1, 0, 0],
        targetVector: [0, 1, 0],
        sourceTags: [],
        targetTags: [],
        sourceContent: '',
        targetTitle: '',
      );
      final withTitle = SemanticScoring.score(
        sourceVector: [1, 0, 0],
        targetVector: [0, 1, 0],
        sourceTags: [],
        targetTags: [],
        sourceContent: 'Flutter 状态管理',
        targetTitle: 'Flutter 笔记',
      );
      expect(withTitle.title, greaterThan(0));
      expect(withTitle.total, greaterThan(base.total));
      expect(withTitle.reason, contains('标题关联'));
    });

    test('空向量或低于阈值返回低分', () {
      final s = SemanticScoring.score(
        sourceVector: [0, 0],
        targetVector: [0, 0],
        sourceTags: [],
        targetTags: [],
        sourceContent: 'x',
        targetTitle: 'y',
      );
      expect(s.total, lessThan(SemanticScoring.minThreshold));
    });
  });
}
