# 语义引擎实施计划 — 本地向量模型驱动推荐与语义搜索

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用可选的本地 embedding 模型（`onnxruntime_v2` + bge 中文模型）替换 TF-IDF 规则推荐，并接通语义搜索，全部带降级回退。

**Architecture:** 新增 `lib/features/semantic_engine/` 模块。用户可在设置页选择是否下载模型及档位（轻量 bge-small-zh 512 维 / 高质量 bge-base-zh 768 维）。推理放独立 isolate。向量持久化用 **Hive `vectors` box**（见「与规格的偏差」）。任何失败静默回退现有 TF-IDF/关键词路径。

**Tech Stack:** Flutter / Riverpod Notifier / Hive / `onnxruntime_v2` (dart:ffi) / 纯 Dart WordPiece tokenizer / dart:io HttpClient（断点续传）

---

## 与规格的偏差（重要）

规格写的是「向量存 Isar」。实地勘察发现 **Isar 3.1 在项目里从未初始化**（仅声明在 pubspec，无 schema、无 `Isar.open`、无 build_runner 产物），而 Hive 已完整接入且测试模式成熟（`HiveService.initHive(testPath:)`）。向量存储本质是 `noteId → List<double>`，且设计决策已是「内存缓存 + 余弦全量扫描，无 ANN 索引」，因此 **改用 Hive `vectors` box 实现同一语义，零新增基础设施、零 codegen 风险**。Isar 3.1 也没有向量索引，接入它不改变任何行为，只会增加构建/测试复杂度。

---

## 文件结构

**新建：**
- `lib/features/semantic_engine/models/model_tier.dart` — 档位枚举 + 下载配置（URL/维度/体积/hash）
- `lib/features/semantic_engine/services/bert_tokenizer.dart` — WordPiece 分词器
- `lib/features/semantic_engine/services/embedding_service.dart` — `Embedder` 接口 + isolate 推理实现
- `lib/features/semantic_engine/services/model_download_service.dart` — 断点续传下载
- `lib/features/semantic_engine/services/vector_store.dart` — Hive 向量持久化
- `lib/features/semantic_engine/services/semantic_scoring.dart` — 余弦 + 混合评分
- `lib/features/semantic_engine/providers/model_status_provider.dart` — 状态机
- `lib/features/semantic_engine/providers/vector_index_provider.dart` — 内存索引 + 最近邻
- `lib/features/semantic_engine/providers/semantic_search_provider.dart` — 语义搜索

**修改：**
- `pubspec.yaml` — 加 `onnxruntime_v2`
- `lib/core/services/hive_service.dart` — 加 `vectors` box
- `lib/providers/settings_provider.dart` — 加 `semanticEngineEnabled` / `semanticModelTier`
- `lib/features/settings/widgets/settings_page.dart` — 加「本地语义引擎」分组
- `lib/providers/ai_provider.dart` — `predictiveLinksProvider` 语义路径
- `lib/providers/sidebar_provider.dart` — 搜索合并语义结果
- `lib/core/models/predictive_link.dart` — `_extractKeywords` 公开化复用

**测试：**
- `test/unit/bert_tokenizer_test.dart`
- `test/unit/semantic_scoring_test.dart`
- `test/unit/vector_store_test.dart`
- `test/unit/model_download_service_test.dart`
- `test/unit/vector_index_test.dart`
- `test/unit/semantic_recommendation_test.dart`
- `test/fixtures/vocab.json` — 微型词表 fixture

---

### Task 1: Spike — onnxruntime_v2 构建验证 + 模型文件确认

前置验证，非 TDD。目标：确认原生库在 macOS 可编译、锁定真实 API 名、确认模型 URL 可达并记录 SHA-256。

**Files:**
- Modify: `pubspec.yaml`
- Create: `lib/features/semantic_engine/spike/spike_main.dart`

- [ ] **Step 1: 添加依赖**

```yaml
# pubspec.yaml dependencies 中新增
  onnxruntime_v2: ^1.23.2+2
```

- [ ] **Step 2: 拉取依赖并确认 import 路径**

```bash
flutter pub get
```

然后创建 spike 入口，import `package:onnxruntime_v2/onnxruntime.dart`。若该 import 名不对，用 `ls ~/.pub-cache/hosted/pub.dev/onnxruntime_v2-*/lib/` 查看真实库名并调整。

- [ ] **Step 3: 写最小推理 smoke**

```dart
// lib/features/semantic_engine/spike/spike_main.dart
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:onnxruntime_v2/onnxruntime.dart';

/// 临时 spike：验证 onnxruntime_v2 可加载 ONNX 并推理。
/// 运行: flutter run -d macos --dart-define=SPIKE=1
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final dir = Directory.systemTemp.createTempSync('ort_spike');
  final modelUrl = 'https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/main/onnx/model.onnx';
  final modelPath = '${dir.path}/model.onnx';
  final f = await File(modelPath).create();
  final resp = await HttpClient().getUrl(Uri.parse(modelUrl));
  final stream = await resp.close();
  final sink = f.openWrite();
  await stream.pipe(sink);
  await sink.close();
  print('model bytes: ${await File(modelPath).length()}');

  OrtEnv.instance.init();
  final opts = OrtSessionOptions();
  opts.appendDefaultProviders();
  final bytes = await File(modelPath).readAsBytes();
  final session = await OrtSession.fromBuffer(bytes, opts);
  final input = OrtValueTensor.createTensorWithDataList(
      List<int>.filled(32, 101), [1, 32]);
  final mask = OrtValueTensor.createTensorWithDataList(
      List<int>.filled(32, 1), [1, 32]);
  final seg = OrtValueTensor.createTensorWithDataList(
      List<int>.filled(32, 0), [1, 32]);
  final runOpts = OrtRunOptions();
  final outputs = await session.runAsync(runOpts, {
    'input_ids': input,
    'attention_mask': mask,
    'token_type_ids': seg,
  });
  final hidden = outputs![0]!;
  print('output shape: ${hidden.shape}');
  print('SPIKE_OK');
  input.release(); mask.release(); seg.release(); runOpts.release();
  for (final o in outputs) { o?.release(); }
  exit(0);
}
```

- [ ] **Step 4: 构建并运行**

```bash
flutter run -d macos --dart-define=SPIKE=1
```

Expected: 输出 `output shape: [1, 32, 768]`（若实际为 512 或其它维度，以实际为准，记录到 Task 2）与 `SPIKE_OK`。若 macOS 构建失败（原生库/Swift 版本问题），**立即停止**并回报，不继续后续任务。

- [ ] **Step 5: 验证两个档位模型 + vocab 的 URL 可达，记录 SHA-256**

```bash
# 下载并计算 hash（值记录进 Task 2 的 ModelTier 常量）
curl -sL -o /tmp/bge-small.onnx https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/main/onnx/model.onnx
shasum -a 256 /tmp/bge-small.onnx
curl -sL -o /tmp/bge-small-vocab.json https://huggingface.co/Xenova/bge-small-zh-v1.5/resolve/main/vocab.json
shasum -a 256 /tmp/bge-small-vocab.json
curl -sIL https://huggingface.co/Xenova/bge-base-zh-v1.5/resolve/main/onnx/model.onnx
curl -sL -o /tmp/bge-base-vocab.json https://huggingface.co/Xenova/bge-base-zh-v1.5/resolve/main/vocab.json
shasum -a 256 /tmp/bge-base-vocab.json
```

若 base 模型 URL 404，替换为 HuggingFace 上 `Xenova/bge-base-zh-v1.5` 仓库实际路径（spike 里用 HF API 列目录确认）。记录三个 hash。

- [ ] **Step 6: 删除 spike 文件，提交依赖**

```bash
rm -rf lib/features/semantic_engine/spike
git add pubspec.yaml pubspec.lock
git commit -m "chore(deps): 引入 onnxruntime_v2 依赖（spike 验证通过）"
```

---

### Task 2: ModelTier 配置

**Files:**
- Create: `lib/features/semantic_engine/models/model_tier.dart`
- Test: `test/unit/model_tier_test.dart`

- [ ] **Step 1: 写失败测试**

```dart
// test/unit/model_tier_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/semantic_engine/models/model_tier.dart';

void main() {
  group('ModelTier', () {
    test('两档配置有效', () {
      expect(ModelTier.values.length, 2);
      expect(ModelTier.light.dims, greaterThan(0));
      expect(ModelTier.base.dims, greaterThan(ModelTier.light.dims));
    });
    test('byId 查找', () {
      expect(ModelTier.byId(ModelTier.light.id), ModelTier.light);
      expect(ModelTier.byId(ModelTier.base.id), ModelTier.base);
    });
  });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/unit/model_tier_test.dart`
Expected: FAIL（找不到 ModelTier）

- [ ] **Step 3: 实现**

> **Spike 实测修正（必须遵守）**：import 是 `package:onnxruntime_v2/onnxruntime_v2.dart`（非 `onnxruntime.dart`）；模型仓库**无 vocab.json**，词表文件是 `vocab.txt`（每行一个 token，行号即 token id）；small 模型实际维度 **512**；small model.onnx SHA-256 = `69a0b846f4f116b5e6aabf9546ea6754d02264f3211a13a1bd69b31b8040749a`。

