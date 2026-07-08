import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/features/quick_switcher/services/fuzzy_matcher.dart';

import '../helpers/test_helpers.dart';

void main() {
  group('FuzzyMatcher.match', () {
    test('空查询返回空列表', () {
      final List<NoteModel> notes = [
        createTestNote(id: 'a', title: 'Flutter 笔记'),
      ];
      final results = FuzzyMatcher.match('', notes);
      expect(results, isEmpty);
    });

    test('无匹配返回空列表', () {
      final notes = [
        createTestNote(id: 'a', title: 'Flutter', content: 'Flutter 指南'),
      ];
      final results = FuzzyMatcher.match('xyz', notes);
      expect(results, isEmpty);
    });

    test('大小写完全匹配的得分高于仅大小写不敏感匹配', () {
      final notes = [
        createTestNote(id: 'exact', title: 'Flutter', content: ''),
        createTestNote(id: 'lower', title: 'flutter', content: ''),
      ];
      final results = FuzzyMatcher.match('Flutter', notes);
      expect(results, hasLength(2));
      // 高分在前
      expect(results.first.noteId, 'exact');
      expect(results.last.noteId, 'lower');
      // 验证分数严格更高
      expect(results.first.score, greaterThan(results.last.score));
    });

    test('连续字符匹配的得分高于非连续匹配', () {
      final notes = [
        createTestNote(id: 'consecutive', title: 'abc', content: ''),
        createTestNote(id: 'scattered', title: 'axbxc', content: ''),
      ];
      final results = FuzzyMatcher.match('abc', notes);
      expect(results, hasLength(2));
      expect(results.first.noteId, 'consecutive');
      expect(results.last.noteId, 'scattered');
      expect(results.first.score, greaterThan(results.last.score));
    });

    test('标题匹配权重 ≥ 3 × 正文匹配权重', () {
      final notes = [
        createTestNote(
          id: 'title-hit',
          title: 'Flutter',
          content: '不相关的内容',
        ),
        createTestNote(
          id: 'body-hit',
          title: '其他标题',
          content: 'Flutter',
        ),
      ];
      final results = FuzzyMatcher.match('Flutter', notes);
      expect(results, hasLength(2));

      final titleScore =
          results.firstWhere((r) => r.noteId == 'title-hit').score;
      final bodyScore =
          results.firstWhere((r) => r.noteId == 'body-hit').score;

      expect(titleScore, greaterThanOrEqualTo(3 * bodyScore));
    });

    test('超过 50 条结果被截断为 50 条', () {
      final notes = List.generate(60, (i) {
        return createTestNote(
          id: 'note-$i',
          title: 'test-$i',
          content: 'test content',
        );
      });
      final results = FuzzyMatcher.match('test', notes);
      expect(results, hasLength(50));
    });
  });
}
