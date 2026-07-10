import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/app.dart';
import 'package:aeromind/core/services/hive_service.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final tempDir = await Directory.systemTemp.createTemp('aeromind_test_');
    await HiveService.initHive(testPath: tempDir.path);
    await HiveService.metaBox.put('welcome_shown', true);
  });

  testWidgets('AeroMind 应用能正常构建', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: AeroMindApp()));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.textContaining('AeroMind'), findsWidgets);
  });
}
