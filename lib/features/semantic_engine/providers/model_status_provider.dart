/// ══════════════════════════════════════════════════
/// ModelStatusProvider — 语义模型状态机
/// ══════════════════════════════════════════════════
/// 管理语义引擎启用状态与模型下载/重建索引的生命周期。
/// 不依赖 Hive，便于用裸 ProviderContainer 单测。
/// ──────────────────────────────────────────────────

library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

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

  ModelStatusState copyWith({
    SemanticEngineStatus? status,
    double? progress,
    String? error,
    String? currentModelId,
  }) => ModelStatusState(
        status: status ?? this.status,
        progress: progress ?? this.progress,
        error: error ?? this.error,
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

  void finishDownload(String modelId) => state = ModelStatusState(
        status: SemanticEngineStatus.ready, progress: 1, currentModelId: modelId);

  void startReindex() => state = state.copyWith(status: SemanticEngineStatus.reindexing);
  void finishReindex(String modelId) => state = ModelStatusState(
        status: SemanticEngineStatus.ready, progress: 1, currentModelId: modelId);

  void fail(String message) => state = state.copyWith(status: SemanticEngineStatus.error, error: message);
  void clearError() => state = state.copyWith(status: SemanticEngineStatus.idle, error: null);
}

final modelStatusProvider =
    NotifierProvider<ModelStatusNotifier, ModelStatusState>(ModelStatusNotifier.new);