/// ══════════════════════════════════════════════════
/// WordCountPlugin — 字数统计插件 (内置示例)
/// ══════════════════════════════════════════════════
/// 展示插件系统的标准用法:
///   - 注册命令
///   - 监听事件
///   - 使用插件存储
///   - 状态栏显示
/// ──────────────────────────────────────────────────
library;

import 'package:flutter/foundation.dart';
import '../plugin/base_plugin.dart';
import '../plugin/plugin_manifest.dart';
import '../plugin/plugin_api.dart';
import '../../features/editor/services/editor_service.dart';

/// 字数统计内置插件
class WordCountPlugin extends BasePlugin {
  @override
  PluginManifest get manifest => const PluginManifest(
        id: 'com.aeromind.wordcount',
        name: '字数统计',
        version: '1.0.0',
        description: '在状态栏显示当前笔记的字数、行数、阅读时间',
        author: 'AeroMind',
        extensionTypes: ['command', 'statusBarItem'],
        category: '工具',
        iconCodePoint: 0xe873, // Icons.format_size
        isBuiltIn: true,
        // 插件设置项：声明后齿轮按钮可见，设置 UI 渲染这些控件
        settings: [
          PluginSettingDef(
            key: 'includeCodeBlocks',
            label: '包含代码块字数',
            type: PluginSettingType.boolean,
            defaultValue: true,
            description: '统计字数时是否包含代码块内容',
          ),
          PluginSettingDef(
            key: 'minThreshold',
            label: '最小显示阈值',
            type: PluginSettingType.number,
            defaultValue: 0,
            description: '字数低于此值时不显示状态栏提示',
          ),
        ],
      );

  @override
  Future<void> onActivate(PluginContext ctx) async {
    // 监听笔记打开事件，更新字数统计
    ctx.api.onNoteOpened((noteId) async {
      await _updateStats(ctx, noteId);
    });
  }

  Future<void> _updateStats(PluginContext ctx, String noteId) async {
    try {
      final note = await ctx.api.getNote(noteId);
      if (note == null) return;

      final stats = EditorService.computeStats(note.rawMarkdown);
      ctx.api.showStatusMessage(
        stats.toString(),
        duration: const Duration(seconds: 5),
      );

      // 缓存统计结果
      await ctx.storage.putString('last_note_id', noteId);
      await ctx.storage.putInt('last_word_count', stats.wordCount);
    } catch (e) {
      debugPrint('Error in word count plugin: $e');
    }
  }

  @override
  List<PluginCommand> getCommands() {
    return [
      PluginCommand(
        id: 'plugin.wordcount.show',
        name: '显示当前笔记字数统计',
        description: '在状态栏显示详细的字数统计信息',
        iconCodePoint: 0xe873,
        pluginId: manifest.id,
        action: () async {
          final api = context?.api;
          if (api == null) return;
          final noteId = api.activeNoteId;
          if (noteId == null) {
            api.showNotification('没有打开的笔记', type: NotificationType.warning);
            return;
          }
          final note = await api.getNote(noteId);
          if (note == null) return;
          final stats = EditorService.computeStats(note.rawMarkdown);
          api.showStatusMessage(
            stats.toString(),
            duration: const Duration(seconds: 5),
          );
          api.showNotification(
            stats.toString(),
            type: NotificationType.info,
          );
        },
      ),
    ];
  }
}