```dart
// lib/features/semantic_engine/models/model_tier.dart
/// 语义模型档位
enum ModelTier {
  /// 轻量: bge-small-zh-v1.5 (512 维)
  light(
    'bge-small-zh-v1.5',
    512,
    '~95MB fp32（可换 int8 ~25MB）',
    '69a0b846f4f116b5e6aabf9546ea6754d02264f3211a13a1bd69b31b8040749a',
  ),
  /// 高质量: bge-base-zh-v1.5 (768 维)
  base(
    'bge-base-zh-v1.5',
    768,
    '~180MB fp32',
    '', // spike 仅确认 URL 可达；首次下载时记录后填入
  );

  const ModelTier(this.id, this.dims, this.sizeLabel, this.modelHash);

  final String id;
  final int dims;
  final String sizeLabel;
  final String modelHash;

  String get onnxUrl =>
      'https://huggingface.co/Xenova/$id/resolve/main/onnx/model.onnx';

  /// 词表文件：repo 无 vocab.json，真实文件是 vocab.txt（每行一个 token，行号即 id）
  String get vocabUrl =>
      'https://huggingface.co/Xenova/$id/resolve/main/vocab.txt';

  /// SHA-256；base 档位在首次下载后补齐
  String? get expectedHash => modelHash.isEmpty ? null : modelHash;

  static ModelTier byId(String id) =>
      ModelTier.values.firstWhere((t) => t.id == id,
          orElse: () => ModelTier.light);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/unit/model_tier_test.dart`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/semantic_engine/models/model_tier.dart test/unit/model_tier_test.dart
git commit -m "feat(semantic): 定义模型档位配置"
```

---

### Task 3: BertTokenizer（TDD）

**Files:**
- Create: `lib/features/semantic_engine/services/bert_tokenizer.dart`
- Test: `test/unit/bert_tokenizer_test.dart`
- Create: `test/fixtures/vocab.json`

- [ ] **Step 1: 写微型词表 fixture**

```json
// test/fixtures/vocab.json
{
  "[PAD]": 0, "[UNK]": 100, "[CLS]": 101, "[SEP]": 102,
  "flutter": 2024, "dart": 2025, "开发": 3001, "应用": 3002,
  "##kit": 2026, "##后端": 3003, "##学": 3004
}
```

- [ ] **Step 2: 写失败测试**

```dart
// test/unit/bert_tokenizer_test.dart
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/semantic_engine/services/bert_tokenizer.dart';

Map<String, int> _loadVocab() {
  final raw = File('test/fixtures/vocab.json').readAsStringSync();
  final map = jsonDecode(raw) as Map<String, dynamic>;
  return map.map((k, v) => MapEntry(k, v as int));
}

void main() {
  late BertTokenizer tokenizer;
  setUp(() => tokenizer = BertTokenizer.fromVocab(_loadVocab()));

  test('英文词被 WordPiece 拆分', () {
    final t = tokenizer.encode('flutterkit');
    expect(t.inputIds.first, tokenizer.clsId);
    expect(t.inputIds.last, tokenizer.sepId);
    // flutter + ##kit
    expect(t.inputIds.contains(2024), isTrue);
    expect(t.inputIds.contains(2026), isTrue);
  });

  test('中文逐字切分后 WordPiece 合并', () {
    final t = tokenizer.encode('开发学');
    expect(t.inputIds, containsAll([3001, 3004])); // 开发 + ##学
  });

  test('OOV 词映射为 [UNK]', () {
    final t = tokenizer.encode('zzqqxx');
    expect(t.inputIds, contains(tokenizer.unkId));
  });

  test('注意力掩码与输入等长且全 1', () {
    final t = tokenizer.encode('flutter dart');
    expect(t.attentionMask.length, t.inputIds.length);
    expect(t.attentionMask, everyElement(1));
  });

  test('超长输入被截断到 maxLength', () {
    final long = List.filled(800, 'flutter').join(' ');
    final t = tokenizer.encode(long, maxLength: 64);
    expect(t.inputIds.length, lessThanOrEqualTo(64));
    expect(t.inputIds.last, tokenizer.sepId);
  });

  test('fromVocabTxt 按行号映射 token id', () {
    final t = BertTokenizer.fromVocabTxt('[PAD]\n[UNK]\n[CLS]\n[SEP]\nflutter\ndart');
    final enc = t.encode('flutter dart');
    expect(enc.inputIds, containsAll([4, 5]));
    expect(enc.inputIds.first, 2); // [CLS] 行号 2
    expect(enc.inputIds.last, 3);  // [SEP] 行号 3
  });
}
```

- [ ] **Step 3: 跑测试确认失败**

Run: `flutter test test/unit/bert_tokenizer_test.dart`
Expected: FAIL（找不到 BertTokenizer）

- [ ] **Step 4: 实现 tokenizer**

```dart
// lib/features/semantic_engine/services/bert_tokenizer.dart
/// 纯 Dart WordPiece 分词器（BERT 风格）
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
      final keep = [tokens.first, ...tokens.sublist(1, maxLength - 1), tokens.last];
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

  /// 粗切分：中文逐字，英文/数字按空白切
  List<String> _basicTokenize(String text) {
    final cleaned = text
        .toLowerCase()
        .replaceAll(RegExp(r'[^\w\u4e00-\u9fff]+'), ' ')
        .trim();
    final out = <String>[];
    for (final part in cleaned.split(RegExp(r'\s+'))) {
      if (part.isEmpty) continue;
      if (RegExp(r'^[\u4e00-\u9fff]+$').hasMatch(part)) {
        out.addAll(part.split(''));
      } else {
        out.add(part);
      }
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
```

- [ ] **Step 5: 跑测试确认通过**

Run: `flutter test test/unit/bert_tokenizer_test.dart`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add lib/features/semantic_engine/services/bert_tokenizer.dart test/unit/bert_tokenizer_test.dart test/fixtures/vocab.json
git commit -m "feat(semantic): 纯 Dart WordPiece 分词器"
```

---

### Task 4: 余弦相似度 + SemanticScoring（TDD）

**Files:**
- Create: `lib/features/semantic_engine/services/semantic_scoring.dart`
- Modify: `lib/core/models/predictive_link.dart`（公开 `_extractKeywords`）
- Test: `test/unit/semantic_scoring_test.dart`

- [ ] **Step 1: 公开 PredictiveLinkService 的关键词提取**

```dart
// lib/core/models/predictive_link.dart — 把私有方法改为公开
static Set<String> extractKeywords(String text) {
  final cleaned = text
      .replaceAll(RegExp(r'[\[\]()#*`>_~\-|]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  final words = <String>{};
  for (final match in RegExp(r'[\u4e00-\u9fff]{2,}').allMatches(cleaned)) {
    words.add(match.group(0)!);
  }
  for (final match in RegExp(r'[a-zA-Z]{3,}').allMatches(cleaned)) {
    final word = match.group(0)!.toLowerCase();
    if (!_stopWords.contains(word)) words.add(word);
  }
  return words;
}
```
并把 `recommend()` 内 `_extractKeywords` 三处调用改为 `extractKeywords`。

- [ ] **Step 2: 写失败测试**

```dart
// test/unit/semantic_scoring_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/semantic_engine/services/semantic_scoring.dart';

void main() {
  group('cosineSimilarity', () {
    test('相同向量为 1', () {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3]), closeTo(1, 1e-6));
    });
    test('正交向量为 0', () {
      expect(cosineSimilarity([1, 0], [0, 1]), closeTo(0, 1e-6));
    });
    test('维度不一致返回 0', () {
      expect(cosineSimilarity([1, 0], [1]), 0);
    });
    test('零向量返回 0', () {
      expect(cosineSimilarity([0, 0], [1, 1]), 0);
    });
  });

  group('SemanticScoring.score', () {
    test('语义相关权重主导', () {
      final s = SemanticScoring.score(
        sourceVector: [1, 0, 0],
        targetVector: [0.99, 0.01, 0.01],
        sourceTags: [],
        targetTags: [],
        sourceContent: 'Flutter 开发',
        targetTitle: '无关标题',
        targetContent: '无',
      );
      expect(s.total, closeTo(0.7, 0.01));
      expect(s.reason, contains('语义'));
    });

    test('共同标签叠加', () {
      final s = SemanticScoring.score(
        sourceVector: [1, 0, 0],
        targetVector: [0, 1, 0],
        sourceTags: ['技术', 'Flutter'],
        targetTags: ['技术'],
        sourceContent: '',
        targetTitle: '',
        targetContent: '',
      );
      expect(s.total, greaterThan(0));
      expect(s.reason, contains('标签'));
    });

    test('空向量或低于阈值返回低分', () {
      final s = SemanticScoring.score(
        sourceVector: [0, 0],
        targetVector: [0, 0],
        sourceTags: [],
        targetTags: [],
        sourceContent: 'x',
        targetTitle: 'y',
        targetContent: 'z',
      );
      expect(s.total, lessThan(SemanticScoring.minThreshold));
    });
  });
}
```

- [ ] **Step 3: 跑测试确认失败**

Run: `flutter test test/unit/semantic_scoring_test.dart`
Expected: FAIL（找不到 cosineSimilarity / SemanticScoring）

- [ ] **Step 4: 实现**

```dart
// lib/features/semantic_engine/services/semantic_scoring.dart
import 'dart:math';
import '../../core/models/predictive_link.dart';

