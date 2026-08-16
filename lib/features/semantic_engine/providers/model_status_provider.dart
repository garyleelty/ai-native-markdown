/// ══════════════════════════════════════════════════
/// ModelStatusProvider — 语义模型状态机
/// ══════════════════════════════════════════════════
/// 管理语义引擎启用状态与模型下载/重建索引的生命周期。
/// 不依赖 Hive，便于用裸 ProviderContainer 单测。
/// ──────────────────────────────────────────────────

library;

import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../providers/settings_provider.dart';
import '../models/model_tier.dart';
import '../services/model_download_service.dart';

/// 语义引擎状态
enum SemanticEngineStatus { notEnabled, idle, downloading, ready, reindexing, error }

/// 模型状态
class ModelStatusState {
  final SemanticEngineStatus status;
  final double progress; // 下载进度 0..1
  final String? error;
  final String? currentModelId;

  const ModelStatusState({
    this.status = SemanticEngineStatus.notEnabled,
    this.progress = 0,
    this.error,
    this.currentModelId,
  });

  static const Object _unset = Object();

  ModelStatusState copyWith({
    SemanticEngineStatus? status,
    double? progress,
    Object? error = _unset,
    String? currentModelId,
  }) => ModelStatusState(
        status: status ?? this.status,
        progress: progress ?? this.progress,
        error: identical(error, _unset) ? this.error : error as String?,
        currentModelId: currentModelId ?? this.currentModelId,
      );
}

/// 模型状态 Notifier
class ModelStatusNotifier extends Notifier<ModelStatusState> {
  @override
  ModelStatusState build() => const ModelStatusState();

  void enable() => state = const ModelStatusState(status: SemanticEngineStatus.idle);
  void disable() => state = const ModelStatusState(status: SemanticEngineStatus.notEnabled);

  void startDownload() => state = state.copyWith(
        status: SemanticEngineStatus.downloading, progress: 0, error: null);

  void updateDownloadProgress(double p) =>
      state = state.copyWith(progress: p.clamp(0, 1));

  void finishDownload(String modelId) => _markReady(modelId);

  void startReindex() => state = state.copyWith(status: SemanticEngineStatus.reindexing);
  void finishReindex(String modelId) => _markReady(modelId);

  void _markReady(String modelId) => state = ModelStatusState(
        status: SemanticEngineStatus.ready, progress: 1, currentModelId: modelId);

  void fail(String message) => state = state.copyWith(status: SemanticEngineStatus.error, error: message);
  void clearError() => state = state.copyWith(status: SemanticEngineStatus.idle, error: null);

  /// 下载当前档位模型（onnx + vocab.txt），完成后进入 ready
  Future<void> downloadCurrentTier() async {
    final settings = ref.read(settingsProvider);
    final tier = ModelTier.byId(settings.semanticModelTier);
    startDownload();
    try {
      final dir = await getApplicationSupportDirectory();
      final modelPath = '${dir.path}/${tier.id}.onnx';
      final vocabPath = '${dir.path}/${tier.id}-vocab.txt';
      final svc = ModelDownloadService(
        url: Uri.parse(tier.onnxUrl),
        destPath: modelPath,
        downloader: HttpDownloader(),
        expectedSha256: tier.expectedHash,
      );
      var last = 0.0;
      await svc.download(onProgress: (p) {
        if (p - last >= 0.05 || p >= 1) {
          last = p;
          updateDownloadProgress(p);
        }
      });
      // vocab 复用同一服务（不校验哈希）
      final vocabSvc = ModelDownloadService(
        url: Uri.parse(tier.vocabUrl),
        destPath: vocabPath,
        downloader: HttpDownloader(),
        expectedSha256: null,
      );
      await vocabSvc.download(onProgress: (_) {});
      finishDownload(tier.id);
    } catch (e) {
      fail('模型下载失败: $e');
    }
  }

  /// 删除已下载的模型文件，回到 idle
  Future<void> deleteModel() async {
    try {
      final dir = await getApplicationSupportDirectory();
      final tier = ModelTier.byId(ref.read(settingsProvider).semanticModelTier);
      final model = File('${dir.path}/${tier.id}.onnx');
      final vocab = File('${dir.path}/${tier.id}-vocab.txt');
      if (await model.exists()) await model.delete();
      if (await vocab.exists()) await vocab.delete();
    } catch (_) {}
    state = const ModelStatusState(status: SemanticEngineStatus.idle);
  }
}

final modelStatusProvider =
    NotifierProvider<ModelStatusNotifier, ModelStatusState>(ModelStatusNotifier.new);