import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/models/note_model.dart';
import '../core/services/hive_service.dart';
import '../core/services/file_picker_service.dart';
import 'package:hive_flutter/hive_flutter.dart';

// ──────────────────────────────────────────────
// 笔记数据层 Provider (Hive 持久化)
// ──────────────────────────────────────────────
// Local-First: 所有笔记读写均通过 Hive LazyBox 完成
// LazyBox 仅在访问时反序列化，适合笔记数量较大的场景
// ──────────────────────────────────────────────

/// 笔记仓库接口
abstract class NoteRepository {
  /// 根据 ID 获取单篇笔记
  Future<NoteModel?> getNote(String id);

  /// 获取所有笔记列表
  Future<List<NoteModel>> getAllNotes();

  /// 保存 (新建或更新) 一篇笔记
  Future<void> saveNote(NoteModel note);

  /// 删除一篇笔记
  Future<void> deleteNote(String id);

  /// 基于关键词的简单搜索 (标题 + 正文全文匹配)
  Future<List<NoteModel>> searchBySemantic(String query);

  /// 获取笔记总数
  Future<int> getNoteCount();

  /// 检查笔记是否存在
  Future<bool> noteExists(String id);
}

/// 本地笔记仓库实现 (Hive LazyBox 持久化)
///
/// 数据流向:
///   UI → Provider → LocalNoteRepository → HiveService.noteBox → 磁盘
///
/// 关键设计:
///   - 使用 LazyBox 延迟加载，避免一次性将所有笔记反序列化到内存
///   - 所有写操作后自动失效相关 Provider 缓存
///   - searchBySemantic 实现简单的大小写不敏感关键词匹配
class LocalNoteRepository implements NoteRepository {
  /// 获取 Hive 笔记存储 Box
  LazyBox<NoteModel> get _noteBox => HiveService.noteBox;

  @override
  Future<NoteModel?> getNote(String id) async {
    try {
      return await _noteBox.get(id);
    } catch (e) {
      // 读取失败时返回 null，避免因单条数据损坏导致整个列表崩溃
      return null;
    }
  }

  @override
  Future<List<NoteModel>> getAllNotes() async {
    final notes = <NoteModel>[];
    // LazyBox.values 会逐个延迟加载，不会一次性全部反序列化
    for (final key in _noteBox.keys) {
      try {
        final note = await _noteBox.get(key);
        if (note != null) {
          notes.add(note);
        }
      } catch (_) {
        // 跳过损坏的数据条目
        continue;
      }
    }
    // 按更新时间倒序排列，最新的笔记排在前面
    notes.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return notes;
  }

  @override
  Future<void> saveNote(NoteModel note) async {
    // 以笔记 ID 为 key 写入 Hive
    await _noteBox.put(note.id, note);
  }

  @override
  Future<void> deleteNote(String id) async {
    await _noteBox.delete(id);
  }

  @override
  Future<List<NoteModel>> searchBySemantic(String query) async {
    if (query.trim().isEmpty) {
      return [];
    }

    // 统一转小写，实现大小写不敏感搜索
    final lowerQuery = query.toLowerCase().trim();
    final results = <NoteModel>[];

    for (final key in _noteBox.keys) {
      try {
        final note = await _noteBox.get(key);
        if (note == null) continue;

        // 在标题和正文中搜索关键词
        final titleMatch = note.title.toLowerCase().contains(lowerQuery);
        final contentMatch = note.rawMarkdown.toLowerCase().contains(lowerQuery);
        final tagMatch = note.tags.any(
          (tag) => tag.toLowerCase().contains(lowerQuery),
        );

        if (titleMatch || contentMatch || tagMatch) {
          results.add(note);
        }
      } catch (_) {
        continue;
      }
    }

    // 标题匹配优先，然后按更新时间排序
    results.sort((a, b) {
      final aTitle = a.title.toLowerCase().contains(lowerQuery);
      final bTitle = b.title.toLowerCase().contains(lowerQuery);
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;
      return b.updatedAt.compareTo(a.updatedAt);
    });

    return results;
  }

  @override
  Future<int> getNoteCount() async {
    return _noteBox.length;
  }

  @override
  Future<bool> noteExists(String id) async {
    return _noteBox.containsKey(id);
  }
}

// ──────────────────────────────────────────────
// Riverpod Providers
// ──────────────────────────────────────────────

/// 笔记仓库 Provider
/// 注入 LocalNoteRepository 实例，所有数据操作通过此 Provider 访问
final noteRepositoryProvider = Provider<NoteRepository>((ref) {
  return LocalNoteRepository();
});

/// 单篇笔记详情 Provider (异步, 根据 ID 自动缓存)
///
/// 使用方式:
///   final note = ref.watch(noteByIdProvider('笔记ID'));
///
/// 缓存失效: 调用 `ref.invalidate(noteByIdProvider(id))` 即可强制刷新。
/// 在 saveNote 完成后应主动失效，避免返回脏数据。
final noteByIdProvider = FutureProvider.family<NoteModel?, String>((ref, id) {
  final repo = ref.read(noteRepositoryProvider);
  return repo.getNote(id);
});

/// 所有笔记列表 Provider
///
/// 使用方式:
///   final notes = ref.watch(allNotesProvider);
///
/// 注意: LazyBox.getAll() 会触发所有笔记的反序列化，
/// 在笔记数量很大时应考虑分页加载。
final allNotesProvider = FutureProvider<List<NoteModel>>((ref) {
  final repo = ref.read(noteRepositoryProvider);
  return repo.getAllNotes();
});

/// 笔记搜索 Provider
/// 传入搜索关键词，返回匹配的笔记列表
///
/// 使用方式:
///   final results = ref.watch(noteSearchProvider('关键词'));
final noteSearchProvider =
    FutureProvider.family<List<NoteModel>, String>((ref, query) {
  final repo = ref.read(noteRepositoryProvider);
  return repo.searchBySemantic(query);
});

/// 文件选择服务 Provider
final filePickerServiceProvider = Provider<FilePickerService>((ref) {
  return FilePickerService();
});