/// 余弦相似度
double cosineSimilarity(List<double> a, List<double> b) {
  if (a.length != b.length || a.isEmpty) return 0;
  var dot = 0.0, na = 0.0, nb = 0.0;
  for (var i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na == 0 || nb == 0) return 0;
  return dot / (sqrt(na) * sqrt(nb));
}

/// L2 归一化
List<double> l2Normalize(List<double> v) {
  var norm = 0.0;
  for (final x in v) norm += x * x;
  if (norm == 0) return v;
  final n = sqrt(norm);
  return v.map((x) => x / n).toList();
}

/// 混合评分结果
class SemanticScoringResult {
  final double semantic;
  final double tag;
  final double title;
  final double total;
  final String reason;
  const SemanticScoringResult({
    required this.semantic,
    required this.tag,
    required this.title,
    required this.total,
    required this.reason,
  });
}

/// 语义 + 标签 + 标题/关键词 混合评分（权重 0.7 / 0.2 / 0.1）
class SemanticScoring {
  static const double semanticWeight = 0.7;
  static const double tagWeight = 0.2;
  static const double titleWeight = 0.1;
  static const double minThreshold = 0.05;

  static SemanticScoringResult score({
    required List<double> sourceVector,
    required List<double> targetVector,
    required List<String> sourceTags,
    required List<String> targetTags,
    required String sourceContent,
    required String targetTitle,
    required String targetContent,
  }) {
    final semantic = cosineSimilarity(sourceVector, targetVector);

    double tagScore = 0;
    if (sourceTags.isNotEmpty && targetTags.isNotEmpty) {
      final common =
          sourceTags.where((t) => targetTags.contains(t)).length;
      tagScore = common / (sourceTags.length + targetTags.length - common);
    }

    double titleScore = 0;
    final srcWords = PredictiveLinkService.extractKeywords(sourceContent.toLowerCase());
    final titleWords = PredictiveLinkService.extractKeywords(targetTitle.toLowerCase());
    if (titleWords.isNotEmpty && srcWords.isNotEmpty) {
      final hit = titleWords.where((w) => srcWords.contains(w)).length;
      titleScore = hit / titleWords.length;
    }

    final total = (semantic * semanticWeight) +
        (tagScore * tagWeight) +
        (titleScore * titleWeight);

    final reasons = <String>[
      if (semantic > 0.25) '语义相关',
      if (tagScore > 0) '共同标签',
      if (titleScore > 0) '标题关联',
    ];
    return SemanticScoringResult(
      semantic: semantic,
      tag: tagScore,
      title: titleScore,
      total: total,
      reason: reasons.isEmpty ? '相关笔记' : reasons.join(' · '),
    );
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `flutter test test/unit/semantic_scoring_test.dart`
Expected: PASS

- [ ] **Step 6: 回归旧推荐测试**

Run: `flutter test test/unit/predictive_link_test.dart`
Expected: PASS（extractKeywords 改名不破坏行为）

- [ ] **Step 7: 提交**

```bash
git add lib/features/semantic_engine/services/semantic_scoring.dart lib/core/models/predictive_link.dart test/unit/semantic_scoring_test.dart
git commit -m "feat(semantic): 余弦相似度与混合评分"
```

---

### Task 5: VectorStore — Hive 向量持久化（TDD）

**Files:**
- Modify: `lib/core/services/hive_service.dart`
- Create: `lib/features/semantic_engine/services/vector_store.dart`
- Test: `test/unit/vector_store_test.dart`

- [ ] **Step 1: HiveService 增加 vectors box**

```dart
// lib/core/services/hive_service.dart
// 常量区新增
static const String vectorBoxName = 'vectors';

// 字段区新增
static late Box<dynamic> _vectorBox;

// getter 区新增
/// 语义引擎向量存储 Box (只读)
/// key: noteId → {modelId, dims, vector, updatedAt}
static Box<dynamic> get vectorBox {
  _assertInitialized();
  return _vectorBox;
}

// initHive() 中，trashBox 打开之后新增：
if (Hive.isBoxOpen(vectorBoxName)) {
  _vectorBox = Hive.box<dynamic>(vectorBoxName);
} else {
  _vectorBox = await Hive.openBox<dynamic>(vectorBoxName);
}

// closeHive() 中新增：
await _vectorBox.close();

// clearAllData() 中新增：
await _vectorBox.clear();
```

- [ ] **Step 2: 写失败测试**

```dart
// test/unit/vector_store_test.dart
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
        noteId: 'n$i', modelId: 'm', vector: [i], updatedAt: DateTime(2026, 1, 1)));
    }
    expect((await store.getAll()).length, 3);
  });
}
```

- [ ] **Step 3: 跑测试确认失败**

Run: `flutter test test/unit/vector_store_test.dart`
Expected: FAIL（找不到 VectorStore / vectorBox）

- [ ] **Step 4: 实现 VectorStore**

```dart
// lib/features/semantic_engine/services/vector_store.dart
import 'package:hive_flutter/hive_flutter.dart';
import '../../core/services/hive_service.dart';

/// 向量记录
class NoteVectorRecord {
  final String noteId;
  final String modelId;
  final List<double> vector;
  final DateTime updatedAt;
  const NoteVectorRecord({
    required this.noteId,
    required this.modelId,
    required this.vector,
    required this.updatedAt,
  });

  Map<String, dynamic> toMap() => {
        'modelId': modelId,
        'vector': vector,
        'updatedAt': updatedAt.toIso8601String(),
      };

  static NoteVectorRecord? fromMap(String noteId, dynamic raw) {
    if (raw is! Map) return null;
    final vec = raw['vector'];
    if (vec is! List) return null;
    return NoteVectorRecord(
      noteId: noteId,
      modelId: raw['modelId'] as String? ?? '',
      vector: vec.map((e) => (e as num).toDouble()).toList(),
      updatedAt:
          DateTime.tryParse(raw['updatedAt'] as String? ?? '') ??
              DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

/// Hive 持久化向量
class VectorStore {
  Box<dynamic> get _box => HiveService.vectorBox;

  Future<void> upsert(NoteVectorRecord record) =>
      _box.put(record.noteId, record.toMap());

  Future<NoteVectorRecord?> get(String noteId) async {
    final raw = await _box.get(noteId);
    return NoteVectorRecord.fromMap(noteId, raw);
  }

  Future<void> remove(String noteId) => _box.delete(noteId);

  Future<List<NoteVectorRecord>> getAll() async {
    final out = <NoteVectorRecord>[];
    for (final key in _box.keys) {
      final rec = NoteVectorRecord.fromMap(key, await _box.get(key));
      if (rec != null) out.add(rec);
    }
    return out;
  }

  Future<void> clear() => _box.clear();
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `flutter test test/unit/vector_store_test.dart`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add lib/core/services/hive_service.dart lib/features/semantic_engine/services/vector_store.dart test/unit/vector_store_test.dart
git commit -m "feat(semantic): Hive 向量持久化"
```

---

### Task 6: ModelDownloadService（TDD）

**Files:**
- Create: `lib/features/semantic_engine/services/model_download_service.dart`
- Test: `test/unit/model_download_service_test.dart`

- [ ] **Step 1: 写失败测试**

```dart
// test/unit/model_download_service_test.dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/semantic_engine/services/model_download_service.dart';

/// 内存下载器 fake：模拟 Range 断点续传，可计数调用次数
class FakeDownloader implements Downloader {
  final List<int> fullBytes;
  int calls = 0;
  FakeDownloader(this.fullBytes);
  @override
  Future<int> fetchRange(Uri url, int start, void Function(List<int>) onChunk) async {
    calls++;
    onChunk(fullBytes.sublist(start));
    return fullBytes.length;
  }
}

/// 测试内联 SHA-256（走系统 shasum，避免新增依赖）
String sha256Hex(List<int> bytes) {
  final dir = Directory.systemTemp.createTempSync('hash');
  final f = File('${dir.path}/x.bin')..writeAsBytesSync(bytes);
  final proc = Process.runSync('shasum', ['-a', '256', f.path]);
  dir.deleteSync(recursive: true);
  return (proc.stdout as String).trim().split(' ').first;
}

void main() {
  late Directory tempDir;
  setUp(() async { tempDir = await Directory.systemTemp.createTemp('dl_test'); });
  tearDown(() async { await tempDir.delete(recursive: true); });

  test('全新下载调用 onProgress 到 1.0', () async {
    final bytes = List<int>.generate(1024, (i) => i % 256);
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: '${tempDir.path}/m.onnx',
      downloader: FakeDownloader(bytes),
      expectedSha256: null, // 跳过校验
    );
    final progress = <double>[];
    await svc.download(onProgress: progress.add);
    expect(await File('${tempDir.path}/m.onnx').exists(), isTrue);
    expect(progress.last, 1.0);
  });

  test('已存在且 hash 匹配则跳过下载', () async {
    final bytes = List<int>.generate(256, (i) => 65);
    final dest = '${tempDir.path}/m.onnx';
    await File(dest).writeAsBytes(bytes);
    final dl = FakeDownloader(bytes);
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: dl,
      expectedSha256: sha256Hex(bytes),
    );
    await svc.download(onProgress: (_) {});
    expect(dl.calls, 0); // 不触发下载
  });

  test('hash 不匹配删除并重新下载', () async {
    final bytes = List<int>.generate(256, (i) => i);
    final dest = '${tempDir.path}/m.onnx';
    await File(dest).writeAsBytes(List<int>.filled(100, 0)); // 损坏文件
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: FakeDownloader(bytes),
      expectedSha256: sha256Hex(bytes),
    );
    await svc.download(onProgress: (_) {});
    expect(await File(dest).readAsBytes(), bytes);
  });

  test('部分文件断点续传', () async {
    final bytes = List<int>.generate(512, (i) => i % 256);
    final dest = '${tempDir.path}/m.onnx';
    final part = File('$dest.part');
    await part.writeAsBytes(bytes.sublist(0, 200));
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: FakeDownloader(bytes),
      expectedSha256: null,
    );
    await svc.download(onProgress: (_) {});
    expect(await File(dest).readAsBytes(), bytes);
  });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/unit/model_download_service_test.dart`
Expected: FAIL（找不到 ModelDownloadService）

- [ ] **Step 3: 实现**

```dart
// lib/features/semantic_engine/services/model_download_service.dart
import 'dart:io';

/// 字节下载器抽象（可注入以便测试）
abstract class Downloader {
  /// 从 [start] 字节起拉取，逐块同步回调 [onChunk]，返回完整内容总长度
  Future<int> fetchRange(Uri url, int start, void Function(List<int>) onChunk);
}

/// 基于 dart:io HttpClient 的实现（支持 Range 断点续传）
class HttpDownloader implements Downloader {
  @override
  Future<int> fetchRange(Uri url, int start, void Function(List<int>) onChunk) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 30);
    try {
      final req = await client.getUrl(url);
      if (start > 0) req.headers.set(HttpHeaders.rangeHeader, 'bytes=$start-');
      final resp = await req.close();
      if (resp.statusCode != 200 && resp.statusCode != 206) {
        throw HttpException('下载失败: HTTP ${resp.statusCode}', uri: url);
      }
      final contentLength = start + (resp.contentLength ?? 0);
      await for (final chunk in resp) {
        onChunk(chunk); // 同步写盘，回调内不得 await
      }
      return contentLength;
    } finally {
      client.close(force: true);
    }
  }
}

/// 模型下载服务：断点续传 + SHA-256 校验
class ModelDownloadService {
  final Uri url;
  final String destPath;
  final Downloader downloader;
  final String? expectedSha256;

  ModelDownloadService({
    required this.url,
    required this.destPath,
    required this.downloader,
    this.expectedSha256,
  });

  Future<void> download({required void Function(double) onProgress}) async {
    final dest = File(destPath);
    if (await dest.exists()) {
      if (expectedSha256 != null && await _sha256(dest) == expectedSha256) {
        onProgress(1);
        return;
      }
      await dest.delete(); // 损坏或 hash 未知时重下
    }
    final part = File('$destPath.part');
    var start = 0;
    if (await part.exists()) start = await part.length();
    var written = start;
    final total = await downloader.fetchRange(url, start, (chunk) {
      _writeSync(part, chunk);
      written += chunk.length;
      onProgress(total > 0 ? (written / total).clamp(0.0, 1.0) : 0.0);
    });
    // 校正进度到 100%
    onProgress(1);
    final hash = await _sha256(part);
    if (expectedSha256 != null && hash != expectedSha256) {
      await part.delete();
      throw StateError('模型哈希校验失败，已删除，请重试');
    }
    await part.rename(destPath);
  }

  void _writeSync(File part, List<int> chunk) {
    final raf = part.openSync(mode: FileMode.append);
    try {
      raf.writeFromSync(chunk);
    } finally {
      raf.closeSync();
    }
  }

  Future<String> _sha256(File f) async {
    final proc = await Process.run('shasum', ['-a', '256', f.path]);
    final out = (proc.stdout as String).trim();
    return out.split(' ').first;
  }
}
```

> 设计说明：`Downloader.fetchRange` 的回调是同步的（内部写盘用 `openSync/writeFromSync`），避免在异步流回调中持有 `await`，确保 HTTP 块不丢。

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/unit/model_download_service_test.dart`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/semantic_engine/services/model_download_service.dart test/unit/model_download_service_test.dart
git commit -m "feat(semantic): 模型下载服务（断点续传 + 校验）"
```

---
### Task 7: AppSettings 字段 + ModelStatusProvider（TDD）

**Files:**
- Modify: `lib/providers/settings_provider.dart`
- Create: `lib/features/semantic_engine/providers/model_status_provider.dart`
- Test: `test/unit/model_status_provider_test.dart`

- [ ] **Step 1: AppSettings 增加字段**

```dart
// lib/providers/settings_provider.dart
// 状态类新增字段
final bool semanticEngineEnabled;
final String semanticModelTier; // ModelTier.id, 默认 light

// 构造函数默认值
this.semanticEngineEnabled = false,
this.semanticModelTier = 'bge-small-zh-v1.5',

// copyWith 新增
bool? semanticEngineEnabled,
String? semanticModelTier,

// toMap / fromMap 新增
'semanticEngineEnabled': semanticEngineEnabled,
'semanticModelTier': semanticModelTier,
semanticEngineEnabled: map['semanticEngineEnabled'] as bool? ?? false,
semanticModelTier: map['semanticModelTier'] as String? ?? 'bge-small-zh-v1.5',

// Notifier 新增方法
void setSemanticEngineEnabled(bool value) {
  state = state.copyWith(semanticEngineEnabled: value);
  _persist();
}
void setSemanticModelTier(String tierId) {
  state = state.copyWith(semanticModelTier: tierId);
  _persist();
}
```

- [ ] **Step 2: 写失败测试**

```dart
// test/unit/model_status_provider_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/features/semantic_engine/providers/model_status_provider.dart';

void main() {
  test('初始为 notEnabled', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(container.read(modelStatusProvider).status, SemanticEngineStatus.notEnabled);
  });

  test('enable 后进入 idle（未下载）', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(modelStatusProvider.notifier).enable();
    expect(container.read(modelStatusProvider).status, SemanticEngineStatus.idle);
  });

  test('disable 回到 notEnabled', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final n = container.read(modelStatusProvider.notifier);
    n.enable();
    n.disable();
    expect(container.read(modelStatusProvider).status, SemanticEngineStatus.notEnabled);
  });
}
```

- [ ] **Step 3: 跑测试确认失败**

Run: `flutter test test/unit/model_status_provider_test.dart`
Expected: FAIL

- [ ] **Step 4: 实现状态机**

```dart
// lib/features/semantic_engine/providers/model_status_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum SemanticEngineStatus { notEnabled, idle, downloading, ready, reindexing, error }

class ModelStatusState {
  final SemanticEngineStatus status;
  final double progress; // 下载进度 0..1
  final String? error;
  final String? currentModelId;
  const ModelStatusState({
    this.status = SemanticEngineStatus.notEnabled,
    this.progress = 0,
    this.error,
    this.currentModelId,
  });
  ModelStatusState copyWith({
    SemanticEngineStatus? status,
    double? progress,
    String? error,
    String? currentModelId,
  }) => ModelStatusState(
        status: status ?? this.status,
        progress: progress ?? this.progress,
        error: error ?? this.error,
        currentModelId: currentModelId ?? this.currentModelId,
      );
}

class ModelStatusNotifier extends Notifier<ModelStatusState> {
  @override
  ModelStatusState build() => const ModelStatusState();

  void enable() => state = const ModelStatusState(status: SemanticEngineStatus.idle);
  void disable() => state = const ModelStatusState(status: SemanticEngineStatus.notEnabled);

  void startDownload() => state = state.copyWith(
        status: SemanticEngineStatus.downloading, progress: 0, error: null);

  void updateDownloadProgress(double p) =>
      state = state.copyWith(progress: p.clamp(0, 1));

  void finishDownload(String modelId) => state = ModelStatusState(
        status: SemanticEngineStatus.ready, progress: 1, currentModelId: modelId);

  void startReindex() => state = state.copyWith(status: SemanticEngineStatus.reindexing);
  void finishReindex(String modelId) => state = ModelStatusState(
        status: SemanticEngineStatus.ready, progress: 1, currentModelId: modelId);

  void fail(String message) => state = state.copyWith(status: SemanticEngineStatus.error, error: message);
  void clearError() => state = state.copyWith(status: SemanticEngineStatus.idle, error: null);
}

final modelStatusProvider =
    NotifierProvider<ModelStatusNotifier, ModelStatusState>(ModelStatusNotifier.new);
```

- [ ] **Step 5: 跑测试确认通过**

Run: `flutter test test/unit/model_status_provider_test.dart`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add lib/providers/settings_provider.dart lib/features/semantic_engine/providers/model_status_provider.dart test/unit/model_status_provider_test.dart
git commit -m "feat(semantic): 设置字段 + 模型状态机"
```

---

### Task 8: 设置页「本地语义引擎」分组

**Files:**
- Modify: `lib/features/settings/widgets/settings_page.dart`
- Modify: `lib/features/semantic_engine/providers/model_status_provider.dart`（加下载编排方法）

- [ ] **Step 1: 给 ModelStatusNotifier 增加下载/删除编排**

```dart
// model_status_provider.dart 中追加（依赖 ModelDownloadService + ModelTier）
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../models/model_tier.dart';
import '../services/model_download_service.dart';

Future<void> downloadCurrentTier() async {
  final settings = ref.read(settingsProvider);
  final tier = ModelTier.byId(settings.semanticModelTier);
  startDownload();
  try {
    final dir = await getApplicationSupportDirectory();
    final modelPath = '${dir.path}/${tier.id}.onnx';
    final vocabPath = '${dir.path}/${tier.id}-vocab.json';
    final svc = ModelDownloadService(
      url: tier.onnxUrl,
      destPath: modelPath,
      downloader: HttpDownloader(),
      expectedSha256: tier.expectedHash,
    );
    var last = 0.0;
    await svc.download(onProgress: (p) {
      if (p - last >= 0.05 || p >= 1) { last = p; updateDownloadProgress(p); }
    });
    // vocab 复用同一服务（不校验）
    final vocabSvc = ModelDownloadService(
      url: tier.vocabUrl,
      destPath: vocabPath,
      downloader: HttpDownloader(),
      expectedSha256: null,
    );
    await vocabSvc.download(onProgress: (_) {});
    finishDownload(tier.id);
  } catch (e) {
    fail('模型下载失败: $e');
  }
}

Future<void> deleteModel() async {
  try {
    final dir = await getApplicationSupportDirectory();
    final tier = ModelTier.byId(ref.read(settingsProvider).semanticModelTier);
    final model = File('${dir.path}/${tier.id}.onnx');
    final vocab = File('${dir.path}/${tier.id}-vocab.json');
    if (await model.exists()) await model.delete();
    if (await vocab.exists()) await vocab.delete();
  } catch (_) {}
  state = const ModelStatusState(status: SemanticEngineStatus.idle);
}
```

需要 import `settingsProvider`（`../../providers/settings_provider.dart`）。注：`Notifier` 中 `ref` 可直接读其他 provider。

- [ ] **Step 2: 在设置页 AI 分区加入分组**

在 `_AISectionState.build` 的 `ListView.children` 中、`实体识别` 分组之前插入：

```dart
_SettingsGroup(
  title: '本地语义引擎',
  children: [
    _SemanticEngineTile(),
  ],
),
const SizedBox(height: AeroSpacing.lg),
```

并在同文件底部新增 widget（放在 `_AISectionState` 类之后）：

```dart
/// 本地语义引擎设置项
class _SemanticEngineTile extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final status = ref.watch(modelStatusProvider);
    final notifier = ref.read(modelStatusProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SettingsTile(
          title: '启用语义推荐',
          subtitle: '下载本地模型进行语义级推荐与搜索（需网络，首次约 100MB）',
          trailing: Switch(
            value: settings.semanticEngineEnabled,
            activeThumbColor: AeroColors.accentPurple,
            onChanged: (v) {
              ref.read(settingsProvider.notifier).setSemanticEngineEnabled(v);
              if (v) { notifier.enable(); } else { notifier.disable(); }
            },
          ),
        ),
        if (settings.semanticEngineEnabled) ...[
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: AeroSpacing.md),
            child: Divider(color: AeroColors.divider, height: 1),
          ),
          _SettingsTile(
            title: '模型档位',
            subtitle: '轻量更快 · 高质量更准',
            trailing: DropdownButton<String>(
              value: settings.semanticModelTier,
              dropdownColor: AeroColors.bgElevated,
              style: const TextStyle(color: AeroColors.textPrimary, fontSize: 12),
              underline: const SizedBox.shrink(),
              items: ModelTier.values.map((t) => DropdownMenuItem(
                    value: t.id,
                    child: Text(t == ModelTier.light ? '轻量 (512维)' : '高质量 (768维)'),
                  )).toList(),
              onChanged: (v) {
                if (v == null) return;
                ref.read(settingsProvider.notifier).setSemanticModelTier(v);
              },
            ),
          ),
          _buildStatusArea(context, ref, status),
        ],
      ],
    );
  }

  Widget _buildStatusArea(BuildContext context, WidgetRef ref, ModelStatusState status) {
    switch (status.status) {
      case SemanticEngineStatus.ready:
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md),
          child: Row(children: [
            const Icon(Icons.check_circle_outline, size: 16, color: AeroColors.accentGreen),
            const SizedBox(width: 8),
            Expanded(child: Text('模型已就绪（${status.currentModelId}）', style: const TextStyle(color: AeroColors.textMuted, fontSize: 12))),
            TextButton(
              onPressed: () => ref.read(modelStatusProvider.notifier).deleteModel(),
              child: const Text('删除模型', style: TextStyle(color: AeroColors.accentOrange, fontSize: 12)),
            ),
          ]),
        );
      case SemanticEngineStatus.downloading:
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: 4),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: status.progress,
                minHeight: 4,
                backgroundColor: AeroColors.bgSurface,
                color: AeroColors.accentPurple,
              ),
            ),
            const SizedBox(height: 4),
            Text('下载中 ${(status.progress * 100).toInt()}%',
                style: const TextStyle(color: AeroColors.textMuted, fontSize: 11)),
          ]),
        );
      case SemanticEngineStatus.error:
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md),
          child: Row(children: [
            const Icon(Icons.error_outline, size: 16, color: AeroColors.error),
            const SizedBox(width: 8),
            Expanded(child: Text(status.error ?? '下载失败', style: const TextStyle(color: AeroColors.textMuted, fontSize: 12))),
            TextButton(
              onPressed: () => ref.read(modelStatusProvider.notifier).downloadCurrentTier(),
              child: const Text('重试', style: TextStyle(color: AeroColors.accentBlue, fontSize: 12)),
            ),
          ]),
        );
      case SemanticEngineStatus.idle:
      case SemanticEngineStatus.notEnabled:
      case SemanticEngineStatus.reindexing:
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md),
          child: Row(children: [
            Expanded(
              child: Text(
                status.status == SemanticEngineStatus.reindexing ? '正在重建索引…' : '模型尚未下载',
                style: const TextStyle(color: AeroColors.textMuted, fontSize: 12),
              ),
            ),
            if (status.status == SemanticEngineStatus.idle)
              TextButton(
                onPressed: () => ref.read(modelStatusProvider.notifier).downloadCurrentTier(),
                child: const Text('下载模型', style: TextStyle(color: AeroColors.accentBlue, fontSize: 12)),
              ),
          ]),
        );
    }
  }
}
```

需要 import：`semantic_engine/providers/model_status_provider.dart`、`semantic_engine/models/model_tier.dart`。

- [ ] **Step 3: 编译检查**

Run: `dart analyze lib/features/settings/widgets/settings_page.dart lib/features/semantic_engine`
Expected: No issues found（缺失 import 在此补齐）

- [ ] **Step 4: 提交**

```bash
git add lib/features/settings/widgets/settings_page.dart lib/features/semantic_engine/providers/model_status_provider.dart
git commit -m "feat(settings): 本地语义引擎设置与模型下载 UI"
```

---

### Task 9: EmbeddingService（isolate 推理）

**Files:**
- Create: `lib/features/semantic_engine/services/embedding_service.dart`
- Create: `lib/features/semantic_engine/services/embedding_isolate.dart`

- [ ] **Step 1: 定义 Embedder 接口与隔离服务**

```dart
// lib/features/semantic_engine/services/embedding_service.dart
/// 嵌入器抽象（测试可用 fake）
abstract class Embedder {
  Future<List<double>> embed(String text);
  Future<void> dispose();
}

