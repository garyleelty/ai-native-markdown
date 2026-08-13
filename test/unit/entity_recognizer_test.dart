import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/ai_engine/services/entity_recognizer.dart';
import 'package:aeromind/core/models/note_model.dart';

void main() {
  group('EntityRecognizer', () {
    late EntityRecognizer recognizer;

    setUp(() {
      recognizer = EntityRecognizer(strategy: RecognitionStrategy.local);
    });

    tearDown(() {
      recognizer.dispose();
    });

    test('识别 [[wiki links]] 为 reference 实体', () async {
      final result = await recognizer.recognize('参见 [[Flutter笔记]] 和 [[Dart指南]]');
      final entities = result.entities;

      expect(entities.length, 2);
      expect(entities[0].type, EntityType.reference);
      expect(entities[0].label, 'Flutter笔记');
      expect(entities[1].type, EntityType.reference);
      expect(entities[1].label, 'Dart指南');
    });

    test('识别 > 引文为 quote 实体', () async {
      final result = await recognizer.recognize('> 这是一段引文\n> 第二行引文');
      final entities = result.entities;

      expect(entities.length, 2);
      expect(entities[0].type, EntityType.quote);
      expect(entities[0].label, '这是一段引文');
    });

    test('识别 @人名 为 person 实体', () async {
      final result = await recognizer.recognize('讨论 @张三 和 @Alice 的方案');
      final entities = result.entities;

      expect(entities.length, 2);
      expect(entities[0].type, EntityType.person);
      expect(entities[0].label, '张三');
      expect(entities[1].type, EntityType.person);
      expect(entities[1].label, 'Alice');
    });

    test('识别 #标签 为 concept 实体', () async {
      final result = await recognizer.recognize('使用 #flutter 和 #dart 进行开发');
      final entities = result.entities;

      expect(entities.length, 2);
      expect(entities[0].type, EntityType.concept);
      expect(entities[0].label, 'flutter');
      expect(entities[1].type, EntityType.concept);
      expect(entities[1].label, 'dart');
    });

    test('识别 - [ ] 任务 为 task 实体', () async {
      final result = await recognizer.recognize('- [ ] 完成项目\n- [x] 已完成的任务');
      final entities = result.entities;

      expect(entities.length, 2);
      expect(entities[0].type, EntityType.task);
      expect(entities[0].label, '完成项目');
      expect(entities[1].type, EntityType.task);
      expect(entities[1].label, '已完成的任务');
    });

    test('识别数学公式为 concept 实体', () async {
      final result = await recognizer.recognize(r'公式 $E=mc^2$ 很重要');
      final entities = result.entities;

      expect(entities.length, 1);
      expect(entities[0].type, EntityType.concept);
      expect(entities[0].label, r'E=mc^2');
    });

    test('识别日期时间戳为 concept 实体', () async {
      final result = await recognizer.recognize('创建于 2024-06-15 的笔记');
      final entities = result.entities;

      expect(entities.length, 1);
      expect(entities[0].type, EntityType.concept);
      expect(entities[0].label, '2024-06-15');
    });

    test('空文本返回空列表', () async {
      final result = await recognizer.recognize('');
      expect(result.entities, isEmpty);
    });

    test('纯文本无特殊标记返回空列表', () async {
      final result = await recognizer.recognize('这是一段普通文本没有任何标记');
      expect(result.entities, isEmpty);
    });

    test('混合内容正确识别多种实体', () async {
      const md = '''
# 标题

参见 [[Flutter笔记]]

> 引用内容

@张三 的任务
- [ ] 待办事项
#flutter
''';
      final result = await recognizer.recognize(md);
      final entities = result.entities;

      // 应该有 reference, quote, person, task, concept 多种类型
      final types = entities.map((e) => e.type).toSet();
      expect(types.contains(EntityType.reference), true);
      expect(types.contains(EntityType.quote), true);
      expect(types.contains(EntityType.person), true);
      expect(types.contains(EntityType.task), true);
      expect(types.contains(EntityType.concept), true);
    });

    test('实体偏移量在文本范围内', () async {
      const text = '参见 [[Flutter]] 和 #dart 标签';
      final result = await recognizer.recognize(text);

      for (final entity in result.entities) {
        expect(entity.startOffset, greaterThanOrEqualTo(0));
        expect(entity.endOffset, lessThanOrEqualTo(text.length));
        expect(entity.endOffset, greaterThan(entity.startOffset));
      }
    });

    test('处理时间有记录', () async {
      final result = await recognizer.recognize('简单测试');
      expect(result.processingTime, isNotNull);
      expect(result.processingTime.inMicroseconds, greaterThanOrEqualTo(0));
    });

    test('远程策略无配置时回退到本地', () async {
      final remoteRecognizer = EntityRecognizer(
        strategy: RecognitionStrategy.remote,
      );

      final result = await remoteRecognizer.recognize('[[测试链接]]');
      // 无 LLM 配置应回退到本地识别
      expect(result.entities, isNotEmpty);
      expect(result.entities[0].type, EntityType.reference);

      remoteRecognizer.dispose();
    });

    test('debounceRecognize 延迟触发回调', () async {
      var callbackCount = 0;
      List<EntityHighlight>? receivedEntities;

      recognizer.debounceRecognize(
        '[[测试]]',
        (result) {
          callbackCount++;
          receivedEntities = result.entities;
        },
        delay: const Duration(milliseconds: 100),
      );

      // 立即检查：还未触发
      expect(callbackCount, 0);

      // 等待 debounce 完成
      await Future<void>.delayed(const Duration(milliseconds: 200));

      expect(callbackCount, 1);
      expect(receivedEntities, isNotNull);
      expect(receivedEntities!.isNotEmpty, true);
    });
  });
}
