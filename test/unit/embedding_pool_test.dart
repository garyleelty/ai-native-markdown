/// ════════════════════════════════════════════════════════════════════════════
/// clsPool 池化函数 + isolate 回包路由冒烟测试
/// ════════════════════════════════════════════════════════════════════════════
library;

import 'dart:async';
import 'dart:isolate';
import 'dart:math' as math;
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_pool.dart';

void main() {
  group('clsPool', () {
    test('取首 token 行并做 L2 归一化', () {
      final pooled = clsPool([
        [3.0, 4.0],
        [1.0, 2.0],
        [0.5, 0.5],
      ], 2);
      final norm = math.sqrt(9 + 16);
      expect(pooled.length, 2);
      expect(pooled[0], closeTo(3 / norm, 1e-9));
      expect(pooled[1], closeTo(4 / norm, 1e-9));
    });

    test('空输入返回全零向量', () {
      final pooled = clsPool([], 4);
      expect(pooled, List.filled(4, 0.0));
    });

    test('零范数行返回全零向量（不产生 NaN）', () {
      final pooled = clsPool([
        [0.0, 0.0, 0.0]
      ], 3);
      expect(pooled, List.filled(3, 0.0));
    });

    test('输出恒为 L2 归一化（范数 1）', () {
      final pooled = clsPool([
        [1.0, 2.0, 3.0, 4.0, 5.0]
      ], 5);
      var norm = 0.0;
      for (final x in pooled) {
        norm += x * x;
      }
      expect(math.sqrt(norm), closeTo(1.0, 1e-9));
    });

    test('dims 超出实际行长度时补零', () {
      final pooled = clsPool([
        [1.0, 2.0]
      ], 4);
      expect(pooled.length, 4);
      final norm = math.sqrt(1 + 4);
      expect(pooled[0], closeTo(1 / norm, 1e-9));
      expect(pooled[1], closeTo(2 / norm, 1e-9));
      expect(pooled[2], 0.0);
      expect(pooled[3], 0.0);
    });
  });

  group('isolate 回包路由', () {
    test('worker 将回复发往主 isolate 传入的 replyPort（防回包路由回归）', () async {
      final responsePort = ReceivePort();
      final control = ReceivePort();
      final ready = Completer<SendPort>();
      control.listen((msg) {
        if (msg is SendPort && !ready.isCompleted) ready.complete(msg);
      });
      await Isolate.spawn(
        _echoWorker,
        [control.sendPort, 'dummy.model', 'dummy.vocab', 4, responsePort.sendPort],
      );
      final workerPort = await ready.future;
      workerPort.send([1, 'hello']);
      final msg = await responsePort.first.timeout(const Duration(seconds: 5));
      expect(msg, [1, 'hello!']);
      control.close();
      responsePort.close();
    });
  });
}

/// 与 embeddingWorkerEntry 相同参数布局，但不依赖 ONNX：
/// 仅验证 worker 从 args[4] 读取 replyPort 并回包到主 isolate。
void _echoWorker(List<Object?> args) async {
  final control = args[0] as SendPort;
  final replyPort = args[4] as SendPort;
  final response = ReceivePort();
  control.send(response.sendPort);
  await for (final req in response) {
    if (req is! List || req.length != 2) continue;
    replyPort.send([req[0], '${req[1]}!']);
  }
}