/// 由文件加载模型的 ONNX 嵌入器（后台 isolate 推理）
class OnnxEmbedder implements Embedder {
  final int dims;
  final SendPort _workerPort;
  final ReceivePort _responsePort = ReceivePort();
  int _requestId = 0;
  final Map<int, Completer<List<double>>> _pending = {};
  bool _disposed = false;

  OnnxEmbedder._(this._workerPort, this.dims) {
    _responsePort.listen(_onResponse);
  }

  static Future<OnnxEmbedder> create({
    required String modelPath,
    required String vocabPath,
    required int dims,
  }) async {
    final control = ReceivePort();
    final ready = Completer<SendPort>();
    control.listen((msg) {
      if (msg is SendPort && !ready.isCompleted) ready.complete(msg);
    });
    await Isolate.spawn(
      _workerEntry,
      [control.sendPort, modelPath, vocabPath, dims],
    );
    final workerPort = await ready.future;
    return OnnxEmbedder._(workerPort, dims);
  }

  @override
  Future<List<double>> embed(String text) async {
    if (_disposed) throw StateError('embedder disposed');
    final id = _requestId++;
    final c = Completer<List<double>>();
    _pending[id] = c;
    _workerPort.send([id, text]);
    return c.future;
  }

  void _onResponse(dynamic msg) {
    if (msg is! List || msg.length != 2) return;
    final id = msg[0] as int;
    final data = msg[1];
    final c = _pending.remove(id);
    if (c == null) return;
    if (data is List) {
      c.complete(List<double>.from(data.map((e) => (e as num).toDouble())));
    } else {
      c.completeError(StateError('embedding 推理失败'));
    }
  }

