/// ══════════════════════════════════════════════════
/// AiChatPlugin — AI 对话插件 (内置)
/// ══════════════════════════════════════════════════
/// 基于 AI 上下文窗口,让用户与 AI 对话讨论当前笔记内容。
/// 通过 PluginApi.aiContextPrompt 获取上下文骨架,
/// 异步读取笔记内容填充,调用 LlmClient 发送对话。
/// ──────────────────────────────────────────────────
library;

import '../../features/ai_engine/services/llm_client_factory.dart';
import '../plugin/base_plugin.dart';
import '../plugin/plugin_api.dart';
import '../plugin/plugin_manifest.dart';

/// 对话消息 (非持久化,仅在插件生命周期内保留)
class ChatMessage {
  /// 角色: 'user' | 'assistant'
  final String role;

  /// 消息内容
  final String content;

  /// 时间戳
  final DateTime timestamp;

  const ChatMessage({
    required this.role,
    required this.content,
    required this.timestamp,
  });
}

/// AI 对话插件 — 基于当前笔记上下文与 AI 进行多轮对话
class AiChatPlugin extends BasePlugin {
  /// 插件唯一 ID
  static const String pluginId = 'com.aeromind.ai-chat';

  /// 对话历史 (非持久化,仅内存保留以支持多轮对话)
  final List<ChatMessage> _history = [];

  /// 只读历史访问 (供 UI 读取)
  List<ChatMessage> get history => List.unmodifiable(_history);

  @override
  PluginManifest get manifest => const PluginManifest(
        id: pluginId,
        name: 'AI 对话',
        version: '1.0.0',
        description: '基于当前笔记上下文与 AI 对话讨论',
        author: 'AeroMind',
        extensionTypes: ['command'],
        category: 'AI',
        iconCodePoint: 0xe0b0, // Icons.chat
        settings: [
          PluginSettingDef(
            key: 'llm_endpoint',
            label: 'LLM API 端点',
            description: 'OpenAI 兼容 API 端点 URL',
          ),
          PluginSettingDef(
            key: 'llm_api_key',
            label: 'LLM API Key',
            description: 'API 密钥',
          ),
          PluginSettingDef(
            key: 'llm_model',
            label: 'LLM 模型',
            defaultValue: 'gpt-3.5-turbo',
            description: '模型名称 (默认 gpt-3.5-turbo)',
          ),
        ],
      );

  @override
  Future<void> onActivate(PluginContext ctx) async {
    final model = ctx.storage.getString('llm_model') ?? 'gpt-3.5-turbo';
    await ctx.storage.putString('llm_model', model);
  }

  @override
  List<PluginCommand> getCommands() => [
        PluginCommand(
          id: 'plugin.ai-chat.open',
          name: '打开 AI 对话',
          description: '打开 AI 对话面板，基于当前笔记上下文进行对话',
          iconCodePoint: 0xe0b0,
          pluginId: manifest.id,
          category: 'AI',
          action: () async {
            context?.api.showNotification(
              'AI 对话面板位于右侧边栏；发送消息前请先在插件设置中配置 LLM API。',
              type: NotificationType.info,
            );
          },
        ),
      ];

  /// 清空对话历史
  void clearHistory() {
    _history.clear();
  }

