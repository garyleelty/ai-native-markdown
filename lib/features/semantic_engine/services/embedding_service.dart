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
  static const _initTimeout = Duration(seconds: 30);
  static const _embedTimeout = Duration(seconds: 60);

  final int dims;
  final SendPort _workerPort;
  final ReceivePort _responsePort;
  final Isolate _isolate;
  int _requestId = 0;
  final Map<int, Completer<List<double>>> _pending = {};
  bool _disposed = false;

  OnnxEmbedder._(
    this._workerPort,
    this.dims,
    this._responsePort,
    this._isolate,
  ) {
    _responsePort.listen(_onResponse);
  }

  static Future<OnnxEmbedder> create({
    required String modelPath,
    required String vocabPath,
    required int dims,
  }) async {
    final control = ReceivePort();
    final responsePort = ReceivePort();
    final ready = Completer<SendPort>();
    control.listen((msg) {
      if (ready.isCompleted) return;
      if (msg is SendPort) {
        ready.complete(msg);
      } else if (msg is String) {
        ready.completeError(StateError('embedder 初始化失败: $msg'));
      }
    });
    final isolate = await Isolate.spawn(
      embeddingWorkerEntry,
      [control.sendPort, modelPath, vocabPath, dims, responsePort.sendPort],
    );
    SendPort workerPort;
    try {
      workerPort = await ready.future.timeout(
        _initTimeout,
        onTimeout: () => throw StateError('embedder 初始化超时'),
      );
    } catch (_) {
      isolate.kill(priority: Isolate.immediate);
      control.close();
      responsePort.close();
      rethrow;
    }
    control.close();
    return OnnxEmbedder._(workerPort, dims, responsePort, isolate);
  }

  @override
  Future<List<double>> embed(String text) async {
    if (_disposed) throw StateError('embedder disposed');
    final id = _requestId++;
    final c = Completer<List<double>>();
    _pending[id] = c;
    _workerPort.send([id, text]);
    try {
      return await c.future.timeout(_embedTimeout);
    } on TimeoutException {
      _pending.remove(id);
      throw StateError('embedding 推理超时');
    }
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
    if (_disposed) return;
    _disposed = true;
    for (final c in _pending.values) {
      c.completeError(StateError('embedder disposed'));
    }
    _pending.clear();
    _isolate.kill(priority: Isolate.immediate);
    _responsePort.close();
  }
}