  @override
  Future<void> dispose() async {
    _disposed = true;
    _responsePort.close();
  }
}
```

```dart
// lib/features/semantic_engine/services/embedding_isolate.dart
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:onnxruntime_v2/onnxruntime_v2.dart';
import 'bert_tokenizer.dart';

/// isolate 入口：常驻 worker，owns OrtEnv + Session
void embeddingWorkerEntry(List<Object?> args) async {
  final control = args[0] as SendPort;
  final modelPath = args[1] as String;
  final vocabPath = args[2] as String;
  final dims = args[3] as int;

  final response = ReceivePort();
  control.send(response.sendPort);

  // 词表文件是 vocab.txt（每行一个 token）
  final vocabText = await File(vocabPath).readAsString();
  final tokenizer = BertTokenizer.fromVocabTxt(vocabText);

  OrtEnv.instance.init();
  final opts = OrtSessionOptions();
  // spike 实测：appendDefaultProviders() 是 async
  await opts.appendDefaultProviders();
  final bytes = await File(modelPath).readAsBytes();
  // spike 实测：fromBuffer 是同步
  final session = OrtSession.fromBuffer(bytes, opts);

  await for (final req in response) {
    if (req is! List || req.length != 2) continue;
    final id = req[0] as int;
    final text = req[1] as String;
    final reply = response.sendPort;
    try {
      final tokens = tokenizer.encode(text);
      final seq = tokens.inputIds.length;
      final ids = OrtValueTensor.createTensorWithDataList(
          tokens.inputIds, [1, seq]);
      final mask = OrtValueTensor.createTensorWithDataList(
          tokens.attentionMask, [1, seq]);
      final seg = OrtValueTensor.createTensorWithDataList(
          tokens.tokenTypeIds, [1, seq]);
      final runOpts = OrtRunOptions();
      final outputs = await session.runAsync(runOpts, {
        'input_ids': ids, 'attention_mask': mask, 'token_type_ids': seg,
      });
      final hidden = outputs![0]!;
      // spike 实测：无 asFloat32List()，value 为嵌套 List
      final value = hidden.value;
      final outer = value as List;
      final inner = outer.isEmpty ? <Object?>[] : (outer.first as List);
      final pooled = List<double>.filled(dims, 0);
      var active = 0;
      for (var s = 0; s < seq && s < inner.length; s++) {
        if (tokens.attentionMask[s] == 0) continue;
        active++;
        final row = inner[s] as List;
        for (var d = 0; d < dims && d < row.length; d++) {
          pooled[d] += (row[d] as num).toDouble();
        }
      }
      if (active > 0) {
        for (var d = 0; d < dims; d++) pooled[d] /= active;
      }
      var norm = 0.0;
      for (final v in pooled) norm += v * v;
      norm = sqrt(norm);
      if (norm > 0) for (var d = 0; d < dims; d++) pooled[d] /= norm;
      reply.send([id, pooled]);
      ids.release(); mask.release(); seg.release(); runOpts.release();
      for (final o in outputs) { o?.release(); }
    } catch (e) {
      reply.send([id, null]);
    }
  }
}
```

- [ ] **Step 2: 编译检查**

Run: `dart analyze lib/features/semantic_engine/services/embedding_service.dart lib/features/semantic_engine/services/embedding_isolate.dart`
Expected: No issues found（如 API 名与 spike 实测不一致，按 spike 结果修正，如 `appendDefaultProviders` 不存在则改用 `appendCPUProvider`）

- [ ] **Step 3: 手动验证（下载后的模型）**

```bash
flutter run -d macos
```
在设置页开启语义引擎 → 下载模型 → 打开笔记，观察「AI 推荐关联」是否出现语义推荐（不出现即回退 TF-IDF，属预期降级）。此为人工冒烟，不进自动化测试。

- [ ] **Step 4: 提交**

```bash
git add lib/features/semantic_engine/services/embedding_service.dart lib/features/semantic_engine/services/embedding_isolate.dart
git commit -m "feat(semantic): isolate 化 ONNX 嵌入服务"
```

---

### Task 10: VectorIndexProvider（TDD，fake embedder）

**Files:**
- Create: `lib/features/semantic_engine/providers/vector_index_provider.dart`
- Test: `test/unit/vector_index_test.dart`

- [ ] **Step 1: 写失败测试**

```dart
// test/unit/vector_index_test.dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_service.dart';
import 'package:aeromind/features/semantic_engine/services/vector_store.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';

