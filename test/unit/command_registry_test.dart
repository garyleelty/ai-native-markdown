import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/command_palette/services/command_registry.dart';

void main() {
  group('CommandRegistry', () {
    test('内置命令中不应存在重复名称', () {
      final registry = CommandRegistry.instance;
      registry.ensureInitialized();

      final nameCount = <String, int>{};
      final duplicateNames = <String>[];

      for (final cmd in registry.allCommands) {
        final count = (nameCount[cmd.name] ?? 0) + 1;
        nameCount[cmd.name] = count;
        if (count == 2) {
          duplicateNames.add(cmd.name);
        }
      }

      expect(
        duplicateNames,
        isEmpty,
        reason: '命令面板发现重复名称: $duplicateNames',
      );
    });

    test('内置命令中不应存在重复 ID', () {
      final registry = CommandRegistry.instance;
      registry.ensureInitialized();

      final idCount = <String, int>{};
      final duplicateIds = <String>[];

      for (final cmd in registry.allCommands) {
        final count = (idCount[cmd.id] ?? 0) + 1;
        idCount[cmd.id] = count;
        if (count == 2) {
          duplicateIds.add(cmd.id);
        }
      }

      expect(
        duplicateIds,
        isEmpty,
        reason: '命令面板发现重复 ID: $duplicateIds',
      );
    });
  });
}
