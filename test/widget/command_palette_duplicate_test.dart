import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/app.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/providers/command_provider.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final tempDir = await Directory.systemTemp.createTemp('aeromind_cmd_test_');
    await HiveService.initHive(testPath: tempDir.path);
    await HiveService.metaBox.put('welcome_shown', true);
  });

  testWidgets('命令面板打开后不应出现重复命令名称', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: AeroMindApp()));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));

    // 通过 context 获取 ProviderContainer
    final context = tester.element(find.byType(AeroMindApp));
    final container = ProviderScope.containerOf(context);

    // 打开命令面板
    container.read(commandPaletteProvider.notifier).open();
    await tester.pump();

    final state = container.read(commandPaletteProvider);
    final nameCount = <String, int>{};
    final duplicateNames = <String>[];

    for (final cmd in state.filteredCommands) {
      final count = (nameCount[cmd.name] ?? 0) + 1;
      nameCount[cmd.name] = count;
      if (count == 2) {
        duplicateNames.add(cmd.name);
      }
    }

    expect(
      duplicateNames,
      isEmpty,
      reason: '应用构建后命令面板发现重复名称: $duplicateNames',
    );
  });
}