class FakeEmbedder implements Embedder {
  final Map<String, List<double>> table;
  FakeEmbedder(this.table);
  @override
  Future<List<double>> embed(String text) async => table[text] ?? List.filled(3, 0);
  @override
  Future<void> dispose() async {}
}

void main() {
  late Directory tempDir;
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('vec_index');
    await HiveService.initHive(testPath: tempDir.path);
  });
  tearDown(() async {
    await HiveService.closeHive();
    await tempDir.delete(recursive: true);
  });

  test('embedAndStore 后 nearest 返回最近邻', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder({
        'Flutter 开发': [1, 0, 0],
        'Dart 语言': [0.9, 0.1, 0],
        '做饭': [0, 1, 0],
      })),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'Flutter 开发', modelId: 'm');
    await idx.embedAndStore('n2', 'Dart 语言', modelId: 'm');
    await idx.embedAndStore('n3', '做饭', modelId: 'm');

    final neighbors = await idx.nearest('n1', k: 2);
    expect(neighbors.first.noteId, 'n2');
    expect(neighbors.first.score, greaterThan(neighbors.last.score));
  });

  test('vectorOf 返回存储向量', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder({'x': [1, 1, 1]})),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'x', modelId: 'm');
    final v = idx.vectorOf('n1');
    expect(v, [1, 1, 1]);
  });

  test('模型档位变化触发需要重嵌入', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder({'x': [1, 1, 1]})),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'x', modelId: 'old-model');
    expect(idx.needsReindex('new-model'), isTrue);
    expect(idx.needsReindex('old-model'), isFalse);
  });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/unit/vector_index_test.dart`
Expected: FAIL（找不到 embedderProvider / vectorIndexProvider）

- [ ] **Step 3: 实现**

```dart
// lib/features/semantic_engine/providers/vector_index_provider.dart
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/hive_service.dart';
import '../../core/models/note_model.dart';
import '../services/embedding_service.dart';
import '../services/semantic_scoring.dart';
import '../services/vector_store.dart';

/// 嵌入器 Provider（生产用 OnnxEmbedder，测试 override）
final embedderProvider = Provider<Embedder?>((ref) {
  // 由 model_status_provider 在 ready 时创建；这里默认 null（回退模式）
  return null;
});

/// 最近邻结果
class Neighbor {
  final String noteId;
  final double score;
  const Neighbor(this.noteId, this.score);
}

class VectorIndexState {
  final String? modelId;
  final Map<String, List<double>> vectors; // noteId -> vector
  final VectorStore store;
  const VectorIndexState({this.modelId, this.vectors = const {}, required this.store});
}

class VectorIndexNotifier extends Notifier<VectorIndexState> {
  @override
  VectorIndexState build() {
    // 启动时不阻塞，首次调用前 load()
    return VectorIndexState(store: VectorStore());
  }

  Future<void> load() async {
    final records = await state.store.getAll();
    final map = <String, List<double>>{};
    String? modelId;
    for (final r in records) {
      map[r.noteId] = r.vector;
      modelId = r.modelId;
    }
    state = VectorIndexState(modelId: modelId, vectors: map, store: state.store);
  }

  List<double>? vectorOf(String noteId) => state.vectors[noteId];

  bool needsReindex(String modelId) => state.modelId != null && state.modelId != modelId;

  Future<void> embedAndStore(String noteId, String text, {required String modelId}) async {
    final embedder = ref.read(embedderProvider);
    if (embedder == null) return;
    final v = await embedder.embed(text);
    await state.store.upsert(NoteVectorRecord(
      noteId: noteId, modelId: modelId, vector: v, updatedAt: DateTime.now()));
    state = VectorIndexState(
      modelId: modelId,
      vectors: {...state.vectors, noteId: v},
      store: state.store,
    );
  }

