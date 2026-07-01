/// 反向链接引用详情
class BacklinkReference {
  /// 来源笔记 ID
  final String noteId;

  /// 来源笔记标题
  final String noteTitle;

  /// 引用类型
  final BacklinkType type;

  /// 引用所在的上下文（前后文）
  final String context;

  /// 引用在文本中的起始位置
  final int startOffset;

  /// 引用在文本中的结束位置
  final int endOffset;

  const BacklinkReference({
    required this.noteId,
    required this.noteTitle,
    required this.type,
    required this.context,
    required this.startOffset,
    required this.endOffset,
  });
}

/// 反向链接类型
enum BacklinkType {
  /// 正式双向链接 [[笔记名]]
  linked,

  /// 未链接提及（文本中提到但没有 [[]]）
  unlinked,
}

/// 反向链接分析结果
class BacklinkAnalysis {
  /// 反向链接（其他笔记引用当前笔记）
  final List<BacklinkReference> backlinks;

  /// 前向链接（当前笔记引用其他笔记）
  final List<String> outgoingLinks;

  /// 未链接提及
  final List<BacklinkReference> unlinkedMentions;

  const BacklinkAnalysis({
    this.backlinks = const [],
    this.outgoingLinks = const [],
    this.unlinkedMentions = const [],
  });

  /// 总引用数
  int get totalCount =>
      backlinks.length + unlinkedMentions.length;
}
