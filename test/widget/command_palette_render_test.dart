import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/app.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/command_palette/widgets/command_palette.dart';
import 'package:aeromind/providers/command_provider.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final tempDir = await Directory.systemTemp.createTemp('aeromind_cmd_render_');
    await HiveService.initHive(testPath: tempDir.path);
    await HiveService.metaBox.put('welcome_shown', true);
  });

  testWidgets('命令面板内「新建笔记」只应渲染一次', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: AeroMindApp()));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));

    final context = tester.element(find.byType(AeroMindApp));
    final container = ProviderScope.containerOf(context);

    // 模拟使用一次「新建笔记」命令，使其进入最近使用
    container.read(commandPaletteProvider.notifier).open();
    final state = container.read(commandPaletteProvider);
    final newNoteCommand = state.filteredCommands.firstWhere((c) => c.id == 'note.new');
    container.read(commandPaletteProvider.notifier).executeCommand(newNoteCommand);
    await tester.pump();

    // 重新打开命令面板
    container.read(commandPaletteProvider.notifier).open();
    await tester.pump();

    // 仅在命令面板覆盖层内查找「新建笔记」文本
    final newNoteWidgets = find.descendant(
      of: find.byType(CommandPaletteOverlay),
      matching: find.text('新建笔记'),
    );

    expect(
      newNoteWidgets,
      findsOneWidget,
      reason: '命令面板内「新建笔记」应该只渲染一次',
    );
  });
}
