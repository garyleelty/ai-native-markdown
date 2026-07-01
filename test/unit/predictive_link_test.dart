import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/core/models/predictive_link.dart';

void main() {
  group('PredictiveLinkService', () {
    test('空内容返回空推荐', () {
      final results = PredictiveLinkService.recommend(
        currentNoteId: 'note-1',
        currentContent: '',
        currentTags: [],
        allNotes: [],
      );
      expect(results, isEmpty);
    });

    test('无其他笔记返回空推荐', () {
      final results = PredictiveLinkService.recommend(
        currentNoteId: 'note-1',
        currentContent: 'Flutter 开发',
        currentTags: [],
        allNotes: [],
      );
      expect(results, isEmpty);
    });

    test('内容相似的笔记获得推荐', () {
      final results = PredictiveLinkService.recommend(
        currentNoteId: 'note-1',
        currentContent:
            'Flutter 是一个跨平台 UI 框架，使用 Dart 语言开发移动应用',
        currentTags: ['技术'],
        allNotes: [
          const NoteInfoForLink(
            id: 'note-2',
            title: 'Dart 语言特性',
            content: 'Dart 是 Flutter 使用的编程语言，支持异步编程',
            tags: ['技术'],
          ),
          const NoteInfoForLink(
            id: 'note-3',
            title: '做饭食谱',
            content: '红烧肉的做法，需要五花肉和酱油',
            tags: ['生活'],
          ),
        ],
      );

      // Flutter/Dart 相关笔记应该获得推荐
      expect(results, isNotEmpty);
      expect(results.first.targetNoteId, 'note-2');
    });

    test('排除自身笔记', () {
      final results = PredictiveLinkService.recommend(
        currentNoteId: 'note-1',
        currentContent: 'Flutter 开发笔记',
        currentTags: [],
        allNotes: [
          const NoteInfoForLink(
            id: 'note-1',
            title: 'Flutter 开发笔记',
            content: 'Flutter 开发笔记',
          ),
        ],
      );
      expect(results, isEmpty);
    });

    test('共同标签提升推荐分数', () {
      final results = PredictiveLinkService.recommend(
        currentNoteId: 'note-1',
        currentContent: '关于项目管理的一些想法和方法论',
        currentTags: ['管理', '方法论'],
        allNotes: [
          const NoteInfoForLink(
            id: 'note-2',
            title: '敏捷开发方法论',
            content: '关于项目管理的一些方法论和实践',
            tags: ['管理', '方法论'],
          ),
          const NoteInfoForLink(
            id: 'note-3',
            title: '烹饪技巧',
            content: '关于烹饪的一些想法',
            tags: ['生活'],
          ),
        ],
      );

      expect(results, isNotEmpty);
      // 共同标签的笔记应该排名更高
      expect(results.first.targetNoteId, 'note-2');
    });

    test('推荐数量限制 maxResults', () {
      final allNotes = List.generate(
        20,
        (i) => NoteInfoForLink(
          id: 'note-$i',
          title: '笔记 $i',
          content: 'Flutter Dart 开发 移动应用 跨平台',
        ),
      );

      final results = PredictiveLinkService.recommend(
        currentNoteId: 'note-source',
        currentContent: 'Flutter 移动开发',
        currentTags: [],
        allNotes: allNotes,
        maxResults: 3,
      );

      expect(results.length, lessThanOrEqualTo(3));
    });
  });
}
