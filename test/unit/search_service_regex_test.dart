import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/core/services/search_service.dart';

/// 构造测试用 NoteModel（不 mock，使用真实数据模型）
NoteModel _makeNote({
  required String id,
  required String title,
  required String content,
  String folderPath = '',
  List<String> tags = const [],
}) {
  return NoteModel(
    id: id,
    title: title,
    rawMarkdown: content,
    filePath: '/test/$id.md',
    createdAt: DateTime(2024, 1, 1),
    updatedAt: DateTime(2024, 6, 1),
    tags: tags,
    folderPath: folderPath,
  );
}

void main() {
  group('SearchService.parseQuery - path 过滤', () {
    test('path: 前缀设置 pathFilter 并保留关键词', () {
      final parsed = SearchService.parseQuery('path:projects flu');
      expect(parsed.pathFilter, 'projects');
      expect(parsed.isRegex, isFalse);
      expect(parsed.keywords, contains('flu'));
    });

    test('p: 简写等价于 path:', () {
      final parsed = SearchService.parseQuery('p:docs hello');
      expect(parsed.pathFilter, 'docs');
      expect(parsed.keywords, contains('hello'));
    });
  });

  group('SearchService.parseQuery - 正则模式', () {
    test('整个 query 被 /.../ 包裹时进入正则模式', () {
      final parsed = SearchService.parseQuery(r'/foo\d+/');
      expect(parsed.isRegex, isTrue);
      expect(parsed.regexPattern, r'foo\d+');
      expect(parsed.keywords, isEmpty);
    });

    test('query 不以 / 开头时不进入正则模式', () {
      final parsed = SearchService.parseQuery(r'path:projects /foo\d+/');
      expect(parsed.isRegex, isFalse);
      expect(parsed.pathFilter, 'projects');
    });

    test('非法正则 /[/ 仍被识别为正则模式（group(1) 为 [）', () {
      // 验证 /[/ 整体匹配 /.../ 包裹格式
      final m = RegExp(r'^/(.+)/$').firstMatch('/[/');
      expect(m, isNotNull);
      expect(m!.group(1), '[');
      // parseQuery 进入正则模式
      final parsed = SearchService.parseQuery('/[/');
      expect(parsed.isRegex, isTrue);
      expect(parsed.regexPattern, '[');
    });
  });

  group('SearchService.searchNotes - path 过滤', () {
    test('path: 仅在匹配 folderPath 的笔记中搜索关键词', () {
      final noteA = _makeNote(
        id: 'a',
        title: 'Flutter Note',
        content: 'flu content',
        folderPath: 'projects/app',
      );
      final noteB = _makeNote(
        id: 'b',
        title: 'Other Note',
        content: 'flu content',
        folderPath: 'docs',
      );
      final response = SearchService.searchNotes(
        [noteA, noteB],
        'path:projects flu',
      );
      // 即使 B 也包含 'flu'，但 folderPath 不含 'projects'，被过滤掉
      expect(response.results.map((r) => r.note.id).toList(), ['a']);
      expect(response.message, isNull);
    });

    test('p: 简写等价于 path:', () {
      final noteA = _makeNote(
        id: 'a',
        title: 'Hello',
        content: 'hello world',
        folderPath: 'projects/app',
      );
      final noteB = _makeNote(
        id: 'b',
        title: 'Hello',
        content: 'hello world',
        folderPath: 'docs',
      );
      final response = SearchService.searchNotes(
        [noteA, noteB],
        'p:docs hello',
      );
      expect(response.results.map((r) => r.note.id).toList(), ['b']);
      expect(response.message, isNull);
    });

    test('空 folderPath 不匹配非空 pathFilter', () {
      final note = _makeNote(
        id: 'a',
        title: 'Note',
        content: 'flu',
        folderPath: '',
      );
      final response = SearchService.searchNotes(
        [note],
        'path:projects flu',
      );
      expect(response.results, isEmpty);
      expect(response.message, isNull);
    });
  });

  group('SearchService.searchNotes - 正则搜索', () {
    test('/foo\\d+/ 匹配 foo123 不匹配 foobar', () {
      final noteA = _makeNote(
        id: 'a',
        title: 'Note A',
        content: 'foo123 bar',
      );
      final noteB = _makeNote(
        id: 'b',
        title: 'Note B',
        content: 'foobar baz',
      );
      final response = SearchService.searchNotes(
        [noteA, noteB],
        r'/foo\d+/',
      );
      expect(response.results.map((r) => r.note.id).toList(), ['a']);
      expect(response.message, isNull);

      // 验证 matches 字段含所有 RegExpMatch 位置
      final aResult = response.results.firstWhere((r) => r.note.id == 'a');
      expect(aResult.matches, isNotEmpty);
      final contentMatch = aResult.matches.firstWhere(
        (SearchMatch m) => m.field == 'content',
      );
      expect(
        noteA.rawMarkdown.substring(contentMatch.start, contentMatch.end),
        'foo123',
      );
    });

    test('非法正则降级为字面量搜索并返回警告信息', () {
      // 先验证 [ 确实是非法正则（会被 RegExp 拒绝）
      // ignore: valid_regexps
      expect(() => RegExp('['), throwsFormatException);

      // 验证 /[/ 整体匹配 /.../ 包裹格式且 group(1)='['
      final m = RegExp(r'^/(.+)/$').firstMatch('/[/');
      expect(m, isNotNull);
      expect(m!.group(1), '[');

      // searchNotes 不抛异常，降级为字面量搜索 '['
      final note = _makeNote(
        id: 'a',
        title: 'Note',
        content: 'array[0] element',
      );
      final response = SearchService.searchNotes([note], '/[/');
      expect(response.results, isNotEmpty);
      expect(response.results.first.note.id, 'a');
      expect(response.message, '正则语法无效，已降级为普通搜索');

      // 验证匹配位置确实对应字面量 '['
      final match = response.results.first.matches
          .firstWhere((SearchMatch m) => m.field == 'content');
      expect(note.rawMarkdown.substring(match.start, match.end), '[');
    });

    test('path: + 正则不组合（正则模式必须独占整个 query）', () {
      final noteA = _makeNote(
        id: 'a',
        title: 'foo123',
        content: 'foo123',
        folderPath: 'projects/app',
      );
      final parsed = SearchService.parseQuery(r'path:projects /foo\d+/');
      // 不进入正则模式
      expect(parsed.isRegex, isFalse);
      expect(parsed.pathFilter, 'projects');
      // /foo\d+/ 被当作普通 keyword 处理（不触发正则匹配）
      expect(parsed.keywords.any((k) => k.contains(r'foo\d+')), isTrue);

      // searchNotes 不会按正则匹配 foo123（因为是普通 keyword 子串搜索）
      // 'foo123' 不包含字面子串 '/foo\d+/'，因此不匹配
      final response = SearchService.searchNotes(
        [noteA],
        r'path:projects /foo\d+/',
      );
      expect(response.results, isEmpty);
      expect(response.message, isNull);
    });
  });

  group('SearchService.searchNotes - 向后兼容', () {
    test('title: 前缀仍正常工作', () {
      final note = _makeNote(
        id: 'a',
        title: 'Flutter Guide',
        content: 'dart code',
      );
      final response = SearchService.searchNotes([note], 'title:Flutter');
      expect(response.results, isNotEmpty);
      expect(response.results.first.note.id, 'a');
      expect(response.message, isNull);
    });

    test('content: 前缀仍正常工作', () {
      final note = _makeNote(
        id: 'a',
        title: 'Guide',
        content: 'dart code here',
      );
      final response = SearchService.searchNotes([note], 'content:dart');
      expect(response.results, isNotEmpty);
      expect(response.results.first.note.id, 'a');
      expect(response.message, isNull);
    });

    test('tag: 前缀仍正常工作', () {
      final note = _makeNote(
        id: 'a',
        title: 'Guide',
        content: 'content',
        tags: ['dev'],
      );
      final response = SearchService.searchNotes([note], 'tag:dev');
      expect(response.results, isNotEmpty);
      expect(response.results.first.note.id, 'a');
      expect(response.message, isNull);
    });
  });
}
