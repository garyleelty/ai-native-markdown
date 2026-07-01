import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/sidebar/models/sidebar_state.dart';

void main() {
  group('SidebarState', () {
    test('默认状态正确', () {
      const state = SidebarState();

      expect(state.currentView, SidebarView.noteTree);
      expect(state.isExpanded, true);
      expect(state.width, 240);
      expect(state.noteTree, isEmpty);
      expect(state.searchQuery, '');
      expect(state.searchResults, isEmpty);
      expect(state.isSearching, false);
      expect(state.tagCounts, isEmpty);
      expect(state.selectedTag, isNull);
      expect(state.selectedNoteId, isNull);
    });

    test('copyWith 创建修改后的副本', () {
      const state = SidebarState();
      final modified = state.copyWith(
        isExpanded: false,
        width: 300,
        searchQuery: '测试',
      );

      expect(modified.isExpanded, false);
      expect(modified.width, 300);
      expect(modified.searchQuery, '测试');
      // 未修改的字段保持原值
      expect(modified.currentView, SidebarView.noteTree);
    });

    test('copyWith clearSelectedTag 清除选中标签', () {
      final state = const SidebarState(selectedTag: 'flutter');
      expect(state.selectedTag, 'flutter');

      final cleared = state.copyWith(clearSelectedTag: true);
      expect(cleared.selectedTag, isNull);
    });

    test('copyWith clearSelectedNoteId 清除选中笔记', () {
      final state = const SidebarState(selectedNoteId: 'note-1');
      expect(state.selectedNoteId, 'note-1');

      final cleared = state.copyWith(clearSelectedNoteId: true);
      expect(cleared.selectedNoteId, isNull);
    });
  });

  group('NoteTreeNode', () {
    test('默认值正确', () {
      const node = NoteTreeNode(
        id: '1',
        title: '测试笔记',
      );

      expect(node.id, '1');
      expect(node.title, '测试笔记');
      expect(node.path, '');
      expect(node.isFolder, false);
      expect(node.children, isEmpty);
      expect(node.isExpanded, false);
    });

    test('copyWith 正确修改字段', () {
      const node = NoteTreeNode(
        id: '1',
        title: '文件夹',
        isFolder: true,
      );

      final expanded = node.copyWith(isExpanded: true);
      expect(expanded.isExpanded, true);
      expect(expanded.id, '1'); // 保持原值
      expect(expanded.isFolder, true); // 保持原值
    });

    test('支持嵌套子节点', () {
      const child1 = NoteTreeNode(id: '2', title: '子笔记1');
      const child2 = NoteTreeNode(id: '3', title: '子笔记2');
      const parent = NoteTreeNode(
        id: '1',
        title: '文件夹',
        isFolder: true,
        children: [child1, child2],
      );

      expect(parent.children.length, 2);
      expect(parent.children[0].title, '子笔记1');
    });
  });
}
