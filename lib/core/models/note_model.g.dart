// **************************************************************************
// 手动编写的 Hive TypeAdapter (不依赖 build_runner)
// 适配 NoteModel 核心数据模型 (typeId: 0)
// **************************************************************************

import 'package:hive/hive.dart';
import 'note_model.dart';

/// NoteModel 的 Hive TypeAdapter
///
/// 序列化策略:
///   - 基础类型 (String, int) 直接写入
///   - DateTime → 毫秒时间戳 (int64)
///   - List<String> → 先写长度，再逐个写入字符串
///   - List<EntityHighlight> → 先写长度，再逐个通过内联方式序列化
///     (避免循环依赖 EntityTypeAdapter，直接在此处写入枚举索引)
class NoteModelAdapter extends TypeAdapter<NoteModel> {
  @override
  final int typeId = 0;

  @override
  NoteModel read(BinaryReader reader) {
    // 读取字段数量 (为前向兼容预留)
    final numOfFields = reader.readByte();

    // 临时变量，按字段索引读取
    String id = '';
    String title = '';
    String rawMarkdown = '';
    String filePath = '';
    DateTime createdAt = DateTime.fromMillisecondsSinceEpoch(0);
    DateTime updatedAt = DateTime.fromMillisecondsSinceEpoch(0);
    List<String> tags = [];
    List<String> backlinks = [];
    List<String> outgoingLinks = [];
    List<EntityHighlight> entities = [];

    for (int i = 0; i < numOfFields; i++) {
      final fieldIndex = reader.readByte();
      switch (fieldIndex) {
        case 0:
          id = reader.readString();
          break;
        case 1:
          title = reader.readString();
          break;
        case 2:
          rawMarkdown = reader.readString();
          break;
        case 3:
          filePath = reader.readString();
          break;
        case 4:
          createdAt = DateTime.fromMillisecondsSinceEpoch(reader.readInt());
          break;
        case 5:
          updatedAt = DateTime.fromMillisecondsSinceEpoch(reader.readInt());
          break;
        case 6:
          tags = _readStringList(reader);
          break;
        case 7:
          backlinks = _readStringList(reader);
          break;
        case 8:
          outgoingLinks = _readStringList(reader);
          break;
        case 9:
          entities = _readEntityList(reader);
          break;
        default:
          // 跳过未知字段 (前向兼容)
          reader.read();
          break;
      }
    }

    return NoteModel(
      id: id,
      title: title,
      rawMarkdown: rawMarkdown,
      filePath: filePath,
      createdAt: createdAt,
      updatedAt: updatedAt,
      tags: tags,
      backlinks: backlinks,
      outgoingLinks: outgoingLinks,
      entities: entities,
    );
  }

  @override
  void write(BinaryWriter writer, NoteModel obj) {
    // 写入字段数量
    writer.writeByte(10);

    // 字段 0: id
    writer.writeByte(0);
    writer.writeString(obj.id);

    // 字段 1: title
    writer.writeByte(1);
    writer.writeString(obj.title);

    // 字段 2: rawMarkdown
    writer.writeByte(2);
    writer.writeString(obj.rawMarkdown);

    // 字段 3: filePath
    writer.writeByte(3);
    writer.writeString(obj.filePath);

    // 字段 4: createdAt → 毫秒时间戳
    writer.writeByte(4);
    writer.writeInt(obj.createdAt.millisecondsSinceEpoch);

    // 字段 5: updatedAt → 毫秒时间戳
    writer.writeByte(5);
    writer.writeInt(obj.updatedAt.millisecondsSinceEpoch);

    // 字段 6: tags
    writer.writeByte(6);
    _writeStringList(writer, obj.tags);

    // 字段 7: backlinks
    writer.writeByte(7);
    _writeStringList(writer, obj.backlinks);

    // 字段 8: outgoingLinks
    writer.writeByte(8);
    _writeStringList(writer, obj.outgoingLinks);

    // 字段 9: entities
    writer.writeByte(9);
    _writeEntityList(writer, obj.entities);
  }

  // ── 辅助方法: List<String> 读写 ──

  /// 读取字符串列表: [长度, 字符串1, 字符串2, ...]
  List<String> _readStringList(BinaryReader reader) {
    final length = reader.readInt();
    final list = <String>[];
    for (int i = 0; i < length; i++) {
      list.add(reader.readString());
    }
    return list;
  }

  /// 写入字符串列表
  void _writeStringList(BinaryWriter writer, List<String> list) {
    writer.writeInt(list.length);
    for (final s in list) {
      writer.writeString(s);
    }
  }

  // ── 辅助方法: List<EntityHighlight> 内联序列化 ──
  // 不调用 EntityTypeAdapter，在此内联完成，避免依赖注入复杂度

  /// 读取 EntityHighlight 列表
  List<EntityHighlight> _readEntityList(BinaryReader reader) {
    final length = reader.readInt();
    final list = <EntityHighlight>[];
    for (int i = 0; i < length; i++) {
      list.add(_readEntityInline(reader));
    }
    return list;
  }

  /// 内联读取单个 EntityHighlight
  EntityHighlight _readEntityInline(BinaryReader reader) {
    final startOffset = reader.readInt();
    final endOffset = reader.readInt();
    final enumIndex = reader.readByte();
    final type = (enumIndex >= 0 && enumIndex < EntityType.values.length)
        ? EntityType.values[enumIndex]
        : EntityType.concept;
    final label = reader.readString();
    final confidence = reader.readDouble();
    final linkedNoteIdRaw = reader.readString();
    final linkedNoteId = linkedNoteIdRaw.isEmpty ? null : linkedNoteIdRaw;

    return EntityHighlight(
      startOffset: startOffset,
      endOffset: endOffset,
      type: type,
      label: label,
      confidence: confidence,
      linkedNoteId: linkedNoteId,
    );
  }

  /// 写入 EntityHighlight 列表
  void _writeEntityList(BinaryWriter writer, List<EntityHighlight> list) {
    writer.writeInt(list.length);
    for (final e in list) {
      _writeEntityInline(writer, e);
    }
  }

  /// 内联写入单个 EntityHighlight
  void _writeEntityInline(BinaryWriter writer, EntityHighlight obj) {
    writer.writeInt(obj.startOffset);
    writer.writeInt(obj.endOffset);
    writer.writeByte(obj.type.index);
    writer.writeString(obj.label);
    writer.writeDouble(obj.confidence);
    writer.writeString(obj.linkedNoteId ?? '');
  }
}
