/// ══════════════════════════════════════════════════
/// AiChatPanel — AI 对话面板
/// ══════════════════════════════════════════════════
/// 替换原有的 _AIContextSidePanel,提供基于当前笔记上下文的
/// AI 对话界面。通过 PluginRegistry 获取 AiChatPlugin 实例,
/// 调用 plugin.chat() 进行多轮对话。
/// 支持折叠/展开，以适配小屏幕。
/// ──────────────────────────────────────────────────
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/builtin_plugins/ai_chat_plugin.dart';
import '../../../core/plugin/plugin_registry.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/ai_provider.dart';
import '../../../providers/pane_provider.dart';

/// 发送消息意图 (用于 Shortcuts + Actions 处理 Enter 键)
class _SendMessageIntent extends Intent {
  const _SendMessageIntent();
}

/// AI 对话面板 — 替换 _AIContextSidePanel 的聊天 UI
class AiChatPanel extends ConsumerStatefulWidget {
  final bool isVisible;
  final VoidCallback? onToggle;

  const AiChatPanel({
    super.key,
    this.isVisible = true,
    this.onToggle,
  });

  @override
  ConsumerState<AiChatPanel> createState() => _AiChatPanelState();
}

class _AiChatPanelState extends ConsumerState<AiChatPanel> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _inputFocusNode = FocusNode();

  /// 本地显示的消息列表
  final List<ChatMessage> _messages = [];

  /// 是否正在等待 AI 响应
  bool _isLoading = false;

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    _inputFocusNode.dispose();
    super.dispose();
  }

  /// 获取已激活的 AiChatPlugin 实例
  AiChatPlugin? get _plugin {
    final p = PluginRegistry.instance.getPlugin(AiChatPlugin.pluginId);
    return p is AiChatPlugin ? p : null;
  }

  /// 滚动到底部
  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  /// 发送消息
  Future<void> _sendMessage() async {
    final text = _inputController.text.trim();
    final plugin = _plugin;
    if (text.isEmpty || plugin == null || _isLoading) return;

    _isLoading = true;
    _inputController.clear();

    setState(() {
      _messages.add(ChatMessage(
        role: 'user',
        content: text,
        timestamp: DateTime.now(),
      ));
    });
    _scrollToBottom();

    try {
      final response = await plugin.chat(text);
      if (mounted) {
        setState(() {
          _messages.add(ChatMessage(
            role: 'assistant',
            content: response,
            timestamp: DateTime.now(),
          ));
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages.add(ChatMessage(
            role: 'assistant',
            content: 'AI 响应失败: $e',
            timestamp: DateTime.now(),
          ));
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
        _scrollToBottom();
        _inputFocusNode.requestFocus();
      }
    }
  }

  /// 清除对话
  void _clearConversation() {
    _plugin?.clearHistory();
    setState(() {
      _messages.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isVisible) {
      return _buildCollapsedHandle(context);
    }

    final paneState = ref.watch(paneStackProvider);
    final aiContext = ref.watch(aiContextPromptProvider);
    final plugin = _plugin;

    final visibleNoteCount = paneState.panes.where((p) => !p.isStacked).length;
    final tokenEstimate = aiContext.estimatedTokens;

    return Container(
      width: 300,
      decoration: const BoxDecoration(
        color: AeroColors.bgSurface,
        border:
            Border(left: BorderSide(color: AeroColors.divider, width: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(context, visibleNoteCount, tokenEstimate),
          if (plugin == null || !plugin.isActive)
            Expanded(child: _buildNotActivated(context))
          else ...[
            Expanded(child: _buildMessageList(context)),
            _buildInputArea(context),
          ],
        ],
      ),
    );
  }

  /// 折叠状态下的把手条
  Widget _buildCollapsedHandle(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onToggle,
        child: Container(
          width: 28,
          decoration: const BoxDecoration(
            color: AeroColors.bgSurface,
            border: Border(
                left: BorderSide(color: AeroColors.divider, width: 0.5)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              RotatedBox(
                quarterTurns: 3,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AeroColors.bgElevated,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: AeroColors.border, width: 0.5),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.chat,
                          size: 12, color: AeroColors.accentPurple),
                      SizedBox(width: 4),
                      Text(
                        'AI 对话',
                        style: TextStyle(
                          color: AeroColors.accentPurple,
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              IconButton(
                icon: const Icon(Icons.chevron_left,
                    size: 16, color: AeroColors.textMuted),
                onPressed: widget.onToggle,
                splashRadius: 14,
                tooltip: '展开 AI 面板',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }

  /// 头部栏: 图标 + 标题 + 上下文信息 + 清除按钮 + 折叠按钮
  Widget _buildHeader(BuildContext context, int noteCount, int tokens) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(
            bottom: BorderSide(color: AeroColors.divider, width: 0.5)),
      ),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AeroColors.accentPurple, AeroColors.accentBlue],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(Icons.auto_awesome, size: 14, color: Colors.white),
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'AI 助手',
              style: TextStyle(
                color: AeroColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          _IconButton(
            icon: Icons.delete_outline,
            tooltip: '清除对话',
            onTap: _clearConversation,
          ),
          if (widget.onToggle != null)
            _IconButton(
              icon: Icons.chevron_right,
              tooltip: '折叠 AI 面板',
              onTap: widget.onToggle!,
            ),
        ],
      ),
    );
  }

  /// 插件未激活提示
  Widget _buildNotActivated(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.warning_amber_rounded,
                size: 32, color: AeroColors.accentOrange),
            const SizedBox(height: 8),
            Text(
              'AI 对话插件未激活',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AeroColors.textSecondary,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              '按 Cmd/Ctrl+Shift+P 打开插件管理',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AeroColors.textMuted,
                    fontSize: 11,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  /// 消息列表
  Widget _buildMessageList(BuildContext context) {
    if (_messages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AeroColors.accentPurple.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.auto_awesome,
                  size: 24,
                  color: AeroColors.accentPurple,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'AI 对话助手',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AeroColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                '基于当前打开的笔记内容\n回答问题、总结要点、生成想法',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AeroColors.textMuted,
                      height: 1.5,
                    ),
              ),
              const SizedBox(height: 16),
              _buildQuickActionChip(
                icon: Icons.summarize,
                label: '总结当前笔记',
              ),
              const SizedBox(height: 6),
              _buildQuickActionChip(
                icon: Icons.lightbulb_outline,
                label: '生成相关想法',
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.all(8),
      itemCount: _messages.length + (_isLoading ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == _messages.length && _isLoading) {
          return _buildLoadingBubble(context);
        }
        return _buildMessageBubble(context, _messages[index]);
      },
    );
  }

  Widget _buildQuickActionChip({required IconData icon, required String label}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AeroColors.border, width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AeroColors.accentPurple),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: AeroColors.textSecondary,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  /// 单条消息气泡
  Widget _buildMessageBubble(BuildContext context, ChatMessage msg) {
    final isUser = msg.role == 'user';
    final timeStr = DateFormat('HH:mm').format(msg.timestamp);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            const Icon(Icons.smart_toy_outlined,
                size: 14, color: AeroColors.accentCyan),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isUser
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isUser
                        ? AeroColors.accentBlue.withValues(alpha: 0.15)
                        : AeroColors.bgElevated,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isUser
                          ? AeroColors.accentBlue.withValues(alpha: 0.3)
                          : AeroColors.border,
                      width: 0.5,
                    ),
                  ),
                  child: SelectableText(
                    msg.content,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AeroColors.textPrimary,
                          height: 1.4,
                        ),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  timeStr,
                  style: const TextStyle(
                    color: AeroColors.textMuted,
                    fontSize: 9,
                  ),
                ),
              ],
            ),
          ),
          if (isUser) ...[
            const SizedBox(width: 4),
            const Icon(Icons.person_outline,
                size: 14, color: AeroColors.accentBlue),
          ],
        ],
      ),
    );
  }

  /// 加载中气泡
  Widget _buildLoadingBubble(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          const Icon(Icons.smart_toy_outlined,
              size: 14, color: AeroColors.accentCyan),
          const SizedBox(width: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AeroColors.bgElevated,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AeroColors.border, width: 0.5),
            ),
            child: const SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                valueColor:
                    AlwaysStoppedAnimation<Color>(AeroColors.accentCyan),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 输入区域: TextField + 发送按钮
  /// Enter 发送, Shift+Enter 换行
  Widget _buildInputArea(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(top: BorderSide(color: AeroColors.divider, width: 0.5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Shortcuts(
              shortcuts: {
                const SingleActivator(LogicalKeyboardKey.enter):
                    const _SendMessageIntent(),
              },
              child: Actions(
                actions: {
                  _SendMessageIntent: CallbackAction<Intent>(
                    onInvoke: (_) {
                      _sendMessage();
                      return null;
                    },
                  ),
                },
                child: TextField(
                  controller: _inputController,
                  focusNode: _inputFocusNode,
                  maxLines: null,
                  minLines: 1,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AeroColors.textPrimary,
                      ),
                  decoration: InputDecoration(
                    hintText: 'Enter 发送, Shift+Enter 换行',
                    hintStyle:
                        Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AeroColors.textMuted,
                              fontSize: 11,
                            ),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 6),
                    filled: true,
                    fillColor: AeroColors.bgSurface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4),
                      borderSide: const BorderSide(
                          color: AeroColors.border, width: 0.5),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4),
                      borderSide: const BorderSide(
                          color: AeroColors.border, width: 0.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4),
                      borderSide: const BorderSide(
                          color: AeroColors.accentBlue, width: 0.5),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            icon: const Icon(Icons.send, size: 16),
            color: AeroColors.accentBlue,
            onPressed: _isLoading ? null : _sendMessage,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          ),
        ],
      ),
    );
  }
}

class _IconButton extends StatefulWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final double size;

  const _IconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.size = 16,
  });

  @override
  State<_IconButton> createState() => _IconButtonState();
}

class _IconButtonState extends State<_IconButton> {
  bool _isHovering = false;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: widget.tooltip,
      waitDuration: const Duration(milliseconds: 600),
      decoration: BoxDecoration(
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AeroColors.border, width: 0.5),
        boxShadow: const [
          BoxShadow(
            color: AeroColors.shadow,
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      textStyle: const TextStyle(
        color: AeroColors.textPrimary,
        fontSize: 11,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: MouseRegion(
        onEnter: (_) => setState(() => _isHovering = true),
        onExit: (_) => setState(() => _isHovering = false),
        child: GestureDetector(
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeOutCubic,
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: _isHovering
                  ? AeroColors.accentBlue.withValues(alpha: 0.12)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Icon(
              widget.icon,
              size: widget.size,
              color: _isHovering
                  ? AeroColors.textPrimary
                  : AeroColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}
