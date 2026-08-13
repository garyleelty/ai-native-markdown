/// ══════════════════════════════════════════════════
/// EntityRecognizer — 实体识别引擎
/// ══════════════════════════════════════════════════
/// 三种策略（RecognitionStrategy）：
///   - local   本地正则（7 条规则 → 5 种实体类型）
///   - remote  OpenAI 兼容 API（4000 字符截断，失败回退本地）
///   - hybrid  本地 + 远程合并去重（远程优先 + 偏移去重）
/// 500ms 防抖（debounceRecognize）；远程仅原生平台可用。
/// ──────────────────────────────────────────────────

library;

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../../core/models/note_model.dart';
import 'llm_client_factory.dart';

/// ══════════════════════════════════════════════════
/// EntityRecognizer — 轻量级语义分析引擎
/// ══════════════════════════════════════════════════
/// 职责:
///   1. 用户输入时防抖 (debounce) 触发实体识别
///   2. 本地正则 + 启发式规则 (零延迟)
///   3. 可选调用大模型 API 进行深度语义分析
///   4. 输出 EntityHighlight 列表供 UI 渲染
/// ──────────────────────────────────────────────────

/// 实体识别结果
class RecognitionResult {
  final List<EntityHighlight> entities;
  final Duration processingTime;

  const RecognitionResult({
    required this.entities,
    required this.processingTime,
  });
}

/// 识别策略枚举
enum RecognitionStrategy {
  /// 本地规则 (正则匹配)
  local,

  /// 调用远程 LLM API
  remote,

  /// 混合模式 (本地先识别，远程增强)
  hybrid,
}

/// LLM API 配置
class LlmConfig {
  /// API 端点 URL
  final String endpoint;

  /// API Key
  final String apiKey;

  /// 模型名称
  final String model;

  /// 最大 token 限制
  final int maxTokens;

  /// 温度参数
  final double temperature;

  const LlmConfig({
    required this.endpoint,
    required this.apiKey,
    this.model = 'gpt-3.5-turbo',
    this.maxTokens = 1024,
    this.temperature = 0.1,
  });
}

class EntityRecognizer {
  final RecognitionStrategy strategy;
  final LlmConfig? llmConfig;
  Timer? _debounceTimer;

  EntityRecognizer({
    this.strategy = RecognitionStrategy.local,
    this.llmConfig,
  });

