import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/editor/services/editor_service.dart';

void main() {
  group('EditorService', () {
    group('computeStats', () {
      test('空文本返回零统计', () {
        final stats = EditorService.computeStats('');
        expect(stats.charCount, 0);
        expect(stats.wordCount, 0);
        expect(stats.lineCount, 1);
      });

      test('中文文本正确计算字数', () {
        final stats = EditorService.computeStats('你好世界这是测试');
        expect(stats.wordCount, 8); // 每个中文字算一个词
        expect(stats.charCount, 8);
      });

      test('英文文本正确计算词数', () {
        final stats = EditorService.computeStats('hello world test');
        expect(stats.wordCount, 3);
      });

      test('混合中英文正确计算', () {
        final stats = EditorService.computeStats('Hello 你好 world 世界');
        // 中文4字 + 英文2词 = 6
        expect(stats.wordCount, 6);
      });

      test('Markdown 标题不影响统计', () {
        final stats = EditorService.computeStats('# 标题\n\n正文内容');
        expect(stats.lineCount, 3);
        expect(stats.paragraphCount, 2);
      });

      test('阅读时间至少 1 分钟', () {
        final stats = EditorService.computeStats('短');
        expect(stats.readingTimeMinutes, 1);
      });

      test('长文阅读时间合理', () {
        final longText = List.generate(400, (_) => '测试').join(' ');
        final stats = EditorService.computeStats(longText);
        expect(stats.readingTimeMinutes, greaterThan(1));
      });
    });

    group('Markdown 快捷操作', () {
      test('bold 包裹粗体标记', () {
        expect(EditorService.bold('text'), '**text**');
      });

      test('italic 包裹斜体标记', () {
        expect(EditorService.italic('text'), '*text*');
      });

      test('inlineCode 包裹行内代码标记', () {
        expect(EditorService.inlineCode('code'), '`code`');
      });

      test('codeBlock 生成代码块', () {
        final result = EditorService.codeBlock('print("hello")', language: 'dart');
        expect(result, contains('```dart'));
        expect(result, contains('print("hello")'));
      });

      test('wikiLink 生成 wiki 链接', () {
        expect(EditorService.wikiLink('笔记名'), '[[笔记名]]');
      });

      test('externalLink 生成标准链接', () {
        expect(
          EditorService.externalLink('点击', 'https://example.com'),
          '[点击](https://example.com)',
        );
      });

      test('blockquote 为每行添加引用标记', () {
        final result = EditorService.blockquote('第一行\n第二行');
        expect(result, '> 第一行\n> 第二行');
      });

      test('taskItem 生成任务项', () {
        expect(EditorService.taskItem('买菜'), '- [ ] 买菜');
        expect(EditorService.taskItem('买菜', checked: true), '- [x] 买菜');
      });

      test('heading 生成指定级别标题', () {
        expect(EditorService.heading('标题', level: 1), '# 标题');
        expect(EditorService.heading('标题', level: 3), '### 标题');
      });
    });

    group('extractHeadings', () {
      test('提取所有标题', () {
        const md = '''
# 一级标题
正文
## 二级标题
### 三级标题
''';
        final headings = EditorService.extractHeadings(md);
        expect(headings.length, 3);
        expect(headings[0].level, 1);
        expect(headings[0].title, '一级标题');
        expect(headings[1].level, 2);
        expect(headings[2].level, 3);
      });

      test('无标题时返回空列表', () {
        final headings = EditorService.extractHeadings('纯文本内容');
        expect(headings, isEmpty);
      });
    });

    group('extractLinks', () {
      test('提取 wiki 链接', () {
        const md = '参见 [[笔记A]] 和 [[笔记B]]';
        final links = EditorService.extractLinks(md);
        expect(links.length, 2);
        expect(links[0].isWikiLink, true);
        expect(links[0].text, '笔记A');
        expect(links[1].text, '笔记B');
      });

      test('提取标准链接', () {
        const md = '访问 [Google](https://google.com)';
        final links = EditorService.extractLinks(md);
        expect(links.length, 1);
        expect(links[0].isWikiLink, false);
        expect(links[0].text, 'Google');
        expect(links[0].url, 'https://google.com');
      });

      test('混合链接正确提取', () {
        const md = '[[内部笔记]] 和 [外部](https://example.com)';
        final links = EditorService.extractLinks(md);
        expect(links.length, 2);
        expect(links[0].isWikiLink, true);
        expect(links[1].isWikiLink, false);
      });
    });
  });

  group('AutoSaveManager', () {
    test('hasPending 初始为 false', () {
      final manager = AutoSaveManager();
      expect(manager.hasPending, false);
      manager.dispose();
    });

    test('trigger 后 hasPending 为 true', () {
      final manager = AutoSaveManager(delay: const Duration(seconds: 10));
      manager.trigger(() async {});
      expect(manager.hasPending, true);
      manager.dispose();
    });

    test('cancel 后 hasPending 为 false', () {
      final manager = AutoSaveManager(delay: const Duration(seconds: 10));
      manager.trigger(() async {});
      manager.cancel();
      expect(manager.hasPending, false);
      manager.dispose();
    });
  });
}
