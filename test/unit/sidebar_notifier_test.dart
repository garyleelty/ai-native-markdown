import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/features/sidebar/models/sidebar_state.dart';
import 'package:aeromind/providers/note_provider.dart';
import 'package:aeromind/providers/pane_provider.dart';
import 'package:aeromind/providers/sidebar_provider.dart';
import '../helpers/test_helpers.dart';

void main() {
  group('SidebarNotifier', () {
    late InMemoryNoteRepository repo;

    ProviderContainer createContainer() {
      repo = InMemoryNoteRepository();
      return ProviderContainer(
        overrides: [
          noteRepositoryProvider.overrideWithValue(repo),
        ],
      );
    }

    test('showOutline 在有当前活动笔记时自动加载大纲', () async {
      final container = createContainer();
      addTearDown(container.dispose);

      const noteId = 'note-with-headings';
      final note = NoteModel(
        id: noteId,
        title: '大纲测试',
        rawMarkdown: '# 一级标题\n\n正文\n\n## 二级标题\n\n内容',
        filePath: '',
        createdAt: DateTime(2024, 1, 1),
        updatedAt: DateTime(2024, 1, 1),
      );
      await repo.saveNote(note);

      // 模拟当前面板中打开了该笔记
      container.read(paneStackProvider.notifier).openPane(noteId, note.title);

      // 切换到大纲视图
      container.read(sidebarProvider.notifier).showOutline();

      // 等待异步加载完成
      await Future<void>.delayed(Duration.zero);

      final state = container.read(sidebarProvider);
      expect(state.currentView, SidebarView.outline);
      expect(state.outlineHeadings, isNotEmpty);
      expect(state.outlineHeadings.length, 2);
      expect(state.outlineHeadings.first.title, '一级标题');
      expect(state.outlineHeadings.first.level, 1);
      expect(state.outlineHeadings[1].title, '二级标题');
      expect(state.outlineHeadings[1].level, 2);
    });

    test('showOutline 在无活动笔记时保持空大纲', () async {
      final container = createContainer();
      addTearDown(container.dispose);

      container.read(sidebarProvider.notifier).showOutline();
      await Future<void>.delayed(Duration.zero);

      final state = container.read(sidebarProvider);
      expect(state.currentView, SidebarView.outline);
      expect(state.outlineHeadings, isEmpty);
    });
  });
}
