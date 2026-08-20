/// ══════════════════════════════════════════════════
/// EmbedderManager — 生产环境嵌入器生命周期
/// ══════════════════════════════════════════════════
/// 惰性创建：模型就绪或重嵌入期间（ready/reindexing）首次 embed/search
/// 时按需创建 OnnxEmbedder 并缓存，换档/关闭时释放。
/// 任何失败（文件缺失、path_provider 不可用等）静默回退 null（TF-IDF）。
/// 测试通过 override `embedderProvider` 注入 FakeEmbedder，或 override
/// `embedderFactoryProvider` 注入 fake 工厂验证真实状态流。

library;

import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../models/model_tier.dart';
import '../services/embedding_service.dart';
import 'model_status_provider.dart';

/// 嵌入器创建器（测试可注入 fake）
typedef EmbedderCreator = Future<Embedder?> Function(String modelId);

/// 默认实现：从已下载文件创建 OnnxEmbedder
Future<Embedder?> _defaultCreate(String modelId) async {
  final tier = ModelTier.byId(modelId);
  final dir = await getApplicationSupportDirectory();
  final modelPath = '${dir.path}/${tier.id}.onnx';
  final vocabPath = '${dir.path}/${tier.id}-vocab.txt';
  if (!File(modelPath).existsSync() || !File(vocabPath).existsSync()) {
    return null; // 模型文件未就绪：回退
  }
  return OnnxEmbedder.create(
    modelPath: modelPath,
    vocabPath: vocabPath,
    dims: tier.dims,
  );
}

/// 生产嵌入器管理器
class EmbedderManager {
  final Ref _ref;
  final EmbedderCreator _factory;
  Embedder? _embedder;
  String? _modelId;
  Future<Embedder?>? _inFlight;
  bool _failed = false;

  EmbedderManager(this._ref, {required EmbedderCreator factory})
      : _factory = factory;

  /// 当前已就绪的嵌入器快照（可能为 null：尚未创建）
  Embedder? get current => _embedder;

  bool _isActive(ModelStatusState s) =>
      s.status == SemanticEngineStatus.ready ||
      s.status == SemanticEngineStatus.reindexing;

  /// 等待嵌入器就绪；不可用/创建失败返回 null
  Future<Embedder?> ready() async {
    final status = _ref.read(modelStatusProvider);
    if (!_isActive(status) || status.currentModelId == null) {
      await disposeEmbedder();
      return null;
    }
    final modelId = status.currentModelId!;
    if (_modelId != modelId) {
      await disposeEmbedder();
      _modelId = modelId;
      _failed = false;
    }
    if (_embedder != null) return _embedder;
    if (_failed) return null; // 上次创建失败：不重复尝试
    final inFlight = _inFlight;
    if (inFlight != null) return inFlight;
    final create = _create(modelId);
    _inFlight = create;
    return create;
  }

  Future<Embedder?> _create(String modelId) async {
    try {
      final embedder = await _factory(modelId);
      if (embedder == null) return null;
      // 创建期间状态可能已关闭/切换：丢弃本次结果
      final status = _ref.read(modelStatusProvider);
      if (!_isActive(status) || status.currentModelId != modelId) {
        await embedder.dispose();
        return null;
      }
      _embedder = embedder;
      return embedder;
    } catch (e) {
      _failed = true;
      debugPrint('EmbedderManager: 创建嵌入器失败，回退 TF-IDF: $e');
      return null;
    } finally {
      _inFlight = null;
    }
  }

  /// 释放当前嵌入器并清空状态
  Future<void> disposeEmbedder() async {
    _inFlight = null;
    _modelId = null;
    _failed = false;
    final e = _embedder;
    _embedder = null;
    await e?.dispose();
  }
}

/// 嵌入器创建器 Provider（测试 override 注入 fake）
final embedderFactoryProvider = Provider<EmbedderCreator>((ref) => _defaultCreate);

/// 生产嵌入器管理器 Provider
final embedderManagerProvider = Provider<EmbedderManager>((ref) {
  final manager =
      EmbedderManager(ref, factory: ref.watch(embedderFactoryProvider));
  // 语义引擎关闭/下载等不可嵌入状态时主动释放嵌入器
  ref.listen(modelStatusProvider, (previous, next) {
    final active = next.status == SemanticEngineStatus.ready ||
        next.status == SemanticEngineStatus.reindexing;
    if (!active) {
      manager.disposeEmbedder();
    }
  });
  ref.onDispose(manager.disposeEmbedder);
  return manager;
});