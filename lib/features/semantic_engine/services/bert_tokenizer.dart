/// ══════════════════════════════════════════════════
/// BertTokenizer — 纯 Dart WordPiece 分词器（BERT 风格）
/// ══════════════════════════════════════════════════
/// - 无原生依赖，可在后台 isolate 中使用
/// - fromVocab     从 token→id 映射构建（测试/轻量场景）
/// - fromVocabTxt  从 vocab.txt 加载（每行一个 token，行号即 id）
/// - encode        输出 [CLS] + 子词 + [SEP] 及注意力掩码
/// - 中文逐字切分后按 WordPiece 合并；未登录词映射为 [UNK]
/// ──────────────────────────────────────────────────
library;

/// BERT 风格分词器
class BertTokenizer {
  final Map<String, int> _vocab;

  BertTokenizer._(this._vocab);

  factory BertTokenizer.fromVocab(Map<String, int> vocab) =>
      BertTokenizer._(vocab);

  /// 从 vocab.txt 加载（每行一个 token，行号即 id；BERT 标准格式）
  factory BertTokenizer.fromVocabTxt(String content) {
    final lines = content
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    final vocab = <String, int>{};
    for (var i = 0; i < lines.length; i++) {
      vocab[lines[i]] = i;
    }
    return BertTokenizer._(vocab);
  }

  static const String clsToken = '[CLS]';
  static const String sepToken = '[SEP]';
  static const String unkToken = '[UNK]';
  static const String padToken = '[PAD]';

  int get clsId => _vocab[clsToken] ?? 101;
  int get sepId => _vocab[sepToken] ?? 102;
  int get unkId => _vocab[unkToken] ?? 100;
  int get padId => _vocab[padToken] ?? 0;

  TokenIds encode(String text, {int maxLength = 512}) {
    final tokens = <String>[clsToken];
    for (final word in _basicTokenize(text)) {
      tokens.addAll(_wordPiece(word));
      if (tokens.length >= maxLength - 1) break;
    }
    tokens.add(sepToken);
    if (tokens.length > maxLength) {
      // 保 [CLS] 与 [SEP]，中间截断
      final keep = [
        tokens.first,
        ...tokens.sublist(1, maxLength - 1),
        tokens.last,
      ];
      tokens
        ..clear()
        ..addAll(keep);
    }
    final ids = tokens.map((t) => _vocab[t] ?? unkId).toList();
    return TokenIds(
      inputIds: ids,
      attentionMask: List<int>.filled(ids.length, 1),
      tokenTypeIds: List<int>.filled(ids.length, 0),
    );
  }

  /// 粗切分：中文/英文/数字按空白切分，中文连续片段保持整体
  /// 交由 WordPiece 在整段中文上做最长匹配合并（如 开发学 → 开发 + ##学）
  List<String> _basicTokenize(String text) {
    final cleaned = text
        .toLowerCase()
        .replaceAll(RegExp(r'[^\w\u4e00-\u9fff]+'), ' ')
        .trim();
    final out = <String>[];
    for (final part in cleaned.split(RegExp(r'\s+'))) {
      if (part.isEmpty) continue;
      out.add(part);
    }
    return out;
  }

  /// WordPiece 子词切分，未登录词返回 [UNK]
  List<String> _wordPiece(String word) {
    if (_vocab.containsKey(word)) return [word];
    final pieces = <String>[];
    var start = 0;
    while (start < word.length) {
      var end = word.length;
      String? found;
      while (end > start) {
        final sub = start == 0
            ? word.substring(start, end)
            : '##${word.substring(start, end)}';
        if (_vocab.containsKey(sub)) {
          found = sub;
          break;
        }
        end--;
      }
      if (found == null) return [unkToken];
      pieces.add(found);
      start = end;
    }
    return pieces;
  }
}

/// 编码结果
class TokenIds {
  final List<int> inputIds;
  final List<int> attentionMask;
  final List<int> tokenTypeIds;
  const TokenIds({
    required this.inputIds,
    required this.attentionMask,
    required this.tokenTypeIds,
  });
}
