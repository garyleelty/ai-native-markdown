/// AeroMind 笔记核心数据模型
/// ─────────────────────────────
/// Local-First: 原始 Markdown 存盘，元数据入 Hive/Isar
class NoteModel {
  final String id; // UUID
  final String title; // 首行 H1 或文件名
  final String rawMarkdown; // 原始 Markdown 内容
  final String filePath; // 本地 .md 文件路径
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<String> tags;
  final List<String> backlinks; // [[双向链接]] 指向本笔记的 ID
  final List<String> outgoingLinks; // 本笔记指向的链接
  final List<EntityHighlight> entities; // AI 识别的实体
  final String folderPath; // 所属文件夹路径

  const NoteModel({
    required this.id,
    required this.title,
    required this.rawMarkdown,
    required this.filePath,
    required this.createdAt,
    required this.updatedAt,
    this.tags = const [],
    this.backlinks = const [],
    this.outgoingLinks = const [],
    this.entities = const [],
    this.folderPath = '',
  });

  NoteModel copyWith({
    String? id,
    String? title,
    String? rawMarkdown,
    String? filePath,
    DateTime? updatedAt,
    List<String>? tags,
    List<String>? backlinks,
    List<String>? outgoingLinks,
    List<EntityHighlight>? entities,
    String? folderPath,
  }) {
    return NoteModel(
      id: id ?? this.id,
      title: title ?? this.title,
      rawMarkdown: rawMarkdown ?? this.rawMarkdown,
      filePath: filePath ?? this.filePath,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      tags: tags ?? this.tags,
      backlinks: backlinks ?? this.backlinks,
      outgoingLinks: outgoingLinks ?? this.outgoingLinks,
      entities: entities ?? this.entities,
      folderPath: folderPath ?? this.folderPath,
    );
  }
}

/// AI 识别的实体类型
enum EntityType {
  concept, // 概念
  person, // 人物
  task, // 任务
  quote, // 引文
  reference, // 引用/文献
}

/// 文本中的实体高亮区间
class EntityHighlight {
  final int startOffset; // 在 Markdown 中的起始字符偏移
  final int endOffset; // 结束偏移
  final EntityType type;
  final String label; // 实体名称
  final double confidence; // AI 识别置信度 0..1
  final String? linkedNoteId; // 关联的本地笔记 ID (可为空)

  const EntityHighlight({
    required this.startOffset,
    required this.endOffset,
    required this.type,
    required this.label,
    this.confidence = 1.0,
    this.linkedNoteId,
  });
}
