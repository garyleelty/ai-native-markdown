import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/providers/command_provider.dart';

void main() {
  group('CommandPaletteNotifier', () {
    test('打开命令面板后 filteredCommands 中不应存在重复名称', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(commandPaletteProvider.notifier);
      notifier.open();

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
        reason: 'filteredCommands 中发现重复名称: $duplicateNames',
      );
    });

    test('搜索空字符串后结果中不应存在重复名称', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(commandPaletteProvider.notifier);
      notifier.open();
      notifier.updateSearch('');

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
        reason: '搜索空字符串后发现重复名称: $duplicateNames',
      );
    });
  });
}
