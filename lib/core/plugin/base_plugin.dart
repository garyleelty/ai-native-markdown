/// ══════════════════════════════════════════════════
/// BasePlugin — 插件抽象基类
/// ══════════════════════════════════════════════════
/// 所有 AeroMind 插件必须继承此类。
/// 提供生命周期钩子和扩展点注册接口。
/// ──────────────────────────────────────────────────

import 'plugin_manifest.dart';
import 'plugin_api.dart';
import 'plugin_storage.dart';
import '../models/note_model.dart';

/// 插件生命周期状态
enum PluginState {
  /// 已注册但未激活
  registered,

  /// 正在初始化
  initializing,

  /// 已激活，正常运行
  active,

  /// 已暂停 (用户手动禁用或依赖缺失)
  paused,

  /// 已销毁
  disposed,

  /// 初始化失败
  error,
}

/// 插件上下文 — 插件激活期间可访问的资源
class PluginContext {
  /// 插件清单
  final PluginManifest manifest;

  /// 插件 API
  final PluginApi api;

  /// 插件专属存储
  final PluginStorage storage;

  /// 当前插件状态
  final PluginState state;

  const PluginContext({
    required this.manifest,
    required this.api,
    required this.storage,
    this.state = PluginState.active,
  });
}

/// AeroMind 插件抽象基类
///
/// 使用示例:
/// ```dart
/// class WordCountPlugin extends BasePlugin {
///   @override
///   PluginManifest get manifest => PluginManifest(
///     id: 'com.example.wordcount',
///     name: '字数统计',
///     version: '1.0.0',
///     description: '在状态栏显示当前笔记的字数',
///     extensionTypes: ['statusBar'],
///   );
///
///   @override
///   Future<void> onActivate(PluginContext ctx) async {
///     ctx.api.onNoteOpened((noteId) {
///       _updateWordCount(ctx, noteId);
///     });
///   }
/// }
/// ```
abstract class BasePlugin {
  /// 插件清单 (子类必须实现)
  PluginManifest get manifest;

  /// 当前插件上下文 (激活后由框架注入)
  PluginContext? _context;
  PluginContext? get context => _context;

  /// 当前状态
  PluginState _state = PluginState.registered;
  PluginState get state => _state;

  /// 是否已激活
  bool get isActive => _state == PluginState.active;

  // ──────────────────────────────────────────────
  // 生命周期钩子 (子类可覆写)
  // ──────────────────────────────────────────────

  /// 插件激活时调用 (初始化资源、注册事件监听等)
  ///
  /// [ctx] 插件上下文，提供 API 和存储访问
  /// 抛出异常会导致插件进入 error 状态
  Future<void> onActivate(PluginContext ctx) async {}

  /// 插件暂停时调用 (释放非必要资源，但保留状态)
  Future<void> onPause() async {}

  /// 插件从暂停恢复时调用
  Future<void> onResume(PluginContext ctx) async {}

  /// 插件销毁时调用 (释放所有资源、注销所有注册)
  ///
  /// 注意: 此方法中不要再访问 PluginApi，因为宿主已开始清理
  Future<void> onDispose() async {}

  // ──────────────────────────────────────────────
  // 扩展点钩子 (子类可覆写)
  // ──────────────────────────────────────────────

  /// 自定义实体识别器
  ///
  /// 接收 Markdown 文本，返回插件识别出的实体列表。
  /// 返回空列表表示此插件不参与实体识别。
  Future<List<EntityHighlight>> recognizeEntities(String markdown) async => [];

  /// 自定义内容处理器
  ///
  /// 在笔记保存前对内容进行后处理。
  /// 返回 null 表示不修改内容；返回修改后的 Markdown。
  Future<String?> processContent(String markdown, String noteId) async => null;

  /// 自定义搜索结果增强
  ///
  /// 接收原始搜索结果列表，可添加、移除或重新排序。
  Future<List<NoteModel>> enhanceSearchResults(
    List<NoteModel> results,
    String query,
  ) async =>
      results;

  /// 自定义命令注册
  ///
  /// 返回此插件要注册到命令面板的命令列表。
  /// 空列表表示此插件不提供命令。
  List<PluginCommand> getCommands() => [];

  // ──────────────────────────────────────────────
  // 内部方法 (由框架调用，插件作者不应直接调用)
  // ──────────────────────────────────────────────

  /// 框架调用: 激活插件
  Future<void> activate(PluginContext ctx) async {
    _context = ctx;
    _state = PluginState.initializing;
    try {
      await onActivate(ctx);
      _state = PluginState.active;
    } catch (e) {
      _state = PluginState.error;
      rethrow;
    }
  }

  /// 框架调用: 暂停插件
  Future<void> pause() async {
    _state = PluginState.paused;
    await onPause();
  }

  /// 框架调用: 恢复插件
  Future<void> resume(PluginContext ctx) async {
    _context = ctx;
    _state = PluginState.active;
    await onResume(ctx);
  }

  /// 框架调用: 销毁插件
  Future<void> dispose() async {
    _state = PluginState.disposed;
    await onDispose();
    _context = null;
  }
}
