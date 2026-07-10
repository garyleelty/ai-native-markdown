/// ══════════════════════════════════════════════════
/// HelloPlugin — 插件开发示例模板
/// ══════════════════════════════════════════════════
/// 这是一个最小化的插件示例，展示如何:
///   1. 继承 BasePlugin
///   2. 提供 PluginManifest
///   3. 注册命令
///   4. 监听事件
///   5. 使用存储
///   6. 自定义实体识别
///   7. 内容后处理
///
/// 开发自己的插件时，复制此文件并修改即可。
/// ──────────────────────────────────────────────────
library;

import 'package:aeromind/core/plugin/base_plugin.dart';
import 'package:aeromind/core/plugin/plugin_manifest.dart';
import 'package:aeromind/core/plugin/plugin_api.dart';
import 'package:aeromind/core/models/note_model.dart';

/// 示例插件: 在每篇笔记保存时添加时间戳
class HelloPlugin extends BasePlugin {
  /// 1. 提供清单信息
  @override
  PluginManifest get manifest => const PluginManifest(
        id: 'com.example.hello',
        name: 'Hello 插件',
        version: '1.0.0',
        description: 'AeroMind 插件开发示例：保存时自动添加时间戳',
        author: 'Your Name',
        homepage: 'https://github.com/yourname/hello-plugin',
        extensionTypes: ['command', 'contentProcessor'],
        category: '示例',
        iconCodePoint: 0xe878, // Icons.today
        settings: [
          PluginSettingDef(
            key: 'timestamp_format',
            label: '时间戳格式',
            type: PluginSettingType.choice,
            defaultValue: 'iso',
            choices: ['iso', 'date_only', 'unix'],
            description: '选择保存时添加的时间戳格式',
          ),
          PluginSettingDef(
            key: 'enabled',
            label: '启用自动时间戳',
            type: PluginSettingType.boolean,
            defaultValue: true,
          ),
        ],
      );

  /// 2. 激活时初始化
  @override
  Future<void> onActivate(PluginContext ctx) async {
    // 监听笔记保存事件
    ctx.api.onNoteSaved((noteId) {
      ctx.api.showStatusMessage('已保存: $noteId');
    });

    // 写入初始化标记
    await ctx.storage.putBool('initialized', true);
    await ctx.storage.putInt('activated_at', DateTime.now().millisecondsSinceEpoch);
  }

  /// 3. 注册命令
  @override
  List<PluginCommand> getCommands() {
    return [
      PluginCommand(
        id: 'plugin.hello.greet',
        name: 'Hello: 打个招呼',
        description: '在状态栏显示一条问候语',
        iconCodePoint: 0xe878,
        pluginId: manifest.id,
        action: () async {
          // 实际逻辑需要通过 PluginApi
          // 这里只是演示命令注册
        },
      ),
      PluginCommand(
        id: 'plugin.hello.stats',
        name: 'Hello: 显示统计',
        description: '显示此插件的使用统计',
        iconCodePoint: 0xe878,
        pluginId: manifest.id,
        action: () async {},
      ),
    ];
  }

  /// 4. 自定义实体识别 (可选)
  @override
  Future<List<EntityHighlight>> recognizeEntities(String markdown) async {
    final entities = <EntityHighlight>[];

    // 示例: 识别 email 地址
    final emailPattern = RegExp(r'[\w.-]+@[\w.-]+\.\w+');
    for (final match in emailPattern.allMatches(markdown)) {
      entities.add(EntityHighlight(
        startOffset: match.start,
        endOffset: match.end,
        type: EntityType.person, // 复用 person 类型
        label: match.group(0) ?? '',
        confidence: 0.7,
      ));
    }

    return entities;
  }

  /// 5. 内容后处理 (可选)
  @override
  Future<String?> processContent(String markdown, String noteId) async {
    // 检查是否启用
    final enabled = context?.storage.getBool('enabled') ?? true;
    if (!enabled) return null;

    // 示例: 在文档末尾不添加任何内容 (实际插件可自行实现)
    return null; // 返回 null 表示不修改内容
  }

  /// 6. 销毁时清理
  @override
  Future<void> onDispose() async {
    // 释放资源、取消订阅等
  }
}
