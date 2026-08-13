import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/sliding_panes/widgets/sliding_panes_container.dart';
import 'package:aeromind/providers/pane_provider.dart';

/// 标题草稿持久化 Widget 测试
///
/// 验证场景（评审发现的核心回归点）:
///   打开面板 → 双击重命名 → 输入 → 堆叠面板(草稿持久化) → 取消堆叠(草稿恢复)
///   → 继续输入 → 再次堆叠(再次持久化) → 取消堆叠(全部输入保留)
///
/// 关键: 重新打开面板后本地 `_editing` 标记必须与 provider 草稿派生态保持一致，
/// 否则第二次堆叠关闭时不会持久化后续修改（静默丢字）。
void main() {
  testWidgets('标题草稿在堆叠/取消堆叠后能完整保留（含二次编辑）',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: SlidingPanesContainer(
              paneBuilder:
                  // 面板内容用占位 Widget，避免引入额外 Provider 依赖
                  _placeholderPaneBuilder,
            ),
          ),
        ),
      ),
    );

    final container = ProviderScope.containerOf(
      tester.element(find.byType(SlidingPanesContainer)),
    );

    // 打开一个面板
    container.read(paneStackProvider.notifier).openPane('note-1', 'Note 1');
    await tester.pumpAndSettle();

    // 初始态: 显示标题文本（标题栏与顶部标签栏各一处），未进入编辑
    expect(find.text('Note 1'), findsWidgets);
    expect(find.byType(TextField), findsNothing);

    // 双击标题栏进入编辑态。
    // 标题栏的 GestureDetector 是唯一带 onDoubleTap 的，借此与顶部标签栏区分。
    final titleBarGesture = find.byWidgetPredicate(
      (w) => w is GestureDetector && w.onDoubleTap != null,
    );
    expect(titleBarGesture, findsOneWidget);
    await tester.tap(titleBarGesture);
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(titleBarGesture);
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsOneWidget);

    // 第一次输入
    await tester.enterText(find.byType(TextField), 'Note 1abc');
    await tester.pump();

    // 堆叠面板（面板仍在 state.panes 中，但离开可见树 → _PaneTitleBar 被 dispose）
    container.read(paneStackProvider.notifier).stackPane(0);
    await tester.pumpAndSettle();

    expect(find.text('Note 1abc'), findsNothing,
        reason: '堆叠后标题栏应已从可见树移除');

    // 取消堆叠 → 重新构建 _PaneTitleBar，应从 PaneState 恢复草稿
    container.read(paneStackProvider.notifier).activatePane(0);
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsOneWidget,
        reason: '恢复草稿后应仍处于编辑态');
    expect(_textFieldValue(tester), 'Note 1abc',
        reason: '第一次输入应在取消堆叠后保留');

    // 在已恢复的基础上继续输入（评审发现的二次编辑路径）
    await tester.enterText(find.byType(TextField), 'Note 1abcxyz');
    await tester.pump();

    // 再次堆叠 → dispose 必须持久化（依赖 _editing 已被恢复为 true）
    container.read(paneStackProvider.notifier).stackPane(0);
    await tester.pumpAndSettle();

    // 再次取消堆叠 → 应保留全部输入
    container.read(paneStackProvider.notifier).activatePane(0);
    await tester.pumpAndSettle();

    expect(_textFieldValue(tester), 'Note 1abcxyz',
        reason: '第二次堆叠前的输入也应在取消堆叠后完整保留');
  });
}

Widget _placeholderPaneBuilder(BuildContext context, String noteId, int index) {
  return Center(child: Text('pane:$noteId'));
}

String _textFieldValue(WidgetTester tester) {
  final textField = tester.widget<TextField>(find.byType(TextField));
  return textField.controller?.text ?? '';
}
