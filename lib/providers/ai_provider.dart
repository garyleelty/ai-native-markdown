/// ══════════════════════════════════════════════════
/// AI Provider — AI 引擎状态
/// ══════════════════════════════════════════════════
///   - entityCacheProvider      按 noteId 缓存识别结果（最多 200 条）
///   - entityRecognizerProvider 实体识别器（策略来自设置，500ms 防抖）
///   - aiContextProvider        可见面板聚合 → AI 上下文
///   - aiContextPromptProvider  AI prompt + token 估算
///   - predictiveLinksProvider  预测链接推荐（最多 5 条）
/// ──────────────────────────────────────────────────

library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/models/note_model.dart';
import '../core/models/predictive_link.dart';
import '../features/ai_engine/services/entity_recognizer.dart';
import '../features/semantic_engine/providers/model_status_provider.dart';
import '../features/semantic_engine/providers/vector_index_provider.dart';
import '../features/semantic_engine/services/semantic_scoring.dart';
import 'pane_provider.dart';
import 'note_provider.dart';
import 'settings_provider.dart';

// ──────────────────────────────────────────────
// AI 引擎状态管理
// ──────────────────────────────────────────────

/// 实体识别结果缓存 (按 noteId 缓存)
class EntityCacheState {
  final Map<String, List<EntityHighlight>> cache;

  const EntityCacheState({this.cache = const {}});

  List<EntityHighlight> getEntities(String noteId) =>
      cache[noteId] ?? const [];
}

class EntityCacheNotifier extends Notifier<EntityCacheState> {
  static const int _maxCacheSize = 200;

  @override
  EntityCacheState build() => const EntityCacheState();

  void updateEntities(String noteId, List<EntityHighlight> entities) {
    final newCache = Map<String, List<EntityHighlight>>.from(state.cache);

    if (newCache.containsKey(noteId)) {
      newCache.remove(noteId);
    }

    while (newCache.length >= _maxCacheSize) {
      final firstKey = newCache.keys.first;
      newCache.remove(firstKey);
    }

    newCache[noteId] = entities;
    state = EntityCacheState(cache: newCache);
  }

  /// 清除指定笔记的缓存
  void clearNote(String noteId) {
    final newCache = Map<String, List<EntityHighlight>>.from(state.cache);
    newCache.remove(noteId);
    state = EntityCacheState(cache: newCache);
  }

  /// 清除所有缓存
  void clearAll() {
    state = const EntityCacheState();
  }
}

final entityCacheProvider =
    NotifierProvider<EntityCacheNotifier, EntityCacheState>(
  EntityCacheNotifier.new,
);

/// EntityRecognizer 单例 Provider
final entityRecognizerProvider = Provider<EntityRecognizer>((ref) {
  final settings = ref.watch(settingsProvider);
  final recognizer = EntityRecognizer(
    strategy: settings.entityRecognitionStrategy,
  );
  ref.onDispose(recognizer.dispose);
  return recognizer;
});

// ──────────────────────────────────────────────
// AI 上下文窗口构建器
// ──────────────────────────────────────────────

/// AI 上下文 Prompt 构建结果
class AIContextPrompt {
  final String systemPrompt;
  final List<PaneContextFragment> fragments;
  final int estimatedTokens;

  const AIContextPrompt({
    required this.systemPrompt,
    required this.fragments,
    required this.estimatedTokens,
  });
}

class PaneContextFragment {
  final String noteId;
  final String title;
  final String content;
  final bool isActive;

  const PaneContextFragment({
    required this.noteId,
    required this.title,
    required this.content,
    required this.isActive,
  });
}

/// 实时构建 AI 上下文
final aiContextPromptProvider = Provider<AIContextPrompt>((ref) {
  final paneState = ref.watch(paneStackProvider);

  final fragments = <PaneContextFragment>[];

  for (int i = 0; i < paneState.panes.length; i++) {
    final pane = paneState.panes[i];
    if (pane.isStacked) continue;

    fragments.add(PaneContextFragment(
      noteId: pane.noteId,
      title: pane.title,
      content: '',
      isActive: i == paneState.activeIndex,
    ));
  }

  final buffer = StringBuffer();
  buffer.writeln('你是一个智能笔记助手，当前用户正在查看以下笔记面板:');
  buffer.writeln();
  for (final f in fragments) {
    buffer.writeln('## [${f.isActive ? "★ 活跃" : "参考"}] ${f.title}');
    if (f.content.isNotEmpty) {
      buffer.writeln(f.content);
    }
    buffer.writeln();
  }
  buffer.writeln('---');
  buffer.writeln('请基于以上所有面板的内容，回答用户的问题或提供关联分析。');

  final prompt = buffer.toString();

  return AIContextPrompt(
    systemPrompt: prompt,
    fragments: fragments,
    estimatedTokens: (prompt.length / 3).ceil(),
  );
});

// ──────────────────────────────────────────────
// 预测性关联推荐
// ──────────────────────────────────────────────

/// 预测性关联推荐 Provider
final predictiveLinksProvider =
    FutureProvider.family<List<PredictiveLink>, String>((ref, noteId) async {
  final repo = ref.read(noteRepositoryProvider);

  // 提前注册依赖：避免异步间隙中状态变化导致失活的计算不失效
  final status = ref.watch(modelStatusProvider);

  final currentNote = await repo.getNote(noteId);
  if (currentNote == null || currentNote.rawMarkdown.trim().isEmpty) {
    return [];
  }

  final allNotes = await repo.getAllNotes();
  if (allNotes.isEmpty) return [];

  // ── 语义路径（模型就绪）──
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
        if (nb.noteId == noteId) continue; // 防御：跳过自身
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
