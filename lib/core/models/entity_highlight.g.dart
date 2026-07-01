// **************************************************************************
// 手动编写的 Hive TypeAdapter (不依赖 build_runner)
// 适配 EntityType 枚举 + EntityHighlight 模型
// **************************************************************************

import 'package:hive/hive.dart';
import 'note_model.dart';

// ──────────────────────────────────────────────
// EntityType 枚举适配器 (typeId: 2)
// ──────────────────────────────────────────────
/// 将 EntityType 枚举与 Hive 的整数索引互相转换
/// 枚举顺序: concept=0, person=1, task=2, quote=3, reference=4
class EntityTypeAdapter extends TypeAdapter<EntityType> {
  @override
  final int typeId = 2;

  @override
  EntityType read(BinaryReader reader) {
    // 读取一个字节作为枚举索引
    final index = reader.readByte();
    // 防御: 索引越界时回退到 concept
    if (index >= 0 && index < EntityType.values.length) {
      return EntityType.values[index];
    }
    return EntityType.concept;
  }

  @override
  void write(BinaryWriter writer, EntityType obj) {
    // 写入枚举在 values 中的索引
    writer.writeByte(obj.index);
  }
}

// ──────────────────────────────────────────────
// EntityHighlight 模型适配器 (typeId: 1)
// ──────────────────────────────────────────────
/// 序列化 / 反序列化 AI 识别的实体高亮区间
/// 字段顺序 (与 write/read 严格对齐):
///   0: startOffset  (int)
///   1: endOffset    (int)
///   2: type         (EntityType → 通过 typeId=2 的适配器)
///   3: label        (String)
///   4: confidence   (double)
///   5: linkedNoteId (String?, null 用空字符串标记)
class EntityHighlightAdapter extends TypeAdapter<EntityHighlight> {
  @override
  final int typeId = 1;

  @override
  EntityHighlight read(BinaryReader reader) {
    // 读取字段数量 (保留前向兼容能力)
    final numOfFields = reader.readByte();

    // 按字段索引依次读取
    int startOffset = 0;
    int endOffset = 0;
    EntityType type = EntityType.concept;
    String label = '';
    double confidence = 1.0;
    String? linkedNoteId;

    for (int i = 0; i < numOfFields; i++) {
      final fieldIndex = reader.readByte();
      switch (fieldIndex) {
        case 0:
          startOffset = reader.readInt();
          break;
        case 1:
          endOffset = reader.readInt();
          break;
        case 2:
          // 读取枚举索引，然后映射到 EntityType
          final enumIndex = reader.readByte();
          if (enumIndex >= 0 && enumIndex < EntityType.values.length) {
            type = EntityType.values[enumIndex];
          }
          break;
        case 3:
          label = reader.readString();
          break;
        case 4:
          confidence = reader.readDouble();
          break;
        case 5:
          // 空字符串表示 null
          final val = reader.readString();
          linkedNoteId = val.isEmpty ? null : val;
          break;
        default:
          // 跳过未知字段 (前向兼容)
          reader.read();
          break;
      }
    }

    return EntityHighlight(
      startOffset: startOffset,
      endOffset: endOffset,
      type: type,
      label: label,
      confidence: confidence,
      linkedNoteId: linkedNoteId,
    );
  }

  @override
  void write(BinaryWriter writer, EntityHighlight obj) {
    // 写入字段数量
    writer.writeByte(6);

    // 字段 0: startOffset
    writer.writeByte(0);
    writer.writeInt(obj.startOffset);

    // 字段 1: endOffset
    writer.writeByte(1);
    writer.writeInt(obj.endOffset);

    // 字段 2: type (枚举索引)
    writer.writeByte(2);
    writer.writeByte(obj.type.index);

    // 字段 3: label
    writer.writeByte(3);
    writer.writeString(obj.label);

    // 字段 4: confidence
    writer.writeByte(4);
    writer.writeDouble(obj.confidence);

    // 字段 5: linkedNoteId (null → 空字符串)
    writer.writeByte(5);
    writer.writeString(obj.linkedNoteId ?? '');
  }
}