  /// 核心对话方法
  ///
  /// 流程:
  /// 1. 读取 LLM 配置 (从插件存储,不依赖应用全局设置)
  /// 2. 构建 system prompt (含笔记上下文)
  /// 3. 调用 LLM (携带完整对话历史)
  /// 4. 返回响应并更新历史
  Future<String> chat(String userMessage) async {
    final ctx = context;
    if (ctx == null) {
      return 'AI 对话插件未激活';
    }

    final api = ctx.api;

    // 1. 读取 LLM 配置 (从插件存储,不依赖应用全局设置)
    final endpoint = ctx.storage.getString('llm_endpoint') ?? '';
    final apiKey = ctx.storage.getString('llm_api_key') ?? '';
    final model = ctx.storage.getString('llm_model') ?? 'gpt-3.5-turbo';

    if (endpoint.isEmpty || apiKey.isEmpty) {
      return '请先在插件设置中配置 LLM API 端点和密钥';
    }

    // 2. 构建系统提示 (含笔记上下文)
    final systemPrompt = await _buildSystemPrompt(api);

    // 3. 调用 LLM
    try {
      final client = createLlmClient();
      final response = await client.callLlm(
        endpoint: endpoint,
        apiKey: apiKey,
        model: model,
        maxTokens: 1024,
        temperature: 0.7,
        systemPrompt: systemPrompt,
        userPrompt: userMessage,
        history: _history
            .map((m) => {'role': m.role, 'content': m.content})
            .toList(),
      );

      if (response == null || response.isEmpty) {
        return 'AI 响应失败: 未获得有效响应，请检查 API 配置或网络连接';
      }

      // 4. 更新对话历史
      _history.add(ChatMessage(
        role: 'user',
        content: userMessage,
        timestamp: DateTime.now(),
      ));
      _history.add(ChatMessage(
        role: 'assistant',
        content: response,
        timestamp: DateTime.now(),
      ));

      return response;
    } catch (e) {
      return 'AI 响应失败: $e';
    }
  }

  /// 构建系统提示 (含笔记上下文)
  ///
  /// 1. 异步 getNote() 填充内容 (每篇截断至 2000 字符)
  /// 2. 总上下文超过 6000 字符时,只保留活跃笔记 + 前 2 篇参考
  Future<String> _buildSystemPrompt(PluginApi api) async {
    final buffer = StringBuffer();
    buffer.writeln('你是一个智能笔记助手。用户正在 AeroMind 笔记应用中查看以下笔记，');
    buffer.writeln('请基于笔记内容回答问题或参与讨论。如问题与笔记无关，可正常对话但优先结合笔记上下文。');
    buffer.writeln();

    // 异步获取笔记内容
    final openNoteIds = api.openNoteIds;
    final activeNoteId = api.activeNoteId;

    final activeNotes = <_NoteContext>[];
    final referenceNotes = <_NoteContext>[];

    for (final noteId in openNoteIds) {
      final note = await api.getNote(noteId);
      if (note == null) continue;
      var content = note.rawMarkdown;
      if (content.length > 2000) {
        content = '${content.substring(0, 2000)}…';
      }
      final noteCtx = _NoteContext(
        noteId: noteId,
        title: note.title,
        content: content,
        isActive: noteId == activeNoteId,
      );
      if (noteCtx.isActive) {
        activeNotes.add(noteCtx);
      } else {
        referenceNotes.add(noteCtx);
      }
    }

    // 控制上下文长度: 超过 6000 字符时只保留活跃笔记 + 前 2 篇参考
    final allNotes = [...activeNotes, ...referenceNotes];
    final totalChars = allNotes.fold<int>(0, (sum, n) => sum + n.content.length);

    final List<_NoteContext> included;
    if (totalChars > 6000) {
      included = [...activeNotes, ...referenceNotes.take(2)];
    } else {
      included = allNotes;
    }

    // 输出笔记上下文
    if (included.isEmpty) {
      buffer.writeln('当前没有打开的笔记，请正常与用户对话。');
    } else {
      buffer.writeln('当前打开的笔记:');
      buffer.writeln();
      for (final n in included) {
        buffer.writeln('## [${n.isActive ? "★ 活跃" : "参考"}] ${n.title}');
        buffer.writeln(n.content);
        buffer.writeln();
      }
    }

    buffer.writeln('---');
    buffer.writeln('请基于以上笔记内容回答用户的问题。如问题与笔记无关，可正常对话。');

    return buffer.toString();
  }

  /// 将一条消息加入历史（用于从 UI 恢复上下文）
  void addMessage(ChatMessage message) {
    _history.add(message);
  }
}

/// 笔记上下文 (内部辅助类)
class _NoteContext {
  final String noteId;
  final String title;
  final String content;
  final bool isActive;

  const _NoteContext({
    required this.noteId,
    required this.title,
    required this.content,
    required this.isActive,
  });
}
