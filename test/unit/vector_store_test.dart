import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/services/vector_store.dart';

void main() {
  late Directory tempDir;
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_vec_test');
    await HiveService.initHive(testPath: tempDir.path);
  });
  tearDown(() async {
    await HiveService.closeHive();
    await tempDir.delete(recursive: true);
  });

  final store = VectorStore();

  test('upsert 后可按 id 读取', () async {
    await store.upsert(NoteVectorRecord(
      noteId: 'n1', modelId: 'bge-small-zh-v1.5',
      vector: [0.1, 0.2, 0.3], updatedAt: DateTime(2026, 1, 1),
    ));
    final got = await store.get('n1');
    expect(got, isNotNull);
    expect(got!.vector, [0.1, 0.2, 0.3]);
    expect(got.modelId, 'bge-small-zh-v1.5');
  });

  test('覆盖 upsert', () async {
    await store.upsert(NoteVectorRecord(
      noteId: 'n1', modelId: 'm', vector: [1], updatedAt: DateTime(2026, 1, 1)));
    await store.upsert(NoteVectorRecord(
      noteId: 'n1', modelId: 'm', vector: [9], updatedAt: DateTime(2026, 1, 2)));
    expect((await store.get('n1'))!.vector, [9]);
  });

  test('delete 与 clear', () async {
    await store.upsert(NoteVectorRecord(
      noteId: 'n1', modelId: 'm', vector: [1], updatedAt: DateTime(2026, 1, 1)));
    await store.remove('n1');
    expect(await store.get('n1'), isNull);
    await store.upsert(NoteVectorRecord(
      noteId: 'n2', modelId: 'm', vector: [2], updatedAt: DateTime(2026, 1, 1)));
    await store.clear();
    expect(await store.getAll(), isEmpty);
  });

  test('getAll 返回全部', () async {
    for (var i = 0; i < 3; i++) {
      await store.upsert(NoteVectorRecord(
        noteId: 'n$i', modelId: 'm', vector: [i.toDouble()], updatedAt: DateTime(2026, 1, 1)));
    }
    expect((await store.getAll()).length, 3);
  });
}
