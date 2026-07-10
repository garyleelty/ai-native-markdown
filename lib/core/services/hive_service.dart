import 'package:hive_flutter/hive_flutter.dart';
import '../models/note_model.dart';
import '../models/note_model_adapter.dart';
import '../models/entity_highlight_adapter.dart';

/// ══════════════════════════════════════════════════
/// HiveService — Hive 数据库初始化与管理
/// ══════════════════════════════════════════════════
/// 职责:
///   1. 调用 Hive.initFlutter() 初始化 Hive 存储路径
///   2. 注册所有自定义 TypeAdapter
///   3. 打开 noteBox (LazyBox<NoteModel>) 和 metaBox (Box)
///   4. 提供全局单例访问入口
///
/// 设计:
///   - 使用 LazyBox 延迟加载，仅在访问时反序列化，节省内存
///   - noteBox: 以笔记 ID 为 key，NoteModel 为 value
///   - metaBox: 存储应用级元数据 (如 vaultPath、上次同步时间等)
/// ──────────────────────────────────────────────────

class HiveService {
  // ── Box 名称常量 ──
  static const String noteBoxName = 'notes';
  static const String metaBoxName = 'meta';
  static const String versionBoxName = 'versions';
  static const String trashBoxName = 'trash';

  // ── LazyBox 实例 (延迟加载，内存友好) ──
  static late LazyBox<NoteModel> _noteBox;
  static late Box<dynamic> _metaBox;
  static late Box<dynamic> _versionBox;
  static late Box<NoteModel> _trashBox;

  // ── 初始化标记 ──
  static bool _initialized = false;

  /// 获取笔记存储 Box (只读)
  /// 以笔记 ID 为 key，NoteModel 为 value
  static LazyBox<NoteModel> get noteBox {
    _assertInitialized();
    return _noteBox;
  }

  /// 获取元数据存储 Box (只读)
  /// 用于存储 vaultPath、上次同步时间等全局配置
  static Box<dynamic> get metaBox {
    _assertInitialized();
    return _metaBox;
  }

  /// 获取版本历史 Box (只读)
  /// key: "{noteId}_{timestamp}" → value: {noteId, content, savedAt}
  static Box<dynamic> get versionBox {
    _assertInitialized();
    return _versionBox;
  }

  /// 获取回收站 Box (只读)
  /// key: 原笔记 ID → value: NoteModel (含删除时间在 filePath 中编码)
  static Box<NoteModel> get trashBox {
    _assertInitialized();
    return _trashBox;
  }

  /// 初始化 Hive 数据库
  ///
  /// 必须在 runApp() 之前调用，且在 WidgetsFlutterBinding.ensureInitialized() 之后
  ///
  /// 执行流程:
  ///   1. 初始化 Hive 存储路径 (由 path_provider 提供)
  ///   2. 注册 NoteModel、EntityHighlight、EntityType 的 TypeAdapter
  ///   3. 打开 LazyBox<NoteModel> (笔记数据)
  ///   4. 打开 Box<dynamic> (元数据)
  static Future<void> initHive({String? testPath}) async {
    if (_initialized) return;

    if (testPath != null) {
      Hive.init(testPath);
    } else {
      try {
        await Hive.initFlutter();
      } catch (_) {
        Hive.init('.');
      }
    }

    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(NoteModelAdapter());
    }
    if (!Hive.isAdapterRegistered(1)) {
      Hive.registerAdapter(EntityHighlightAdapter());
    }
    if (!Hive.isAdapterRegistered(2)) {
      Hive.registerAdapter(EntityTypeAdapter());
    }

    if (Hive.isBoxOpen(noteBoxName)) {
      _noteBox = Hive.lazyBox<NoteModel>(noteBoxName);
    } else {
      _noteBox = await Hive.openLazyBox<NoteModel>(noteBoxName);
    }
    if (Hive.isBoxOpen(metaBoxName)) {
      _metaBox = Hive.box<dynamic>(metaBoxName);
    } else {
      _metaBox = await Hive.openBox<dynamic>(metaBoxName);
    }
    if (Hive.isBoxOpen(versionBoxName)) {
      _versionBox = Hive.box<dynamic>(versionBoxName);
    } else {
      _versionBox = await Hive.openBox<dynamic>(versionBoxName);
    }
    if (Hive.isBoxOpen(trashBoxName)) {
      _trashBox = Hive.box<NoteModel>(trashBoxName);
    } else {
      _trashBox = await Hive.openBox<NoteModel>(trashBoxName);
    }

    _initialized = true;
  }

  /// 关闭所有 Box，释放资源
  /// 通常在应用退出时调用
  static Future<void> closeHive() async {
    if (!_initialized) return;
    await _noteBox.close();
    await _metaBox.close();
    await _versionBox.close();
    await _trashBox.close();
    await Hive.close();
    _initialized = false;
  }

  /// 清空所有笔记数据 (危险操作，仅用于开发/测试)
  static Future<void> clearAllNotes() async {
    _assertInitialized();
    await _noteBox.clear();
  }

  /// 清空所有应用数据：笔记、元数据、版本历史、回收站
  /// 危险操作，仅用于"清除所有数据"设置项
  static Future<void> clearAllData() async {
    _assertInitialized();
    await _noteBox.clear();
    await _metaBox.clear();
    await _versionBox.clear();
    await _trashBox.clear();
  }

  /// 断言已初始化，未初始化则抛出异常
  static void _assertInitialized() {
    if (!_initialized) {
      throw StateError(
        'HiveService 尚未初始化！请先调用 await HiveService.initHive()',
      );
    }
  }
}
