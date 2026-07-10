/// ══════════════════════════════════════════════════
/// PluginStorage — 插件专属隔离键值存储
/// ══════════════════════════════════════════════════
/// 每个插件拥有独立的存储命名空间，互不干扰。
/// 底层基于 Hive，每个插件使用独立 Box。
/// ──────────────────────────────────────────────────
library;

import 'package:hive_flutter/hive_flutter.dart';

/// 插件隔离存储
///
/// 所有键自动加上插件 ID 前缀，防止命名冲突。
/// 存储在 Hive 的 '_plugins' Box 中。
class PluginStorage {
  final String pluginId;
  final Box<dynamic> _box;

  PluginStorage._({
    required this.pluginId,
    required Box<dynamic> box,
  }) : _box = box;

  /// 工厂方法: 创建或获取插件存储
  static Future<PluginStorage> create(String pluginId) async {
    final box = await Hive.openBox<dynamic>('plugin_$pluginId');
    return PluginStorage._(pluginId: pluginId, box: box);
  }

  /// 带前缀的键名
  String _key(String key) => key;

  // ── 基本读写 ──

  /// 获取字符串值
  String? getString(String key) => _box.get(_key(key)) as String?;

  /// 获取整数值
  int? getInt(String key) => _box.get(_key(key)) as int?;

  /// 获取浮点值
  double? getDouble(String key) => _box.get(_key(key)) as double?;

  /// 获取布尔值
  bool? getBool(String key) => _box.get(_key(key)) as bool?;

  /// 获取字符串列表
  List<String>? getStringList(String key) {
    final raw = _box.get(_key(key));
    if (raw is List) return raw.cast<String>();
    return null;
  }

  /// 获取 Map
  Map<String, dynamic>? getMap(String key) {
    final raw = _box.get(_key(key));
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return null;
  }

  /// 获取任意值
  dynamic get(String key) => _box.get(_key(key));

  /// 检查键是否存在
  bool containsKey(String key) => _box.containsKey(_key(key));

  // ── 写入 ──

  /// 写入值
  Future<void> put(String key, dynamic value) => _box.put(_key(key), value);

  /// 写入字符串
  Future<void> putString(String key, String value) => put(key, value);

  /// 写入整数
  Future<void> putInt(String key, int value) => put(key, value);

  /// 写入浮点数
  Future<void> putDouble(String key, double value) => put(key, value);

  /// 写入布尔值
  Future<void> putBool(String key, bool value) => put(key, value);

  /// 写入字符串列表
  Future<void> putStringList(String key, List<String> value) => put(key, value);

  /// 写入 Map
  Future<void> putMap(String key, Map<String, dynamic> value) => put(key, value);

  // ── 删除 ──

  /// 删除指定键
  Future<void> delete(String key) => _box.delete(_key(key));

  /// 清除此插件所有数据
  Future<void> clear() => _box.clear();

  // ── 枚举 ──

  /// 获取所有键
  Iterable<String> get keys => _box.keys.cast<String>();

  /// 获取所有值
  Iterable<dynamic> get values => _box.values;

  /// 条目数量
  int get length => _box.length;

  /// 是否为空
  bool get isEmpty => _box.isEmpty;

  /// 是否非空
  bool get isNotEmpty => _box.isNotEmpty;

  /// 关闭存储
  Future<void> close() => _box.close();
}