  Future<void> remove(String noteId) async {
    await state.store.remove(noteId);
    final next = Map<String, List<double>>.from(state.vectors)..remove(noteId);
    state = VectorIndexState(modelId: state.modelId, vectors: next, store: state.store);
  }

  Future<List<Neighbor>> nearest(String noteId, {int k = 10}) async {
    final src = state.vectors[noteId];
    if (src == null) return const [];
    final scored = state.vectors.entries
        .where((e) => e.key != noteId)
        .map((e) => Neighbor(e.key, cosineSimilarity(src, e.value)))
        .where((n) => n.score > 0)
        .toList()
      ..sort((a, b) => b.score.compareTo(a.score));
    return scored.take(k).toList();
  }

  Future<List<Neighbor>> search(String queryVector, {int k = 10}) async {
    final scored = state.vectors.entries
        .map((e) => Neighbor(e.key, cosineSimilarity(queryVector, e.value)))
        .where((n) => n.score > 0.15)
        .toList()
      ..sort((a, b) => b.score.compareTo(a.score));
    return scored.take(k).toList();
  }
}

final vectorIndexProvider =
    NotifierProvider<VectorIndexNotifier, VectorIndexState>(VectorIndexNotifier.new);
```

- [ ] **Step 4: 修正测试以匹配 `search` 与 `nearest` 签名（异步）**

测试中 `nearest`/`search` 均 `await`。`vectorOf` 同步。跑测试确认通过：

Run: `flutter test test/unit/vector_index_test.dart`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/semantic_engine/providers/vector_index_provider.dart test/unit/vector_index_test.dart
git commit -m "feat(semantic): 内存向量索引与最近邻"
```

---

### Task 11: predictiveLinksProvider 语义集成（TDD）

**Files:**
- Modify: `lib/providers/ai_provider.dart`
- Test: `test/unit/semantic_recommendation_test.dart`

- [ ] **Step 1: 写失败测试**

```dart
// test/unit/semantic_recommendation_test.dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/providers/model_status_provider.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_service.dart';
import 'package:aeromind/helpers/test_helpers.dart';
import 'package:aeromind/providers/note_provider.dart';
import 'package:aeromind/providers/ai_provider.dart';
import '../helpers/test_helpers.dart';

class FakeEmbedder implements Embedder {
  @override
  Future<List<double>> embed(String text) async {
    // 关键词 → 简单向量（供断言排序）
    if (text.contains('Flutter')) return [1, 0, 0];
    if (text.contains('Dart')) return [0.9, 0.1, 0];
    return [0, 1, 0];
  }
  @override
  Future<void> dispose() async {}
}

void main() {
  late Directory tempDir;
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('reco');
    await HiveService.initHive(testPath: tempDir.path);
  });
  tearDown(() async {
    await HiveService.closeHive();
    await tempDir.delete(recursive: true);
  });

  test('模型就绪时走语义推荐', () async {
    final repo = InMemoryNoteRepository();
    await repo.saveNote(createTestNote(
      id: 'n1', title: 'Flutter 开发', content: 'Flutter 跨平台开发框架'));
    await repo.saveNote(createTestNote(
      id: 'n2', title: 'Dart 语言', content: 'Dart 是 Flutter 的语言'));
    await repo.saveNote(createTestNote(
      id: 'n3', title: '菜谱', content: '红烧肉做法'));

    final container = ProviderContainer(overrides: [
      noteRepositoryProvider.overrideWithValue(repo),
      embedderProvider.overrideWithValue(FakeEmbedder()),
    ]);
    addTearDown(container.dispose);

    // 构建向量索引
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', 'Flutter 开发', modelId: 'm');
    await idx.embedAndStore('n2', 'Dart 语言', modelId: 'm');
    await idx.embedAndStore('n3', '菜谱', modelId: 'm');

    // 标记 ready
    container.read(modelStatusProvider.notifier).finishDownload('m');

    final links = await container.read(predictiveLinksProvider('n1').future);
    expect(links, isNotEmpty);
    expect(links.first.targetNoteId, 'n2');
  });

  test('模型未就绪时回退 TF-IDF', () async {
    final repo = InMemoryNoteRepository();
    await repo.saveNote(createTestNote(
      id: 'n1', title: 'Flutter 开发', content: 'Flutter 跨平台开发框架'));
    await repo.saveNote(createTestNote(
      id: 'n2', title: 'Dart 语言', content: 'Dart 是 Flutter 的语言'));

    final container = ProviderContainer(overrides: [
      noteRepositoryProvider.overrideWithValue(repo),
    ]);
    addTearDown(container.dispose);

    final links = await container.read(predictiveLinksProvider('n1').future);
    expect(links, isNotEmpty); // TF-IDF 路径仍可用
  });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/unit/semantic_recommendation_test.dart`
Expected: FAIL（predictiveLinksProvider 未接入语义）

- [ ] **Step 3: 修改 predictiveLinksProvider**

```dart
// lib/providers/ai_provider.dart
final predictiveLinksProvider =
    FutureProvider.family<List<PredictiveLink>, String>((ref, noteId) async {
  final repo = ref.read(noteRepositoryProvider);

  final currentNote = await repo.getNote(noteId);
  if (currentNote == null || currentNote.rawMarkdown.trim().isEmpty) {
    return [];
  }

  final allNotes = await repo.getAllNotes();
  if (allNotes.isEmpty) return [];

  // ── 语义路径（模型就绪）──
  final status = ref.watch(modelStatusProvider);
  if (status.status == SemanticEngineStatus.ready &&
      status.currentModelId != null) {
    final idx = ref.read(vectorIndexProvider.notifier);
    await idx.load();
    final srcVec = idx.vectorOf(noteId);
    if (srcVec != null) {
      final neighbors = await idx.nearest(noteId, k: 20);
      final byId = {for (final n in allNotes) n.id: n};
      final links = <PredictiveLink>[];
      for (final nb in neighbors) {
        final target = byId[nb.noteId];
        if (target == null) continue;
        final targetVec = idx.vectorOf(target.id);
        if (targetVec == null) continue;
        final s = SemanticScoring.score(
          sourceVector: srcVec,
          targetVector: targetVec,
          sourceTags: currentNote.tags,
          targetTags: target.tags,
          sourceContent: currentNote.rawMarkdown,
          targetTitle: target.title,
          targetContent: target.rawMarkdown,
        );
        if (s.total >= SemanticScoring.minThreshold) {
          links.add(PredictiveLink(
            sourceNoteId: noteId,
            targetNoteId: target.id,
            targetTitle: target.title,
            relevance: s.total.clamp(0.0, 1.0),
            reason: s.reason,
          ));
        }
      }
      links.sort((a, b) => b.relevance.compareTo(a.relevance));
      if (links.isNotEmpty) return links.take(5).toList();
    }
  }

  // ── 回退：TF-IDF ──
  final noteInfos = allNotes
      .map((n) => NoteInfoForLink(
            id: n.id,
            title: n.title,
            content: n.rawMarkdown,
            tags: n.tags,
          ))
      .toList();
  return PredictiveLinkService.recommend(
    currentNoteId: noteId,
    currentContent: currentNote.rawMarkdown,
    currentTags: currentNote.tags,
    allNotes: noteInfos,
    maxResults: 5,
  );
});
```

新增 import：
```dart
import '../features/semantic_engine/providers/model_status_provider.dart';
import '../features/semantic_engine/providers/vector_index_provider.dart';
import '../features/semantic_engine/services/semantic_scoring.dart';
```

> 说明：`VectorIndexNotifier.load()` 返回 `Future<void>`，所以先把 notifier 取到局部变量 `idx` 再 `await idx.load()`，随后用 `idx.vectorOf(...)` / `idx.nearest(...)`（均为 notifier 上的方法）。

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/unit/semantic_recommendation_test.dart`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/providers/ai_provider.dart test/unit/semantic_recommendation_test.dart
git commit -m "feat(semantic): 预测链接接入语义路径并保留回退"
```

---

### Task 12: 语义搜索集成

**Files:**
- Modify: `lib/providers/sidebar_provider.dart`
- Create: `lib/features/semantic_engine/providers/semantic_search_provider.dart`

- [ ] **Step 1: 创建语义搜索 provider**

```dart
// lib/features/semantic_engine/providers/semantic_search_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/note_model.dart';
import 'model_status_provider.dart';
import 'vector_index_provider.dart';

/// 语义搜索结果（带分数）
class SemanticHit {
  final String noteId;
  final double score;
  const SemanticHit(this.noteId, this.score);
}

/// 查询语义搜索：模型就绪且查询词非空时返回 Top-K
final semanticSearchProvider =
    FutureProvider.family<List<SemanticHit>, String>((ref, query) async {
  if (query.trim().isEmpty) return const [];
  final status = ref.watch(modelStatusProvider);
  if (status.status != SemanticEngineStatus.ready) return const [];
  final embedder = ref.read(embedderProvider);
  if (embedder == null) return const [];
  final index = ref.read(vectorIndexProvider);
  if (index.vectors.isEmpty) return const [];

  final qv = await embedder.embed(query);
  final hits = await ref.read(vectorIndexProvider.notifier).search(qv, k: 8);
  return hits.map((h) => SemanticHit(h.noteId, h.score)).toList();
});
```

