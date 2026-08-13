/// ══════════════════════════════════════════════════
/// AiChat Provider — AI 对话状态持久化
/// ══════════════════════════════════════════════════
/// 将 AI 对话历史和输入草稿从 AiChatPanel 的本地 State 提升，
/// 避免面板销毁/重建时丢失对话内容。
/// ──────────────────────────────────────────────────

library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/builtin_plugins/ai_chat_plugin.dart';

/// AI 对话状态
class AiChatState {
  /// 对话消息列表
  final List<ChatMessage> messages;

  /// 是否正在等待 AI 响应
  final bool isLoading;

  /// 输入框草稿
  final String inputDraft;

  const AiChatState({
    this.messages = const [],
    this.isLoading = false,
    this.inputDraft = '',
  });

  AiChatState copyWith({
    List<ChatMessage>? messages,
    bool? isLoading,
    String? inputDraft,
  }) {
    return AiChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      inputDraft: inputDraft ?? this.inputDraft,
    );
  }
}

/// AI 对话 Notifier
class AiChatNotifier extends Notifier<AiChatState> {
  @override
  AiChatState build() => const AiChatState();

  /// 添加用户消息
  void addUserMessage(String content) {
    final message = ChatMessage(
      role: 'user',
      content: content,
      timestamp: DateTime.now(),
    );
    state = state.copyWith(
      messages: [...state.messages, message],
    );
  }

  /// 添加 AI 响应消息
  void addAssistantMessage(String content) {
    final message = ChatMessage(
      role: 'assistant',
      content: content,
      timestamp: DateTime.now(),
    );
    state = state.copyWith(
      messages: [...state.messages, message],
    );
  }

  /// 设置加载状态
  void setLoading(bool loading) {
    state = state.copyWith(isLoading: loading);
  }

  /// 设置输入草稿
  void setInputDraft(String draft) {
    state = state.copyWith(inputDraft: draft);
  }

  /// 清空对话
  void clearMessages() {
    state = state.copyWith(messages: const []);
  }
}

/// AI 对话状态 Provider
final aiChatProvider =
    NotifierProvider<AiChatNotifier, AiChatState>(AiChatNotifier.new);
