/// ══════════════════════════════════════════════════
/// PluginManifest — 插件清单描述文件
/// ══════════════════════════════════════════════════
/// 插件的身份信息、版本、依赖、扩展点声明。
/// 每个插件必须提供一个 Manifest 实例。
/// ──────────────────────────────────────────────────

/// 插件清单，描述插件的元信息和能力声明
class PluginManifest {
  /// 唯一标识符，反域名格式，如 'com.aeromind.wordcount'
  final String id;

  /// 插件显示名称
  final String name;

  /// 版本号，语义化版本
  final String version;

  /// 简短描述
  final String description;

  /// 作者名称
  final String author;

  /// 插件主页 URL (可选)
  final String? homepage;

  /// 最低 AeroMind 版本要求
  final String? minAppVersion;

  /// 此插件声明的扩展点类型列表
  /// 例如: [ExtensionType.command, ExtensionType.entityRecognizer]
  final List<String> extensionTypes;

  /// 此插件依赖的其他插件 ID 列表
  final List<String> dependencies;

  /// 插件图标 (Material Icons codePoint，0 表示使用默认)
  final int iconCodePoint;

  /// 插件分类标签
  final String category;

  /// 是否默认启用 (新安装时自动激活)
  final bool enabledByDefault;

  /// 允许插件自定义的设置项列表
  final List<PluginSettingDef> settings;

  const PluginManifest({
    required this.id,
    required this.name,
    required this.version,
    this.description = '',
    this.author = '',
    this.homepage,
    this.minAppVersion,
    this.extensionTypes = const [],
    this.dependencies = const [],
    this.iconCodePoint = 0xe8b7, // Icons.extension
    this.category = '通用',
    this.enabledByDefault = true,
    this.settings = const [],
  });

  /// 生成默认的存储键前缀
  String get storagePrefix => 'plugin_$id';
}

/// 插件可配置的设置项定义
class PluginSettingDef {
  /// 设置键名
  final String key;

  /// 显示名称
  final String label;

  /// 设置类型
  final PluginSettingType type;

  /// 默认值
  final dynamic defaultValue;

  /// 描述
  final String description;

  /// 仅对 choice 类型有效：可选值列表
  final List<String> choices;

  const PluginSettingDef({
    required this.key,
    required this.label,
    this.type = PluginSettingType.string,
    this.defaultValue,
    this.description = '',
    this.choices = const [],
  });
}

/// 插件设置类型
enum PluginSettingType {
  string,   // 文本输入
  number,   // 数值
  boolean,  // 开关
  choice,   // 下拉选择
}
