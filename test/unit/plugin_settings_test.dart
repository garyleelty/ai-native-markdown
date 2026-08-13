/// PluginStorage 单元测试
///
/// 验证：
/// - string/bool 读写
/// - PluginStorage.create(pluginId) 隔离实例
/// - 未写入时默认值回退（getString 返回 null，UI 层用 ?? defaultValue）
///
/// 使用真实 Hive 初始化（参考 plugin_registry_test.dart），不使用 mock。
library;

import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:aeromind/core/plugin/plugin_storage.dart';

void main() {
  group('PluginStorage', () {
    late Directory tempDir;

    setUpAll(() async {
      // 初始化 Hive 到临时目录 (PluginStorage.create 需要)
      tempDir = await Directory.systemTemp.createTemp('plugin_storage_test_');
      Hive.init(tempDir.path);
    });

    tearDownAll(() async {
      await Hive.close();
      if (tempDir.existsSync()) {
        await tempDir.delete(recursive: true);
      }
    });

    test('getString/putString 基本读写', () async {
      final storage = await PluginStorage.create('com.test.string');

      expect(storage.getString('name'), isNull);

      await storage.putString('name', 'AeroMind');
      expect(storage.getString('name'), 'AeroMind');

      // 覆盖写入
      await storage.putString('name', '新值');
      expect(storage.getString('name'), '新值');
    });

    test('getBool/putBool 基本读写', () async {
      final storage = await PluginStorage.create('com.test.bool');

      expect(storage.getBool('enabled'), isNull);

      await storage.putBool('enabled', true);
      expect(storage.getBool('enabled'), true);

      await storage.putBool('enabled', false);
      expect(storage.getBool('enabled'), false);
    });

    test('未写入时 getString 返回 null，UI 层用 ?? defaultValue 回退', () async {
      final storage = await PluginStorage.create('com.test.default');

      // 未写入 → null
      expect(storage.getString('missing_key'), isNull);

      // 模拟 UI 层 string 类型的默认值回退
      const String defaultValue = 'default-value';
      final String uiValue = storage.getString('missing_key') ?? defaultValue;
      expect(uiValue, 'default-value');

      // 写入后使用真实值
      await storage.putString('missing_key', 'real-value');
      final String uiValue2 = storage.getString('missing_key') ?? defaultValue;
      expect(uiValue2, 'real-value');
    });

    test('未写入时 getBool 返回 null，UI 层用 ?? (defaultValue == true) 回退', () async {
      final storage = await PluginStorage.create('com.test.bool.default');

      expect(storage.getBool('flag'), isNull);

      // defaultValue = true
      const dynamic defaultValueTrue = true;
      final bool uiValueTrue =
          storage.getBool('flag') ?? (defaultValueTrue == true);
      expect(uiValueTrue, true);

      // defaultValue = false（或未设置）
      const dynamic defaultValueFalse = false;
      final bool uiValueFalse =
          storage.getBool('flag') ?? (defaultValueFalse == true);
      expect(uiValueFalse, false);
    });

    test('create(pluginId) 为不同 pluginId 创建隔离实例', () async {
      final storageA = await PluginStorage.create('com.test.isolate.a');
      final storageB = await PluginStorage.create('com.test.isolate.b');

      // 同一 key 在两个实例中独立
      await storageA.putString('shared_key', 'valueA');
      await storageB.putString('shared_key', 'valueB');

      expect(storageA.getString('shared_key'), 'valueA');
      expect(storageB.getString('shared_key'), 'valueB');

      // bool 也独立
      await storageA.putBool('flag', true);
      await storageB.putBool('flag', false);
      expect(storageA.getBool('flag'), true);
      expect(storageB.getBool('flag'), false);
    });

    test('同一 pluginId 的 create 返回同一 box (Hive 缓存)', () async {
      final storage1 = await PluginStorage.create('com.test.cache');
      await storage1.putString('key', 'first');

      final storage2 = await PluginStorage.create('com.test.cache');
      // 同一 box 实例，数据可见
      expect(storage2.getString('key'), 'first');
    });

    test('containsKey / delete 行为', () async {
      final storage = await PluginStorage.create('com.test.ops');

      expect(storage.containsKey('name'), false);
      await storage.putString('name', 'AeroMind');
      expect(storage.containsKey('name'), true);

      await storage.delete('name');
      expect(storage.containsKey('name'), false);
      expect(storage.getString('name'), isNull);
    });
  });
}
