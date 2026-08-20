/// ══════════════════════════════════════════════════
/// EmbedderManager — 生产环境嵌入器生命周期
/// ══════════════════════════════════════════════════
/// 监听模型状态：就绪时从已下载文件创建 OnnxEmbedder，换档/关闭时释放。
/// 任何失败（文件缺失、path_provider 不可用等）都静默回退 null（TF-IDF）。
/// 测试通过 override `embedderProvider` 注入 FakeEmbedder，本管理器不参与。

library;

import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../models/model_tier.dart';
import '../services/embedding_service.dart';
import 'model_status_provider.dart';

/// 生产嵌入器管理器
class EmbedderManager extends Notifier<Embedder?> {
  Future<Embedder?>? _creating;

  @override
  Embedder? build() {
    final status = ref.watch(modelStatusProvider);
    final modelId = status.status == SemanticEngineStatus.ready
        ? status.currentModelId
        : null;
    if (modelId == null) {
      _creating = null;
      return null;
    }
    final create = _create(modelId);
    _creating = create;
    // 状态变更或容器销毁时释放本次创建的嵌入器
    ref.onDispose(() async {
      final e = await create;
      await e?.dispose();
    });
    return null;
  }

  /// 等待嵌入器就绪；无法创建（文件缺失/异常）返回 null
  Future<Embedder?> ready() {
    final current = state;
    if (current != null) return Future.value(current);
    final creating = _creating;
    if (creating != null) return creating;
    return Future.value(null);
  }

  Future<Embedder?> _create(String modelId) async {
    try {
      final tier = ModelTier.byId(modelId);
      final dir = await getApplicationSupportDirectory();
      final modelPath = '${dir.path}/${tier.id}.onnx';
      final vocabPath = '${dir.path}/${tier.id}-vocab.txt';
      if (!File(modelPath).existsSync() || !File(vocabPath).existsSync()) {
        return null; // 模型文件未就绪：回退
      }
      final embedder = await OnnxEmbedder.create(
        modelPath: modelPath,
        vocabPath: vocabPath,
        dims: tier.dims,
      );
      // 创建期间模型可能已切换/关闭：此时释放本次结果
      final status = ref.read(modelStatusProvider);
      if (status.status == SemanticEngineStatus.ready &&
          status.currentModelId == modelId) {
        state = embedder;
        return embedder;
      }
      await embedder.dispose();
      return null;
    } catch (e) {
      debugPrint('EmbedderManager: 创建嵌入器失败，回退 TF-IDF: $e');
      return null;
    }
  }
}

/// 生产嵌入器管理器 Provider
final embedderManagerProvider =
    NotifierProvider<EmbedderManager, Embedder?>(EmbedderManager.new);