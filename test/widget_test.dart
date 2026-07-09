import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/app.dart';

void main() {
  testWidgets('AeroMind 应用能正常构建', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: AeroMindApp()));
    await tester.pumpAndSettle();

    expect(find.text('AeroMind'), findsOneWidget);
  });
}