> 注：`index.vectors` 来自 `VectorIndexState.vectors`。`semanticSearchProvider` 需要 watch `modelStatusProvider` 以便就绪后重跑。

- [ ] **Step 2: 修改 sidebar_provider 的 search()**

```dart
// lib/providers/sidebar_provider.dart — search() 方法中，关键词结果之后合并
import '../features/semantic_engine/providers/semantic_search_provider.dart';
import '../features/semantic_engine/providers/model_status_provider.dart';

Future<void> search(String query) async {
  state = state.copyWith(
    searchQuery: query, isSearching: true, clearSearchMessage: true);
  if (query.trim().isEmpty) {
    state = state.copyWith(
        searchResults: const [], isSearching: false, clearSearchMessage: true);
    return;
  }
  try {
    final repo = ref.read(noteRepositoryProvider);
    final allNotes = await repo.getAllNotes();
    final response = SearchService.searchNotes(allNotes, query);
    var results = response.results;

    // 语义补充：模型就绪时，把未命中关键词的语义相近笔记追加
    final status = ref.read(modelStatusProvider);
    if (status.status == SemanticEngineStatus.ready &&
        status.currentModelId != null) {
      final hits = await ref.read(semanticSearchProvider(query).future);
      final existingIds = results.map((r) => r.note.id).toSet();
      final byId = {for (final n in allNotes) n.id: n};
      for (final hit in hits) {
        if (existingIds.contains(hit.noteId)) continue;
        final note = byId[hit.noteId];
        if (note == null) continue;
        results.add(SearchResult(
          note: note,
          matches: const [],
          preview: note.rawMarkdown.length > 100
              ? note.rawMarkdown.substring(0, 100)
              : note.rawMarkdown,
          score: hit.score * 100, // 归一化到关键词分数量级
        ));
        existingIds.add(hit.noteId);
      }
      results.sort((a, b) => b.score.compareTo(a.score));
    }

    state = state.copyWith(
      searchResults: results,
      isSearching: false,
      searchMessage: response.message,
    );
  } catch (e) {
    debugPrint('Error searching notes: $e');
    state = state.copyWith(
        searchResults: const [], isSearching: false, clearSearchMessage: true);
  }
}
```

- [ ] **Step 3: 编译检查**

Run: `dart analyze lib/providers/sidebar_provider.dart lib/features/semantic_engine/providers/semantic_search_provider.dart`
Expected: No issues found

- [ ] **Step 4: 提交**

```bash
git add lib/providers/sidebar_provider.dart lib/features/semantic_engine/providers/semantic_search_provider.dart
git commit -m "feat(semantic): 侧边栏搜索合并语义结果"
```

---

### Task 13: 档位切换重嵌入

**Files:**
- Modify: `lib/features/semantic_engine/providers/model_status_provider.dart`
- Modify: `lib/features/semantic_engine/providers/vector_index_provider.dart`
- Test: `test/unit/reindex_test.dart`

- [ ] **Step 1: 写失败测试**

```dart
// test/unit/reindex_test.dart
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/features/semantic_engine/services/embedding_service.dart';
import 'package:aeromind/features/semantic_engine/providers/vector_index_provider.dart';

class FakeEmbedder implements Embedder {
  @override
  Future<List<double>> embed(String text) async => [1, 0, 0];
  @override
  Future<void> dispose() async {}
}

void main() {
  late Directory tempDir;
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('reindex');
    await HiveService.initHive(testPath: tempDir.path);
  });
  tearDown(() async {
    await HiveService.closeHive();
    await tempDir.delete(recursive: true);
  });

  test('reindexAll 更新 modelId 并覆盖旧向量', () async {
    final container = ProviderContainer(overrides: [
      embedderProvider.overrideWithValue(FakeEmbedder()),
    ]);
    addTearDown(container.dispose);
    final idx = container.read(vectorIndexProvider.notifier);
    await idx.embedAndStore('n1', '旧文本', modelId: 'old-model');

    var done = 0, total = 0;
    await idx.reindexAll([
      NoteModel(id: 'n1', title: '新标题', rawMarkdown: '新正文',
          filePath: '/n1.md', createdAt: DateTime(2026,1,1),
          updatedAt: DateTime(2026,1,1)),
    ], 'new-model', onProgress: (d, t) { done = d; total = t; });

    expect(done, 1);
    expect(total, 1);
    expect(idx.needsReindex('new-model'), isFalse);
    expect(idx.vectorOf('n1'), isNotNull);
  });
}
```

需要 import：`package:aeromind/core/models/note_model.dart`（`NoteModel`）。

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/unit/reindex_test.dart`
Expected: FAIL（找不到 reindexAll）

- [ ] **Step 3: VectorIndexProvider 增加全量重嵌入**

```dart
// vector_index_provider.dart 追加
import '../../core/services/hive_service.dart'; // 已有
import '../models/model_tier.dart';

Future<void> reindexAll(
  List<NoteModel> notes,
  String modelId, {
  required void Function(int done, int total) onProgress,
}) async {
  var done = 0;
  for (final note in notes) {
    await embedAndStore(note.id, '${note.title}\n${note.rawMarkdown}',
        modelId: modelId);
    done++;
    onProgress(done, notes.length);
  }
}
```

- [ ] **Step 4: ModelStatusProvider 增加换档编排**

```dart
// model_status_provider.dart 追加
Future<void> ensureModelForTier(String tierId) async {
  final current = ref.read(modelStatusProvider);
  if (current.currentModelId == tierId) return;
  if (current.status == SemanticEngineStatus.ready) {
    // 换档：触发全量重嵌入
    startReindex();
    try {
      final repo = ref.read(noteRepositoryProvider);
      final notes = await repo.getAllNotes();
      final idx = ref.read(vectorIndexProvider.notifier);
      await idx.reindexAll(notes, tierId, onProgress: (done, total) {
        // 重嵌入进度可映射到 progress 展示
      });
      finishReindex(tierId);
    } catch (e) {
      fail('重嵌入失败: $e');
    }
  }
  // 未就绪则无需处理（下载由 downloadCurrentTier 负责）
}
```

需要 import：`../../providers/note_provider.dart`。

- [ ] **Step 5: 设置页档位切换联动**

在 `_SemanticEngineTile` 的档位 `onChanged` 中，切换后触发换档重嵌入：

```dart
onChanged: (v) {
  if (v == null) return;
  ref.read(settingsProvider.notifier).setSemanticModelTier(v);
  ref.read(modelStatusProvider.notifier).ensureModelForTier(v);
},
```

- [ ] **Step 6: 编译检查**

Run: `dart analyze lib/features/semantic_engine lib/features/settings/widgets/settings_page.dart`
Expected: No issues found

- [ ] **Step 7: 提交**

```bash
git add lib/features/semantic_engine/providers/model_status_provider.dart lib/features/semantic_engine/providers/vector_index_provider.dart lib/features/settings/widgets/settings_page.dart test/unit/reindex_test.dart
git commit -m "feat(semantic): 档位切换自动重嵌入"
```

---

### Task 14: 收尾 — 全量校验

**Files:**
- Modify: `README.md` 或 `CLAUDE.md`（文档，可选）

- [ ] **Step 1: 静态分析**

Run: `dart analyze`
Expected: No issues found（若有语义引擎相关告警，逐一修复）

- [ ] **Step 2: 全量测试**

Run: `flutter test`
Expected: 全部通过（含既有 predictive_link / search_service 等回归）

- [ ] **Step 3: 人工冒烟**

```bash
flutter run -d macos
```
- 设置 → AI → 本地语义引擎：开关、档位下拉、下载进度、删除模型
- 下载完成后打开笔记：底部「AI 推荐关联」应出现语义相关笔记
- 侧边栏搜索：语义相关补充条目出现
- 切换档位：触发重嵌入提示

- [ ] **Step 4: 文档更新（可选）**

在 `CLAUDE.md` 待完善清单勾掉「Isar 向量索引接通」相关说明，改为「语义引擎（Hive 向量）已接通」，或按实际调整。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "chore(semantic): 全量校验与文档更新"
```

---

## 风险与回退

- **onnxruntime_v2 在 macOS 编译失败**（Task 1）：立即停止，改用 `tflite_flutter` 或纯 Dart 方案，重新评估。
- **embedding 推理 API 名差异**（Task 9）：以 spike 实测为准修正。
- **模型 URL/体积**：fp32 先跑通；后续换 int8 量化产物仅改 `ModelTier` 常量 + hash。
- **任何异常**：`embedderProvider` 返回 null 或状态非 ready → 走 TF-IDF/关键词，用户无感。