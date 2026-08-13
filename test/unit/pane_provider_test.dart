import 'package:aeromind/features/sliding_panes/models/pane_state.dart';
import 'package:aeromind/providers/pane_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PaneStackNotifier 编辑器模式持久化', () {
    late ProviderContainer container;

    setUp(() {
      container = ProviderContainer();
    });

    tearDown(() {
      container.dispose();
    });

    test('打开面板后默认编辑器模式为 source', () {
      final notifier = container.read(paneStackProvider.notifier);
      notifier.openPane('note-1', '笔记1');

      final state = container.read(paneStackProvider);
      expect(state.panes.first.editorMode, EditorMode.source);
    });

    test('setPaneEditorMode 能更新指定面板的编辑器模式', () {
      final notifier = container.read(paneStackProvider.notifier);
      notifier.openPane('note-1', '笔记1');
      notifier.setPaneEditorMode(0, EditorMode.livePreview);

      final state = container.read(paneStackProvider);
      expect(state.panes.first.editorMode, EditorMode.livePreview);
    });

    test('setPaneEditorModeByNoteId 能按 noteId 更新编辑器模式', () {
      final notifier = container.read(paneStackProvider.notifier);
      notifier.openPane('note-1', '笔记1');
      notifier.openPane('note-2', '笔记2');
      notifier.setPaneEditorModeByNoteId('note-2', EditorMode.preview);

      final state = container.read(paneStackProvider);
      final note2Pane = state.panes.firstWhere((p) => p.noteId == 'note-2');
      expect(note2Pane.editorMode, EditorMode.preview);
    });

    test('面板堆叠后恢复时编辑器模式保持不变', () {
      final notifier = container.read(paneStackProvider.notifier);
      // 打开 3 个面板，触发最多 2 个可见面板限制
      notifier.openPane('note-1', '笔记1');
      notifier.openPane('note-2', '笔记2');
      notifier.openPane('note-3', '笔记3');

      // 把 note-1 设为阅读模式
      notifier.setPaneEditorModeByNoteId('note-1', EditorMode.preview);
      expect(
        container.read(paneStackProvider).panes
            .firstWhere((p) => p.noteId == 'note-1')
            .editorMode,
        EditorMode.preview,
      );

      // 激活 note-1（会触发其他面板堆叠）
      final note1Index = container
          .read(paneStackProvider)
          .panes
          .indexWhere((p) => p.noteId == 'note-1');
      notifier.activatePane(note1Index);

      // 编辑器模式应该仍然是 preview
      expect(
        container.read(paneStackProvider).panes
            .firstWhere((p) => p.noteId == 'note-1')
            .editorMode,
        EditorMode.preview,
      );
    });

    test('copyWith 正确保留 editorMode', () {
      final pane = PaneState(
        noteId: 'note-1',
        title: '笔记1',
        editorMode: EditorMode.livePreview,
      );

      final copied = pane.copyWith(title: '新标题');
      expect(copied.editorMode, EditorMode.livePreview);
      expect(copied.title, '新标题');

      final modeChanged = pane.copyWith(editorMode: EditorMode.preview);
      expect(modeChanged.editorMode, EditorMode.preview);
    });
  });
}