  // ── 防抖: 用户停止输入 500ms 后触发识别 ──
  void debounceRecognize(
    String markdown,
    void Function(RecognitionResult) onResult, {
    Duration delay = const Duration(milliseconds: 500),
  }) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(delay, () async {
      try {
        final result = await recognize(markdown);
        onResult(result);
      } catch (e) {
        if (kDebugMode) {
          print('[EntityRecognizer] 防抖识别异常: $e');
        }
        onResult(const RecognitionResult(
          entities: [],
          processingTime: Duration.zero,
        ));
      }
    });
  }

  /// 核心识别入口
  Future<RecognitionResult> recognize(String markdown) async {
    final sw = Stopwatch()..start();
    List<EntityHighlight> entities;

    switch (strategy) {
      case RecognitionStrategy.local:
        entities = _localRecognize(markdown);
        break;
      case RecognitionStrategy.remote:
        entities = await _remoteRecognize(markdown);
        break;
      case RecognitionStrategy.hybrid:
        entities = _localRecognize(markdown);
        try {
          final remoteEntities = await _remoteRecognize(markdown);
          entities = _mergeEntities(entities, remoteEntities);
        } catch (_) {
          // 远程失败时保留本地结果
        }
        break;
    }

    sw.stop();
    return RecognitionResult(
      entities: entities,
      processingTime: sw.elapsed,
    );
  }

  // ──────────────────────────────────────────────
  // 本地规则识别 (零延迟，纯正则)
  // ──────────────────────────────────────────────
  List<EntityHighlight> _localRecognize(String markdown) {
    final entities = <EntityHighlight>[];

    // 1. [[双向链接]] → reference
    final wikiLinkPattern = RegExp(r'\[\[([^\]]+)\]\]');
    for (final match in wikiLinkPattern.allMatches(markdown)) {
      entities.add(EntityHighlight(
        startOffset: match.start,
        endOffset: match.end,
        type: EntityType.reference,
        label: match.group(1) ?? '',
        confidence: 1.0,
      ));
    }

    // 2. > 引文块 → quote
    final quotePattern = RegExp(r'^>\s*(.+)$', multiLine: true);
    for (final match in quotePattern.allMatches(markdown)) {
      entities.add(EntityHighlight(
        startOffset: match.start,
        endOffset: match.end,
        type: EntityType.quote,
        label: match.group(1)?.trim() ?? '',
        confidence: 0.9,
      ));
    }

    // 3. @人名 → person
    final personPattern =
        RegExp(r'(?:^|\s)(@[A-Z\u4e00-\u9fff][\w\u4e00-\u9fff]{1,20})(?!\.)');
    for (final match in personPattern.allMatches(markdown)) {
      final fullMatch = match.group(0) ?? '';
      final atIndex = fullMatch.indexOf('@');
      final startOffset = match.start + atIndex;
      final endOffset = startOffset + (match.group(1)?.length ?? 0);
      entities.add(EntityHighlight(
        startOffset: startOffset,
        endOffset: endOffset,
        type: EntityType.person,
        label: (match.group(1) ?? '').substring(1),
        confidence: 0.8,
      ));
    }

    // 4. #标签 → concept
    final tagPattern = RegExp(r'(?:^|\s)(#[\w\u4e00-\u9fff-]+)');
    for (final match in tagPattern.allMatches(markdown)) {
      final fullMatch = match.group(0) ?? '';
      final hashIndex = fullMatch.indexOf('#');
      final startOffset = match.start + hashIndex;
      final endOffset = startOffset + (match.group(1)?.length ?? 0);
      entities.add(EntityHighlight(
        startOffset: startOffset,
        endOffset: endOffset,
        type: EntityType.concept,
        label: (match.group(1) ?? '').substring(1),
        confidence: 0.85,
      ));
    }

    // 5. - [ ] 待办 / - [x] 已完成 → task
    final taskPattern =
        RegExp(r'^(\s*-\s*\[[ x]\]\s*)(.+)$', multiLine: true);
    for (final match in taskPattern.allMatches(markdown)) {
      entities.add(EntityHighlight(
        startOffset: match.start,
        endOffset: match.end,
        type: EntityType.task,
        label: match.group(2)?.trim() ?? '',
        confidence: 1.0,
      ));
    }

    // 6. 数学公式 $...$ → concept
    final mathPattern = RegExp(r'(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)');
    for (final match in mathPattern.allMatches(markdown)) {
      entities.add(EntityHighlight(
        startOffset: match.start,
        endOffset: match.end,
        type: EntityType.concept,
        label: match.group(1)?.trim() ?? '',
        confidence: 0.7,
      ));
    }

    // 7. 时间戳模式 → concept
    final timePattern = RegExp(
        r'\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})(?:\s+\d{1,2}:\d{2})?\b');
    for (final match in timePattern.allMatches(markdown)) {
      entities.add(EntityHighlight(
        startOffset: match.start,
        endOffset: match.end,
        type: EntityType.concept,
        label: match.group(0) ?? '',
        confidence: 0.6,
      ));
    }

    return entities;
  }

  // ──────────────────────────────────────────────
  // 远程 LLM 识别 (异步, 深度语义)
  // ──────────────────────────────────────────────
  Future<List<EntityHighlight>> _remoteRecognize(String markdown) async {
    if (llmConfig == null) {
      // 无 LLM 配置时回退到本地识别
      return _localRecognize(markdown);
    }

    try {
      const prefixLength = 0;
      final truncated = markdown.length > 4000
          ? markdown.substring(prefixLength, prefixLength + 4000)
          : markdown;

      final prompt = '''请识别以下 Markdown 文本中的实体。
返回 JSON 数组，每个元素包含:
- "start": 起始字符位置
- "end": 结束字符位置
- "type": "concept" | "person" | "task" | "quote" | "reference"
- "label": 实体文本
- "confidence": 0.0-1.0

注意:
- 只识别有意义的命名实体，不要标记普通单词
- concept: 专业术语、技术概念、学科名词
- person: 人名
- task: 待办事项
- quote: 引文
- reference: 文献引用

文本:
$truncated

返回纯 JSON 数组，不要其他文字:''';

      // 构造 OpenAI 兼容 API 请求
      final response = await _callLlm(prompt);

      if (response == null) return _localRecognize(markdown);

      final parsed = jsonDecode(response) as List<dynamic>;
      final entities = <EntityHighlight>[];

      for (final item in parsed) {
        if (item is Map) {
          final rawStart = item['start'] as int? ?? 0;
          final rawEnd = item['end'] as int? ?? 0;
          final typeStr = item['type'] as String? ?? 'concept';
          final label = item['label'] as String? ?? '';
          final confidence = (item['confidence'] as num?)?.toDouble() ?? 0.5;

          final type = EntityType.values.firstWhere(
            (t) => t.name == typeStr,
            orElse: () => EntityType.concept,
          );

          if (rawStart >= 0 && rawEnd > rawStart && rawEnd <= truncated.length) {
            final start = rawStart + prefixLength;
            final end = rawEnd + prefixLength;

            if (start >= 0 && end > start && end <= markdown.length) {
              entities.add(EntityHighlight(
                startOffset: start,
                endOffset: end,
                type: type,
                label: label,
                confidence: confidence,
              ));
            }
          }
        }
      }

      return entities;
    } catch (e) {
      if (kDebugMode) {
        print('[EntityRecognizer] 远程识别失败: $e');
      }
      // 失败时回退到本地识别
      return _localRecognize(markdown);
    }
  }

  /// 调用 LLM API (OpenAI 兼容格式)
  /// 使用平台工厂自动选择实现：原生用 HttpClient，Web 回退到 null
  Future<String?> _callLlm(String prompt) async {
    if (llmConfig == null) return null;

    try {
      final client = createLlmClient();
      return await client.callLlm(
        endpoint: llmConfig!.endpoint,
        apiKey: llmConfig!.apiKey,
        model: llmConfig!.model,
        maxTokens: llmConfig!.maxTokens,
        temperature: llmConfig!.temperature,
        systemPrompt: '你是一个实体识别助手，只返回 JSON 数组。',
        userPrompt: prompt,
      );
    } catch (e) {
      if (kDebugMode) {
        print('[EntityRecognizer] LLM API 调用失败: $e');
      }
      return null;
    }
  }

  /// 合并本地和远程识别结果 (去重 + 优先取远程)
  List<EntityHighlight> _mergeEntities(
    List<EntityHighlight> local,
    List<EntityHighlight> remote,
  ) {
    final merged = <EntityHighlight>[];
    final usedOffsets = <String>{};

    // 远程结果优先 (通常更准确)
    for (final entity in remote) {
      final key = '${entity.startOffset}:${entity.endOffset}';
      if (!usedOffsets.contains(key)) {
        merged.add(entity);
        usedOffsets.add(key);
      }
    }

    // 补充本地结果中不重叠的部分
    for (final entity in local) {
      final key = '${entity.startOffset}:${entity.endOffset}';
      if (!usedOffsets.contains(key)) {
        merged.add(entity);
        usedOffsets.add(key);
      }
    }

    // 按起始位置排序
    merged.sort((a, b) => a.startOffset.compareTo(b.startOffset));
    return merged;
  }

  void dispose() {
    _debounceTimer?.cancel();
  }
}
