/// ════════════════════════════════════════════════════════════════════════════
/// 嵌入服务：Embedder 抽象 + 基于后台 isolate 的 ONNX 嵌入器实现
library;

import 'dart:async';
import 'dart:isolate';
import 'embedding_isolate.dart';

/// 嵌入器抽象（测试可用 fake）
abstract class Embedder {
  Future<List<double>> embed(String text);
  Future<void> dispose();
}

/// 由文件加载模型的 ONNX 嵌入器（后台 isolate 推理）
class OnnxEmbedder implements Embedder {
  final int dims;
  final SendPort _workerPort;
  final ReceivePort _responsePort = ReceivePort();
  int _requestId = 0;
  final Map<int, Completer<List<double>>> _pending = {};
  bool _disposed = false;

  OnnxEmbedder._(this._workerPort, this.dims) {
    _responsePort.listen(_onResponse);
  }

  static Future<OnnxEmbedder> create({
    required String modelPath,
    required String vocabPath,
    required int dims,
  }) async {
    final control = ReceivePort();
    final ready = Completer<SendPort>();
    control.listen((msg) {
      if (msg is SendPort && !ready.isCompleted) ready.complete(msg);
    });
    await Isolate.spawn(
      embeddingWorkerEntry,
      [control.sendPort, modelPath, vocabPath, dims],
    );
    final workerPort = await ready.future;
    return OnnxEmbedder._(workerPort, dims);
  }

  @override
  Future<List<double>> embed(String text) async {
    if (_disposed) throw StateError('embedder disposed');
    final id = _requestId++;
    final c = Completer<List<double>>();
    _pending[id] = c;
    _workerPort.send([id, text]);
    return c.future;
  }

  void _onResponse(dynamic msg) {
    if (msg is! List || msg.length != 2) return;
    final id = msg[0] as int;
    final data = msg[1];
    final c = _pending.remove(id);
    if (c == null) return;
    if (data is List) {
      c.complete(List<double>.from(data.map((e) => (e as num).toDouble())));
    } else {
      c.completeError(StateError('embedding 推理失败'));
    }
  }

  @override
  Future<void> dispose() async {
    _disposed = true;
    _responsePort.close();
  }
}