import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:aeromind/core/plugin/plugin_effect.dart';
import 'package:aeromind/core/plugin/plugin_registry.dart';
import 'package:aeromind/core/plugin/base_plugin.dart';
import 'package:aeromind/core/plugin/plugin_manifest.dart';
import 'package:aeromind/core/plugin/plugin_api.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/core/plugin/plugin_storage.dart';

/// 记录 API 调用痕迹的 Mock PluginApi
class _TrackingMockApi implements PluginApi {
  final List<String> calls = [];

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
    calls.add('registerCommand:${command.id}');
  }

  @override
  void unregisterCommand(String commandId) {
    calls.add('unregisterCommand:$commandId');
  }

  @override
  void showStatusMessage(String message, {Duration? duration}) {}

  @override
  void showNotification(String message, {NotificationType? type}) {}

  @override
  PluginStorage getStorage(String pluginId) {
    throw UnimplementedError();
  }

  final List<void Function(String)> opened = [];

  @override
  void onNoteOpened(void Function(String noteId) callback) {
    calls.add('onNoteOpened');
    opened.add(callback);
  }

  @override
  void offNoteOpened(void Function(String noteId) callback) {
    calls.add('offNoteOpened');
    opened.remove(callback);
  }

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

/// 使用可逆副作用注册命令和事件订阅的测试插件
class _EffectPlugin extends BasePlugin {
  final List<String> log = [];

  @override
  PluginManifest get manifest => const PluginManifest(
        id: 'com.test.effect',
        name: '可逆副作用插件',
        version: '1.0.0',
        enabledByDefault: false,
      );

  @override
  Future<void> onActivate(PluginContext ctx) async {
    // 注册命令（逆操作：注销）
    ctx.registerCommand(PluginCommand(
      id: 'plugin.effect.cmd',
      name: '测试命令',
      pluginId: manifest.id,
      action: () async {},
    ));

    // 订阅事件（逆操作：取消订阅）
    void onOpened(String noteId) => log.add('opened:$noteId');
    ctx.effect(() sync* {
      ctx.api.onNoteOpened(onOpened);
      yield () => ctx.api.offNoteOpened(onOpened);
    });

    // 直接登记逆操作
    ctx.disposable(() => log.add('inverse-direct'));
    log.add('activate');
  }
}

/// 激活中途失败的插件（第二个 effect 抛异常）
class _FailingEffectPlugin extends BasePlugin {
  final List<String> log = [];

  @override
  PluginManifest get manifest => const PluginManifest(
        id: 'com.test.failing-effect',
        name: '中途失败插件',
        version: '1.0.0',
        enabledByDefault: false,
      );

  @override
  Future<void> onActivate(PluginContext ctx) async {
    ctx.disposable(() => log.add('inverse-step1'));
    log.add('step1');
    throw StateError('中途失败');
  }
}

void main() {
  group('EffectDisposer', () {
    test('收集逆操作并按 LIFO 顺序执行', () async {
      final disposer = EffectDisposer();
      final log = <String>[];

      disposer.disposable(() => log.add('E1⁻¹'));
      disposer.disposable(() => log.add('E2⁻¹'));
      disposer.disposable(() => log.add('E3⁻¹'));

      expect(disposer.length, 3);
      await disposer.rollback();

      expect(log, ['E3⁻¹', 'E2⁻¹', 'E1⁻¹']);
      expect(disposer.length, 0);
    });

    test('effect 生成器逐步登记逆操作', () async {
      final disposer = EffectDisposer();
      final log = <String>[];

      disposer.effect(() sync* {
        log.add('E1');
        yield () => log.add('E1⁻¹');
        log.add('E2');
        yield () => log.add('E2⁻¹');
      });

      expect(log, ['E1', 'E2']);
      expect(disposer.length, 2);

      await disposer.rollback();
      expect(log, ['E1', 'E2', 'E2⁻¹', 'E1⁻¹']);
    });

    test('生成器中途抛异常时已登记步骤保留（部分回滚）', () async {
      final disposer = EffectDisposer();
      final log = <String>[];

      expect(() {
        disposer.effect(() sync* {
          log.add('step1');
          yield () => log.add('step1⁻¹');
          throw StateError('boom');
        });
      }, throwsStateError);

      // 第一步的逆操作已登记，回滚时执行
      expect(disposer.length, 1);
      await disposer.rollback();
      expect(log, ['step1', 'step1⁻¹']);
    });

    test('rollback 幂等，回滚后禁止再注册', () async {
      final disposer = EffectDisposer();
      final log = <String>[];
      disposer.disposable(() => log.add('x'));
      await disposer.rollback();
      await disposer.rollback();
      expect(log, ['x']);
      expect(disposer.isRolledBack, true);
      expect(() => disposer.disposable(() {}), throwsStateError);
      expect(() => disposer.effect(() sync* {}), throwsStateError);
    });
  });

  group('PluginRegistry + 可逆副作用', () {
    late PluginRegistry registry;
    late _TrackingMockApi api;

    setUpAll(() async {
      final tempDir = await Directory.systemTemp.createTemp('plugin_effect_');
      Hive.init(tempDir.path);
    });

    setUp(() async {
      registry = PluginRegistry.instance;
      await registry.disposeAll();
      api = _TrackingMockApi();
      await registry.initialize(api);
    });

    tearDown(() async {
      await registry.disposeAll();
    });

    test('暂停插件自动回滚命令注册与事件订阅', () async {
      final plugin = _EffectPlugin();
      await registry.register(plugin, autoActivate: false);
      await registry.activatePlugin('com.test.effect');

      expect(api.calls, contains('registerCommand:plugin.effect.cmd'));
      expect(api.calls, contains('onNoteOpened'));
      expect(plugin.log, contains('activate'));

      await registry.pausePlugin('com.test.effect');

      // 命令注销、事件取消订阅、直接登记的逆操作全部按 LIFO 执行
      expect(api.calls, contains('unregisterCommand:plugin.effect.cmd'));
      expect(api.calls, contains('offNoteOpened'));
      expect(plugin.log, ['activate', 'inverse-direct']);
      expect(api.opened, isEmpty);
    });

    test('重新激活后命令与订阅重建', () async {
      final plugin = _EffectPlugin();
      await registry.register(plugin, autoActivate: false);
      await registry.activatePlugin('com.test.effect');
      await registry.pausePlugin('com.test.effect');

      // 清除痕迹，再次激活
      api.calls.clear();
      await registry.activatePlugin('com.test.effect');

      expect(api.calls, contains('registerCommand:plugin.effect.cmd'));
      expect(api.calls, contains('onNoteOpened'));
      expect(registry.isActive('com.test.effect'), true);
    });

    test('销毁插件自动回滚所有副作用', () async {
      final plugin = _EffectPlugin();
      await registry.register(plugin, autoActivate: false);
      await registry.activatePlugin('com.test.effect');

      await registry.disposePlugin('com.test.effect');

      expect(api.calls, contains('unregisterCommand:plugin.effect.cmd'));
      expect(api.calls, contains('offNoteOpened'));
      expect(plugin.log, ['activate', 'inverse-direct']);
      expect(registry.count, 0);
    });

    test('激活失败时部分回滚已登记的副作用', () async {
      final plugin = _FailingEffectPlugin();
      await registry.register(plugin, autoActivate: false);

      final result = await registry.activatePlugin('com.test.failing-effect');

      expect(result, false);
      expect(registry.getState('com.test.failing-effect'), PluginState.error);
      // step1 的逆操作已被执行（部分回滚）
      expect(plugin.log, ['step1', 'inverse-step1']);
    });
  });
}
