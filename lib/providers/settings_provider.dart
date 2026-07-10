import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/services/hive_service.dart';
import '../features/ai_engine/services/entity_recognizer.dart';

/// 主题模式
enum AppThemeMode { dark, light }

/// 设置状态
class AppSettings {
  final bool autoSaveEnabled;
  final Duration autoSaveDelay;
  final RecognitionStrategy entityRecognitionStrategy;
  final Duration entityRecognitionDelay;
  final bool defaultEditMode;
  final double fontSize;
  final AppThemeMode themeMode;

  /// 远程 LLM 配置
  final String llmApiEndpoint;
  final String llmApiKey;
  final String llmModel;

  const AppSettings({
    this.autoSaveEnabled = true,
    this.autoSaveDelay = const Duration(seconds: 2),
    this.entityRecognitionStrategy = RecognitionStrategy.local,
    this.entityRecognitionDelay = const Duration(milliseconds: 500),
    this.defaultEditMode = true,
    this.fontSize = 14.0,
    this.themeMode = AppThemeMode.dark,
    this.llmApiEndpoint = '',
    this.llmApiKey = '',
    this.llmModel = 'gpt-3.5-turbo',
  });

  AppSettings copyWith({
    bool? autoSaveEnabled,
    Duration? autoSaveDelay,
    RecognitionStrategy? entityRecognitionStrategy,
    Duration? entityRecognitionDelay,
    bool? defaultEditMode,
    double? fontSize,
    AppThemeMode? themeMode,
    String? llmApiEndpoint,
    String? llmApiKey,
    String? llmModel,
  }) {
    return AppSettings(
      autoSaveEnabled: autoSaveEnabled ?? this.autoSaveEnabled,
      autoSaveDelay: autoSaveDelay ?? this.autoSaveDelay,
      entityRecognitionStrategy:
          entityRecognitionStrategy ?? this.entityRecognitionStrategy,
      entityRecognitionDelay:
          entityRecognitionDelay ?? this.entityRecognitionDelay,
      defaultEditMode: defaultEditMode ?? this.defaultEditMode,
      fontSize: fontSize ?? this.fontSize,
      themeMode: themeMode ?? this.themeMode,
      llmApiEndpoint: llmApiEndpoint ?? this.llmApiEndpoint,
      llmApiKey: llmApiKey ?? this.llmApiKey,
      llmModel: llmModel ?? this.llmModel,
    );
  }

  /// 序列化为 Map 用于持久化存储
  Map<String, dynamic> toMap() {
    return {
      'autoSaveEnabled': autoSaveEnabled,
      'autoSaveDelaySeconds': autoSaveDelay.inSeconds,
      'entityRecognitionStrategy': entityRecognitionStrategy.name,
      'entityRecognitionDelayMs': entityRecognitionDelay.inMilliseconds,
      'defaultEditMode': defaultEditMode,
      'fontSize': fontSize,
      'themeMode': themeMode.name,
      'llmApiEndpoint': llmApiEndpoint,
      'llmApiKey': llmApiKey,
      'llmModel': llmModel,
    };
  }

  /// 从 Map 反序列化
  factory AppSettings.fromMap(Map<dynamic, dynamic> map) {
    return AppSettings(
      autoSaveEnabled: map['autoSaveEnabled'] as bool? ?? true,
      autoSaveDelay: Duration(
        seconds: map['autoSaveDelaySeconds'] as int? ?? 2,
      ),
      entityRecognitionStrategy: RecognitionStrategy.values.firstWhere(
        (e) => e.name == map['entityRecognitionStrategy'],
        orElse: () => RecognitionStrategy.local,
      ),
      entityRecognitionDelay: Duration(
        milliseconds: map['entityRecognitionDelayMs'] as int? ?? 500,
      ),
      defaultEditMode: map['defaultEditMode'] as bool? ?? true,
      fontSize: (map['fontSize'] as num?)?.toDouble() ?? 14.0,
      themeMode: AppThemeMode.values.firstWhere(
        (e) => e.name == map['themeMode'],
        orElse: () => AppThemeMode.dark,
      ),
      llmApiEndpoint: map['llmApiEndpoint'] as String? ?? '',
      llmApiKey: map['llmApiKey'] as String? ?? '',
      llmModel: map['llmModel'] as String? ?? 'gpt-3.5-turbo',
    );
  }

  /// 转换为 Flutter ThemeMode
  ThemeMode get flutterThemeMode =>
      themeMode == AppThemeMode.light ? ThemeMode.light : ThemeMode.dark;
}

/// 设置持久化键名
const _kSettingsKey = 'app_settings';

class SettingsNotifier extends Notifier<AppSettings> {
  @override
  AppSettings build() {
    try {
      final raw = HiveService.metaBox.get(_kSettingsKey);
      if (raw is Map) {
        return AppSettings.fromMap(raw);
      }
    } catch (e) {
      debugPrint('Error loading settings: $e');
    }
    return const AppSettings();
  }

  void _persist() {
    try {
      HiveService.metaBox.put(_kSettingsKey, state.toMap());
    } catch (e) {
      debugPrint('Error persisting settings: $e');
    }
  }

  void setAutoSaveEnabled(bool value) {
    state = state.copyWith(autoSaveEnabled: value);
    _persist();
  }

  void setEntityRecognitionStrategy(RecognitionStrategy strategy) {
    state = state.copyWith(entityRecognitionStrategy: strategy);
    _persist();
  }

  void setDefaultEditMode(bool isEditMode) {
    state = state.copyWith(defaultEditMode: isEditMode);
    _persist();
  }

  void setFontSize(double size) {
    state = state.copyWith(fontSize: size);
    _persist();
  }

  void setThemeMode(AppThemeMode mode) {
    state = state.copyWith(themeMode: mode);
    _persist();
  }

  void setLlmApiEndpoint(String endpoint) {
    state = state.copyWith(llmApiEndpoint: endpoint);
    _persist();
  }

  void setLlmApiKey(String key) {
    state = state.copyWith(llmApiKey: key);
    _persist();
  }

  void setLlmModel(String model) {
    state = state.copyWith(llmModel: model);
    _persist();
  }

  /// 清除所有应用数据：笔记、版本、回收站、设置
  Future<void> clearAllData() async {
    try {
      await HiveService.clearAllData();
    } catch (e) {
      debugPrint('Error clearing all data: $e');
    }
    // 重置为默认设置
    state = const AppSettings();
    _persist();
  }
}

final settingsProvider =
    NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);
