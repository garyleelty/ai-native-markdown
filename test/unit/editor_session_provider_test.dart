import 'package:aeromind/features/calendar/widgets/calendar_view.dart';
import 'package:aeromind/providers/editor_session_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EditorSessionProvider', () {
    late ProviderContainer container;

    setUp(() {
      container = ProviderContainer();
    });

    tearDown(() {
      container.dispose();
    });

    test('addToHistory 记录历史并在新增时清空重做栈', () {
      final notifier = container.read(editorSessionProvider.notifier);
      notifier.addToHistory('note-1', const TextEditingValue(text: 'a'));
      notifier.addToHistory('note-1', const TextEditingValue(text: 'ab'));
      // 模拟一次 undo 产生 redo 项
      notifier.undo('note-1', const TextEditingValue(text: 'abc'));
      expect(
        container.read(editorSessionProvider).get('note-1').redoStack.length,
        1,
      );
      // 新增历史应清空 redo
      notifier.addToHistory('note-1', const TextEditingValue(text: 'abcd'));
      expect(
        container.read(editorSessionProvider).get('note-1').redoStack,
        isEmpty,
      );
    });

    test('相同文本不重复入栈', () {
      final notifier = container.read(editorSessionProvider.notifier);
      notifier.addToHistory('note-1', const TextEditingValue(text: 'same'));
      notifier.addToHistory('note-1', const TextEditingValue(text: 'same'));
      expect(
        container.read(editorSessionProvider).get('note-1').undoStack.length,
        1,
      );
    });

    test('undo/redo 正确移动栈项', () {
      final notifier = container.read(editorSessionProvider.notifier);
      notifier.addToHistory('note-1', const TextEditingValue(text: 'a'));
      notifier.addToHistory('note-1', const TextEditingValue(text: 'ab'));

      final undone =
          notifier.undo('note-1', const TextEditingValue(text: 'abc'));
      expect(undone?.text, 'ab');

      final redone =
          notifier.redo('note-1', const TextEditingValue(text: 'abc'));
      expect(redone?.text, 'abc');
    });

    test('模拟编辑器：记录变更前的值，undo 可逐步回退（非首步无效）', () {
      final notifier = container.read(editorSessionProvider.notifier);
      // 与 NotePanel 一致：每次文本变更时记录「变更前」的值
      notifier.addToHistory('n', const TextEditingValue(text: '')); // 键入 'a' 前
      notifier.addToHistory('n', const TextEditingValue(text: 'a')); // 键入 'ab' 前
      // 当前内容 'ab'，第一次 undo 应回退到 'a'
      final u1 = notifier.undo('n', const TextEditingValue(text: 'ab'));
      expect(u1?.text, 'a');
      // 第二次 undo 应回退到 ''
      final u2 = notifier.undo('n', const TextEditingValue(text: 'a'));
      expect(u2?.text, '');
      // 第三次 undo 无更多历史
      final u3 = notifier.undo('n', const TextEditingValue(text: ''));
      expect(u3, isNull);
    });

    test('不同 noteId 的会话相互隔离', () {
      final notifier = container.read(editorSessionProvider.notifier);
      notifier.addToHistory('note-1', const TextEditingValue(text: 'a'));
      notifier.addToHistory('note-2', const TextEditingValue(text: 'b'));
      expect(
        container.read(editorSessionProvider).get('note-1').undoStack.length,
        1,
      );
      expect(
        container.read(editorSessionProvider).get('note-2').undoStack.length,
        1,
      );
    });

    test('搜索替换栏状态持久化', () {
      final notifier = container.read(editorSessionProvider.notifier);
      notifier.setShowSearchBar('note-1', true);
      notifier.setShowReplace('note-1', true);
      notifier.setSearchText('note-1', 'flutter');
      notifier.setReplaceText('note-1', 'dart');

      final session = container.read(editorSessionProvider).get('note-1');
      expect(session.showSearchBar, true);
      expect(session.showReplace, true);
      expect(session.searchText, 'flutter');
      expect(session.replaceText, 'dart');
    });

    test('removeSession 移除指定笔记的会话', () {
      final notifier = container.read(editorSessionProvider.notifier);
      notifier.addToHistory('note-1', const TextEditingValue(text: 'a'));
      notifier.removeSession('note-1');
      expect(
        container.read(editorSessionProvider).sessions.containsKey('note-1'),
        false,
      );
    });
  });

  group('calendarDisplayMonthProvider', () {
    test('初值为当前月份', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final now = DateTime.now();
      final initial = container.read(calendarDisplayMonthProvider);
      expect(initial.year, now.year);
      expect(initial.month, now.month);
    });

    test('可被修改为其他月份', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(calendarDisplayMonthProvider.notifier).state =
          DateTime(2024, 3);
      expect(
        container.read(calendarDisplayMonthProvider),
        DateTime(2024, 3),
      );
    });
  });
}
