import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';
import '../core/models/note_model.dart';
import '../core/services/hive_service.dart';
import '../core/services/file_picker_service.dart';
import '../core/services/file_service.dart';
import 'package:hive_flutter/hive_flutter.dart';

enum NoteChangeType { saved, deleted }

class NoteChangeEvent {
  final NoteChangeType type;
  final String noteId;
  const NoteChangeEvent(this.type, this.noteId);
}

abstract class NoteRepository {
  Stream<NoteChangeEvent> get changes;
  Future<NoteModel?> getNote(String id);
  Future<List<NoteModel>> getAllNotes();
  Future<NoteModel> saveNote(NoteModel note);
  Future<void> deleteNote(String id);
  Future<List<NoteModel>> searchBySemantic(String query);
  Future<int> getNoteCount();
  Future<bool> noteExists(String id);
  String generateId();
  void dispose();
}

class LocalNoteRepository implements NoteRepository {
  static const _uuid = Uuid();
  final _changesController = StreamController<NoteChangeEvent>.broadcast();

  LazyBox<NoteModel> get _noteBox => HiveService.noteBox;

  @override
  Stream<NoteChangeEvent> get changes => _changesController.stream;

  @override
  Future<NoteModel?> getNote(String id) async {
    try {
      return await _noteBox.get(id);
    } catch (e) {
      return null;
    }
  }

  @override
  Future<List<NoteModel>> getAllNotes() async {
    final notes = <NoteModel>[];
    for (final key in _noteBox.keys) {
      try {
        final note = await _noteBox.get(key);
        if (note != null) {
          notes.add(note);
        }
      } catch (_) {
        continue;
      }
    }
    notes.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return notes;
  }

  @override
  Future<NoteModel> saveNote(NoteModel note) async {
    final now = DateTime.now();
    final id = note.id.isEmpty ? generateId() : note.id;
    final updated = note.copyWith(
      id: id,
      updatedAt: now,
    );
    await _noteBox.put(updated.id, updated);
    _changesController.add(NoteChangeEvent(NoteChangeType.saved, updated.id));
    return updated;
  }

  @override
  Future<void> deleteNote(String id) async {
    await _noteBox.delete(id);
    _changesController.add(NoteChangeEvent(NoteChangeType.deleted, id));
  }

  @override
  Future<List<NoteModel>> searchBySemantic(String query) async {
    if (query.trim().isEmpty) {
      return [];
    }

    final lowerQuery = query.toLowerCase().trim();
    final results = <NoteModel>[];

    for (final key in _noteBox.keys) {
      try {
        final note = await _noteBox.get(key);
        if (note == null) continue;

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

  @override
  String generateId() => _uuid.v4();

  @override
  void dispose() {
    _changesController.close();
  }
}

final noteRepositoryProvider = Provider<NoteRepository>((ref) {
  final repo = LocalNoteRepository();
  ref.onDispose(() => repo.dispose());
  return repo;
});

final noteByIdProvider = FutureProvider.family<NoteModel?, String>((ref, id) async {
  final repo = ref.watch(noteRepositoryProvider);
  final sub = repo.changes.where((e) => e.noteId == id).listen((_) {
    ref.invalidateSelf();
  });
  ref.onDispose(() => sub.cancel());
  return repo.getNote(id);
});

final allNotesProvider = FutureProvider<List<NoteModel>>((ref) async {
  final repo = ref.watch(noteRepositoryProvider);
  final sub = repo.changes.listen((_) => ref.invalidateSelf());
  ref.onDispose(() => sub.cancel());
  return repo.getAllNotes();
});

final noteSearchProvider =
    FutureProvider.family<List<NoteModel>, String>((ref, query) {
  final repo = ref.watch(noteRepositoryProvider);
  return repo.searchBySemantic(query);
});

final filePickerServiceProvider = Provider<FilePickerService>((ref) {
  return FilePickerService();
});

String _defaultVaultRoot() {
  if (kIsWeb) {
    return '/aeromind';
  }
  final home = Platform.environment['HOME'] ?? Platform.environment['USERPROFILE'] ?? '/tmp';
  return p.join(home, 'Aeromind');
}

final vaultRootProvider = Provider<String>((ref) {
  return _defaultVaultRoot();
});

final fileServiceProvider = Provider<FileService>((ref) {
  final root = ref.watch(vaultRootProvider);
  final service = FileService(vaultRoot: root);
  return service;
});

class NoteNotifier extends Notifier<void> {
  @override
  void build() {}

  Future<NoteModel> saveNote(NoteModel note) async {
    final repo = ref.read(noteRepositoryProvider);
    return repo.saveNote(note);
  }

  Future<void> deleteNote(String id) async {
    final repo = ref.read(noteRepositoryProvider);
    await repo.deleteNote(id);
  }

  String generateId() {
    final repo = ref.read(noteRepositoryProvider);
    return repo.generateId();
  }
}

final noteNotifierProvider = NotifierProvider<NoteNotifier, void>(() {
  return NoteNotifier();
});
