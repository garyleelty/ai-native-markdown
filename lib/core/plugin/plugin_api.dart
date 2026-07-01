/// ══════════════════════════════════════════════════
/// PluginApi — 插件可访问的应用服务接口
/// ══════════════════════════════════════════════════
/// 为插件提供受控的应用内服务访问能力。
/// 插件通过 PluginApi 与宿主应用交互，而非直接访问内部状态。
/// 这是插件系统的安全边界。
/// ──────────────────────────────────────────────────

import '../models/note_model.dart';
import 'plugin_storage.dart';

/// 插件 API 接口 — 插件与宿主应用之间的桥梁
///
/// 设计原则:
///   - 最小权限: 插件只能访问声明的能力对应的 API
///   - 类型安全: 所有接口强类型，避免 dynamic 滥用
///   - 异步优先: 数据库和文件操作均为异步
abstract class PluginApi {
  // ── 笔记操作 ──

  /// 根据 ID 获取笔记
  Future<NoteModel?> getNote(String id);

  /// 获取所有笔记
  Future<List<NoteModel>> getAllNotes();

  /// 保存笔记
  Future<void> saveNote(NoteModel note);

  /// 搜索笔记
  Future<List<NoteModel>> searchNotes(String query);

  /// 获取当前活跃面板的笔记 ID
  String? get activeNoteId;

  /// 获取所有已打开面板的笔记 ID
  List<String> get openNoteIds;

  // ── UI 扩展 ──

  /// 注册一个命令到命令面板
  void registerCommand(PluginCommand command);

  /// 注销由插件注册的命令
  void unregisterCommand(String commandId);

  /// 在状态栏显示一条消息
  void showStatusMessage(String message, {Duration duration});

  /// 显示一条通知 (Snack Bar 风格)
  void showNotification(String message, {NotificationType type});

  // ── 存储 ──

  /// 获取插件专属的键值存储
  PluginStorage getStorage(String pluginId);

  // ── 事件 ──

  /// 监听笔记打开事件
  void onNoteOpened(void Function(String noteId) callback);

  /// 监听笔记保存事件
  void onNoteSaved(void Function(String noteId) callback);

  /// 监听实体识别完成事件
  void onEntitiesRecognized(
    void Function(String noteId, List<EntityHighlight> entities) callback,
  );

  /// 监听面板栈变化事件
  void onPaneStackChanged(void Function(List<String> openNoteIds) callback);

  // ── AI ──

  /// 获取当前 AI 上下文 Prompt (含所有可见面板内容)
  String get aiContextPrompt;

  /// 请求实体重新识别
  Future<List<EntityHighlight>> recognizeEntities(String markdown);
}

/// 插件注册的命令定义
class PluginCommand {
  /// 命令 ID，建议以插件 ID 为前缀
  final String id;

  /// 显示名称
  final String name;

  /// 描述
  final String description;

  /// 图标 codePoint
  final int iconCodePoint;

  /// 快捷键提示文本
  final String? shortcut;

  /// 分类
  final String category;

  /// 执行回调
  final Future<void> Function() action;

  /// 来源插件 ID
  final String pluginId;

  const PluginCommand({
    required this.id,
    required this.name,
    this.description = '',
    this.iconCodePoint = 0xe8b7,
    this.shortcut,
    this.category = '插件',
    required this.action,
    required this.pluginId,
  });
}

/// 通知类型
enum NotificationType {
  info,
  success,
  warning,
  error,
}
