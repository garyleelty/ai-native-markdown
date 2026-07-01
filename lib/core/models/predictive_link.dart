/// 预测性关联链接模型
/// 当用户在面板 A 书写时，系统自动推荐面板 B 中可能关联的笔记
class PredictiveLink {
  final String sourceNoteId; // 来源笔记 ID
  final String targetNoteId; // 推荐关联的目标笔记 ID
  final String targetTitle; // 目标笔记标题
  final double relevance; // 相关度 0..1
  final String reason; // AI 给出的推荐理由

  const PredictiveLink({
    required this.sourceNoteId,
    required this.targetNoteId,
    required this.targetTitle,
    required this.relevance,
    required this.reason,
  });
}

/// 推荐类型
enum LinkSuggestionType {
  /// 基于内容语义相似度
  semantic,

  /// 基于共同标签
  tagBased,

  /// 基于共同引用 (A→B, A→C, 推荐 B↔C)
  coReference,

  /// 基于最近编辑时间
  recency,
}

/// 预测链接计算服务
///
/// 从所有笔记中为当前笔记推荐可能需要关联的链接。
/// 使用关键词相似度 (TF-IDF 简化版) + 标签匹配。
class PredictiveLinkService {
  /// 从所有笔记中为当前笔记推荐链接
  ///
  /// [currentNoteId] 当前笔记 ID
  /// [currentContent] 当前笔记内容
  /// [currentTags] 当前笔记标签
  /// [allNotes] 所有笔记列表 (id, title, content, tags)
  /// [maxResults] 最大推荐数
  static List<PredictiveLink> recommend({
    required String currentNoteId,
    required String currentContent,
    required List<String> currentTags,
    required List<NoteInfoForLink> allNotes,
    int maxResults = 5,
  }) {
    if (currentContent.trim().isEmpty) return [];

    final results = <PredictiveLink>[];
    final currentWords = _extractKeywords(currentContent.toLowerCase());

    for (final note in allNotes) {
      if (note.id == currentNoteId) continue;

      double score = 0.0;
      String reason = '';

      // 1. 关键词相似度
      final noteWords = _extractKeywords(note.content.toLowerCase());
      final intersection = currentWords.intersection(noteWords);
      if (intersection.isNotEmpty && currentWords.isNotEmpty) {
        final keywordScore = intersection.length /
            (currentWords.length + noteWords.length - intersection.length);
        score += keywordScore * 0.6;
        reason = '共同关键词: ${intersection.take(3).join(', ')}';
      }

      // 2. 标签相似度
      if (currentTags.isNotEmpty && note.tags.isNotEmpty) {
        final commonTags =
            currentTags.where((t) => note.tags.contains(t)).length;
        if (commonTags > 0) {
          score += (commonTags /
                  (currentTags.length + note.tags.length - commonTags)) *
              0.3;
          reason = reason.isEmpty
              ? '共同标签'
              : '$reason · 共同标签';
        }
      }

      // 3. 标题词出现在正文中
      final titleWords = _extractKeywords(note.title.toLowerCase());
      final titleInContent =
          titleWords.where((w) => currentWords.contains(w)).length;
      if (titleInContent > 0 && titleWords.isNotEmpty) {
        score += (titleInContent / titleWords.length) * 0.1;
      }

      if (score > 0.05) {
        results.add(PredictiveLink(
          sourceNoteId: currentNoteId,
          targetNoteId: note.id,
          targetTitle: note.title,
          relevance: score.clamp(0.0, 1.0),
          reason: reason,
        ));
      }
    }

    // 按分数降序排列，取 Top-K
    results.sort((a, b) => b.relevance.compareTo(a.relevance));
    return results.take(maxResults).toList();
  }

  /// 提取关键词 (中文片段 + 英文单词，去停用词)
  static Set<String> _extractKeywords(String text) {
    final cleaned = text
        .replaceAll(RegExp(r'[\[\]()#*`>_~\-|]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    final words = <String>{};

    // 中文: 提取连续中文片段 (>=2 字)
    for (final match in RegExp(r'[\u4e00-\u9fff]{2,}').allMatches(cleaned)) {
      words.add(match.group(0)!);
    }

    // 英文: 提取 >=3 字符的单词
    for (final match in RegExp(r'[a-zA-Z]{3,}').allMatches(cleaned)) {
      final word = match.group(0)!.toLowerCase();
      if (!_stopWords.contains(word)) {
        words.add(word);
      }
    }

    return words;
  }

  static const _stopWords = {
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
    'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
    'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get',
    'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no',
  };
}

/// 笔记信息 (用于推荐计算的简化模型)
class NoteInfoForLink {
  final String id;
  final String title;
  final String content;
  final List<String> tags;

  const NoteInfoForLink({
    required this.id,
    required this.title,
    required this.content,
    this.tags = const [],
  });
}
