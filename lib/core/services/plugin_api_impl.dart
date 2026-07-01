/// ══════════════════════════════════════════════════
/// PluginApiImpl — PluginApi 的宿主应用实现
/// ══════════════════════════════════════════════════
/// 将插件 API 调用桥接到 AeroMind 内部服务。
/// 这是插件系统和宿主应用之间的唯一连接点。
/// ──────────────────────────────────────────────────

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show WidgetRef, Provider;
import '../plugin/plugin_api.dart';
import '../plugin/plugin_storage.dart';
import '../models/note_model.dart';
import '../../providers/note_provider.dart';
import '../../providers/pane_provider.dart';
import '../../providers/ai_provider.dart';
import '../../features/ai_engine/services/entity_recognizer.dart';
import '../../features/command_palette/services/command_registry.dart';

/// 事件回调类型
typedef _NoteCallback = void Function(String noteId);
typedef _EntitiesCallback = void Function(
    String noteId, List<EntityHighlight> entities);
typedef _PaneCallback = void Function(List<String> openNoteIds);

/// PluginApi 宿主实现
class PluginApiImpl implements PluginApi {
  final WidgetRef _ref;

  /// 已注册的插件命令映射 (commandId → PluginCommand)
  final Map<String, PluginCommand> _pluginCommands = {};

  /// 事件监听器
  final List<_NoteCallback> _onNoteOpened = [];
  final List<_NoteCallback> _onNoteSaved = [];
  final List<_EntitiesCallback> _onEntitiesRecognized = [];
  final List<_PaneCallback> _onPaneStackChanged = [];

  PluginApiImpl(this._ref);

  // ── 笔记操作 ──

  @override
  Future<NoteModel?> getNote(String id) async {
    final repo = _ref.read(noteRepositoryProvider);
    return repo.getNote(id);
  }

  @override
  Future<List<NoteModel>> getAllNotes() async {
    final repo = _ref.read(noteRepositoryProvider);
    return repo.getAllNotes();
  }

  @override
  Future<void> saveNote(NoteModel note) async {
    final repo = _ref.read(noteRepositoryProvider);
    await repo.saveNote(note);
  }

  @override
  Future<List<NoteModel>> searchNotes(String query) async {
    final repo = _ref.read(noteRepositoryProvider);
    return repo.searchBySemantic(query);
  }

  @override
  String? get activeNoteId {
    final paneState = _ref.read(paneStackProvider);
    return paneState.activeNoteId;
  }

  @override
  List<String> get openNoteIds {
    final paneState = _ref.read(paneStackProvider);
    return paneState.panes.map((p) => p.noteId).toList();
  }

  // ── UI 扩展 ──

  @override
  void registerCommand(PluginCommand command) {
    _pluginCommands[command.id] = command;
    final registry = CommandRegistry.instance;
    registry.register(CommandDef(
      id: command.id,
      name: command.name,
      icon: IconData(command.iconCodePoint, fontFamily: 'MaterialIcons'),
      shortcut: command.shortcut,
      category: CommandCategory.plugin,
      description: '${command.description} [${command.pluginId}]',
      action: () => command.action(),
    ));
  }

  @override
  void unregisterCommand(String commandId) {
    _pluginCommands.remove(commandId);
    CommandRegistry.instance.unregister(commandId);
  }

  @override
  void showStatusMessage(String message,
      {Duration duration = const Duration(seconds: 3)}) {
    _statusMessageController.add(message);
  }

  @override
  void showNotification(String message,
      {NotificationType type = NotificationType.info}) {
    _notificationController
        .add(PluginNotification(message: message, type: type));
  }

  // ── 存储 ──

  @override
  PluginStorage getStorage(String pluginId) {
    throw UnimplementedError('请通过 PluginRegistry 获取存储');
  }

  // ── 事件 ──

  @override
  void onNoteOpened(void Function(String noteId) callback) {
    _onNoteOpened.add(callback);
  }

  @override
  void onNoteSaved(void Function(String noteId) callback) {
    _onNoteSaved.add(callback);
  }

  @override
  void onEntitiesRecognized(
    void Function(String noteId, List<EntityHighlight> entities) callback,
  ) {
    _onEntitiesRecognized.add(callback);
  }

  @override
  void onPaneStackChanged(
      void Function(List<String> openNoteIds) callback) {
    _onPaneStackChanged.add(callback);
  }

  // ── AI ──

  @override
  String get aiContextPrompt {
    final context = _ref.read(aiContextPromptProvider);
    return context.systemPrompt;
  }

  @override
  Future<List<EntityHighlight>> recognizeEntities(String markdown) async {
    final recognizer = _ref.read(entityRecognizerProvider);
    final result = await recognizer.recognize(markdown);
    return result.entities;
  }

  // ── 事件触发 (供宿主调用) ──

  void notifyNoteOpened(String noteId) {
    for (final cb in _onNoteOpened) {
      try {
        cb(noteId);
      } catch (_) {}
    }
  }

  void notifyNoteSaved(String noteId) {
    for (final cb in _onNoteSaved) {
      try {
        cb(noteId);
      } catch (_) {}
    }
  }

  void notifyEntitiesRecognized(
      String noteId, List<EntityHighlight> entities) {
    for (final cb in _onEntitiesRecognized) {
      try {
        cb(noteId, entities);
      } catch (_) {}
    }
  }

  void notifyPaneStackChanged(List<String> openNoteIds) {
    for (final cb in _onPaneStackChanged) {
      try {
        cb(openNoteIds);
      } catch (_) {}
    }
  }

  // ── 消息流 ──

  final _statusMessageController = StreamController<String>.broadcast();
  Stream<String> get statusMessages => _statusMessageController.stream;

  final _notificationController =
      StreamController<PluginNotification>.broadcast();
  Stream<PluginNotification> get notifications =>
      _notificationController.stream;

  void dispose() {
    _statusMessageController.close();
    _notificationController.close();
  }
}

/// 插件通知数据
class PluginNotification {
  final String message;
  final NotificationType type;

  const PluginNotification({required this.message, required this.type});
}
