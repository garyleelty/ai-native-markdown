import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:aeromind/core/plugin/plugin_registry.dart';
import 'package:aeromind/core/plugin/base_plugin.dart';
import 'package:aeromind/core/plugin/plugin_manifest.dart';
import 'package:aeromind/core/plugin/plugin_api.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/core/plugin/plugin_storage.dart';

/// 测试用的 Mock PluginApi
class _MockPluginApi implements PluginApi {
  final List<PluginCommand> _commands = [];

  @override
  String? get activeNoteId => null;

  @override
  List<String> get openNoteIds => [];

  @override
  Future<NoteModel?> getNote(String id) async => null;

  @override
  Future<List<NoteModel>> getAllNotes() async => [];

  @override
  Future<void> saveNote(NoteModel note) async {}

  @override
  Future<List<NoteModel>> searchNotes(String query) async => [];

  @override
  void registerCommand(PluginCommand command) {
    _commands.add(command);
  }

  @override
  void unregisterCommand(String commandId) {
    _commands.removeWhere((c) => c.id == commandId);
  }

  @override
  void showStatusMessage(String message, {Duration? duration}) {}

  @override
  void showNotification(String message, {NotificationType? type}) {}

  @override
  PluginStorage getStorage(String pluginId) {
    throw UnimplementedError();
  }

  @override
  void onNoteOpened(void Function(String noteId) callback) {}

  @override
  void offNoteOpened(void Function(String noteId) callback) {}

  @override
  void onNoteSaved(void Function(String noteId) callback) {}

  @override
  void offNoteSaved(void Function(String noteId) callback) {}

  @override
  void onEntitiesRecognized(
      void Function(String noteId, List<EntityHighlight> entities) callback) {}

  @override
  void offEntitiesRecognized(
      void Function(String noteId, List<EntityHighlight> entities) callback) {}

  @override
  void onPaneStackChanged(void Function(List<String> openNoteIds) callback) {}

  @override
  void offPaneStackChanged(void Function(List<String> openNoteIds) callback) {}

  @override
  String get aiContextPrompt => '';

  @override
  Future<List<EntityHighlight>> recognizeEntities(String markdown) async => [];
}

/// 测试用的简单插件
class _TestPlugin extends BasePlugin {
  bool activateCalled = false;
  bool disposeCalled = false;
  String? lastMarkdown;

  @override
  PluginManifest get manifest => const PluginManifest(
        id: 'com.test.simple',
        name: '测试插件',
        version: '1.0.0',
        enabledByDefault: false, // 手动激活
      );

  @override
  Future<void> onActivate(PluginContext ctx) async {
    activateCalled = true;
  }

  @override
  Future<void> onDispose() async {
    disposeCalled = true;
  }

  @override
  Future<List<EntityHighlight>> recognizeEntities(String markdown) async {
    lastMarkdown = markdown;
    return [
      const EntityHighlight(
        startOffset: 0,
        endOffset: 5,
        type: EntityType.concept,
        label: '测试实体',
      ),
    ];
  }
}

/// 带依赖的插件
class _DependentPlugin extends BasePlugin {
  @override
  PluginManifest get manifest => const PluginManifest(
        id: 'com.test.dependent',
        name: '依赖插件',
        version: '1.0.0',
        dependencies: ['com.test.simple'],
        enabledByDefault: false,
      );
}

void main() {
  group('PluginRegistry', () {
    late PluginRegistry registry;

    setUpAll(() async {
      // 初始化 Hive 到临时目录 (PluginStorage.create 需要)
      final tempDir = await Directory.systemTemp.createTemp('plugin_test_');
      Hive.init(tempDir.path);
    });

    setUp(() async {
      // 每次测试先清除所有插件状态（单例重置）
      registry = PluginRegistry.instance;
      await registry.disposeAll();
      // 初始化 Mock API
      await registry.initialize(_MockPluginApi());
    });

    tearDown(() async {
      await registry.disposeAll();
    });

    test('初始状态为空', () {
      expect(registry.count, 0);
      expect(registry.activeCount, 0);
      expect(registry.allManifests, isEmpty);
    });

    test('注册插件后计数增加', () async {
      final plugin = _TestPlugin();
      await registry.register(plugin, autoActivate: false);

      expect(registry.count, 1);
      expect(registry.allManifests.first.id, 'com.test.simple');
    });

    test('注册后手动激活插件', () async {
      final plugin = _TestPlugin();
      await registry.register(plugin, autoActivate: false);

      expect(plugin.activateCalled, false);

      final result = await registry.activatePlugin('com.test.simple');

      expect(result, true);
      expect(plugin.activateCalled, true);
      expect(registry.activeCount, 1);
      expect(registry.isActive('com.test.simple'), true);
    });

    test('不重复注册同一 ID', () async {
      final plugin1 = _TestPlugin();
      final plugin2 = _TestPlugin();

      final result1 = await registry.register(plugin1, autoActivate: false);
      final result2 = await registry.register(plugin2, autoActivate: false);

      expect(result1, true);
      expect(result2, false);
      expect(registry.count, 1);
    });

    test('暂停和恢复插件', () async {
      final plugin = _TestPlugin();
      await registry.register(plugin, autoActivate: false);
      await registry.activatePlugin('com.test.simple');

      expect(registry.getState('com.test.simple'), PluginState.active);

      await registry.pausePlugin('com.test.simple');
      expect(registry.getState('com.test.simple'), PluginState.paused);

      await registry.resumePlugin('com.test.simple');
      expect(registry.getState('com.test.simple'), PluginState.active);
    });

    test('销毁插件', () async {
      final plugin = _TestPlugin();
      await registry.register(plugin, autoActivate: false);
      await registry.activatePlugin('com.test.simple');

      await registry.disposePlugin('com.test.simple');

      expect(plugin.disposeCalled, true);
      expect(registry.count, 0);
      expect(registry.getState('com.test.simple'), isNull);
    });

    test('事件监听器接收注册事件', () async {
      final events = <PluginEvent>[];
      registry.addListener(events.add);

      final plugin = _TestPlugin();
      await registry.register(plugin, autoActivate: false);

      expect(events.length, 1);
      expect(events.first.type, PluginEventType.registered);
      expect(events.first.pluginId, 'com.test.simple');

      registry.removeListener(events.add);
    });

    test('聚合实体识别结果', () async {
      final plugin = _TestPlugin();
      await registry.register(plugin, autoActivate: false);
      await registry.activatePlugin('com.test.simple');

      final entities = await registry.aggregateEntities('# 测试文本');

      expect(entities, isNotEmpty);
      expect(entities.first.label, '测试实体');
      expect(plugin.lastMarkdown, '# 测试文本');
    });

    test('未激活插件不参与聚合', () async {
      final plugin = _TestPlugin();
      await registry.register(plugin, autoActivate: false);

      final entities = await registry.aggregateEntities('# 测试文本');

      expect(entities, isEmpty);
    });

    test('依赖缺失时注册但不激活', () async {
      final dependent = _DependentPlugin();
      await registry.register(dependent, autoActivate: false);

      // 手动激活应该失败 (依赖未满足)
      final result = await registry.activatePlugin('com.test.dependent');

      expect(result, false);
      expect(registry.getState('com.test.dependent'), PluginState.registered);
    });
  });
}
