import 'package:aeromind/core/models/note_model.dart';

/// 模糊匹配区间（字符索引，用于 UI 高亮）
class MatchRange {
  /// 区间起始字符索引（包含）
  final int start;

  /// 区间结束字符索引（不包含）
  final int end;

  const MatchRange({required this.start, required this.end});
}

/// 模糊匹配结果
class FuzzyMatchResult {
  /// 匹配到的笔记 ID
  final String noteId;

  /// 综合得分（越高越相关）
  final double score;

  /// 标题中的匹配区间（用于 UI 高亮）
  final List<MatchRange> matchedRanges;

  const FuzzyMatchResult({
    required this.noteId,
    required this.score,
    required this.matchedRanges,
  });
}

/// 模糊匹配器
///
/// 算法：子序列匹配 + 加分规则
/// - 连续匹配字符 +1（每个连续位置）
/// - 首字母匹配 +2
/// - 大小写完全匹配 +1（每个字符）
/// - 标题命中权重 ×3（相对正文）
///
/// 设计参考 Obsidian Quick Switcher 的模糊匹配策略，
/// 自实现以避免引入第三方 fuzzy 包，控制依赖膨胀。
class FuzzyMatcher {
  /// 返回结果数量上限（性能保护，避免长列表卡顿）
  static const int _maxResults = 50;

  /// 标题命中权重倍数（标题匹配优先于正文）
  static const double _titleWeightMultiplier = 3.0;

  /// 对一组笔记执行模糊匹配
  ///
  /// 返回按 score 降序排列的前 50 条结果；score=0 的不返回。
  /// 空查询返回空列表（不抛异常）。
  static List<FuzzyMatchResult> match(String query, List<NoteModel> notes) {
    if (query.isEmpty) return const [];

    final results = <FuzzyMatchResult>[];

    for (final note in notes) {
      final titleMatch = _matchString(query, note.title);
      final bodyMatch = _matchString(query, note.rawMarkdown);

      final titleScore = (titleMatch?.$1 ?? 0) * _titleWeightMultiplier;
      final bodyScore = bodyMatch?.$1 ?? 0;

      // 取标题（×3）与正文（×1）中的最高分
      final bestScore = titleScore > bodyScore ? titleScore : bodyScore;
      if (bestScore <= 0) continue;

      // matchedRanges 仅取标题中的匹配区间（用于 UI 高亮）
      List<MatchRange> ranges;
      if (titleMatch != null && titleScore >= bodyScore) {
        ranges = titleMatch.$2;
      } else {
        ranges = const <MatchRange>[];
      }

      results.add(FuzzyMatchResult(
        noteId: note.id,
        score: bestScore,
        matchedRanges: ranges,
      ));
    }

    // 按 score 降序排序
    results.sort((a, b) => b.score.compareTo(a.score));

    // 截断为前 50 条
    if (results.length > _maxResults) {
      return results.sublist(0, _maxResults);
    }
    return results;
  }

  /// 在单个字符串中执行子序列匹配并打分
  ///
  /// 返回 (score, matchedRanges) 或 null（无匹配）。
  static (double, List<MatchRange>)? _matchString(String query, String text) {
    if (query.isEmpty || text.isEmpty) return null;
    if (query.length > text.length) return null;

    // 贪心子序列匹配：在 text 中按顺序找到 query 的每个字符
    final matchedPositions = <int>[];
    int ti = 0;
    for (int qi = 0; qi < query.length; qi++) {
      final qc = query[qi];
      final qcLower = qc.toLowerCase();
      bool found = false;
      while (ti < text.length) {
        if (text[ti].toLowerCase() == qcLower) {
          matchedPositions.add(ti);
          ti++;
          found = true;
          break;
        }
        ti++;
      }
      if (!found) return null;
    }

    // 计算得分
    double score = 0;

    // 首字母匹配 +2（匹配位置在文本起始处）
    if (matchedPositions.first == 0) {
      score += 2;
    }

    for (int i = 0; i < matchedPositions.length; i++) {
      final pos = matchedPositions[i];
      // 大小写完全匹配 +1
      if (query[i] == text[pos]) {
        score += 1;
      }
      // 连续匹配 +1（当前位置紧接前一个匹配位置）
      if (i > 0 && matchedPositions[i] == matchedPositions[i - 1] + 1) {
        score += 1;
      }
    }

    // 合并连续位置为区间，用于 UI 高亮
    final ranges = <MatchRange>[];
    int rangeStart = matchedPositions.first;
    int rangeEnd = rangeStart + 1;
    for (int i = 1; i < matchedPositions.length; i++) {
      if (matchedPositions[i] == matchedPositions[i - 1] + 1) {
        rangeEnd = matchedPositions[i] + 1;
      } else {
        ranges.add(MatchRange(start: rangeStart, end: rangeEnd));
        rangeStart = matchedPositions[i];
        rangeEnd = rangeStart + 1;
      }
    }
    ranges.add(MatchRange(start: rangeStart, end: rangeEnd));

    return (score, ranges);
  }
}
