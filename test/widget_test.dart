import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/app.dart';

void main() {
  testWidgets('AeroMind 应用能正常构建', (WidgetTester tester) async {
    await tester.pumpWidget(const AeroMindApp());
    await tester.pumpAndSettle();

    // 验证应用标题存在
    expect(find.text('AeroMind'), findsOneWidget);
  });
}
