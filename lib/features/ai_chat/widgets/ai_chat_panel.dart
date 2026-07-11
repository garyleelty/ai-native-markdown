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
import '../../../core/widgets/toolbar_button.dart';
import '../../../core/widgets/chip_button.dart';
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

class _AiChatPanelState extends ConsumerState<AiChatPanel>
    with SingleTickerProviderStateMixin {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _inputFocusNode = FocusNode();

  /// 本地显示的消息列表
  final List<ChatMessage> _messages = [];

  /// 是否正在等待 AI 响应
  bool _isLoading = false;

  /// 输入框是否有内容（控制发送按钮显示）
  bool _hasInputText = false;

  /// 打字指示器动画控制器
  late final AnimationController _typingController;

  @override
  void initState() {
    super.initState();
    _inputController.addListener(_onInputChanged);
    _typingController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _inputController.removeListener(_onInputChanged);
    _inputController.dispose();
    _scrollController.dispose();
    _inputFocusNode.dispose();
    _typingController.dispose();
    super.dispose();
  }

  void _onInputChanged() {
    if (mounted) {
      setState(() {
        _hasInputText = _inputController.text.trim().isNotEmpty;
      });
    }
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

  /// 发送快速操作消息
  void _sendQuickAction(String text) {
    _inputController.text = text;
    _sendMessage();
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
    return EditorToolbar(
      height: 40,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
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
              borderRadius: BorderRadius.circular(AeroRadius.sm),
            ),
            child: const Icon(Icons.auto_awesome, size: 14, color: Colors.white),
          ),
          const SizedBox(width: AeroSpacing.sm),
          const Text(
            'AI 助手',
            style: TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
      actions: [
        ToolbarButton(
          icon: Icons.delete_outline,
          tooltip: '清除对话',
          onTap: _clearConversation,
          size: 26,
          iconSize: 16,
        ),
        if (widget.onToggle != null)
          ToolbarButton(
            icon: Icons.chevron_right,
            tooltip: '折叠 AI 面板',
            onTap: widget.onToggle!,
            size: 26,
            iconSize: 16,
          ),
      ],
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
                onTap: () => _sendQuickAction('请总结当前笔记的主要内容'),
              ),
              const SizedBox(height: 6),
              _buildQuickActionChip(
                icon: Icons.lightbulb_outline,
                label: '生成相关想法',
                onTap: () => _sendQuickAction('基于当前笔记内容，生成一些相关的想法和延伸思考'),
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

  Widget _buildQuickActionChip({
    required IconData icon,
    required String label,
    VoidCallback? onTap,
  }) {
    return ChipButton(
      icon: icon,
      label: label,
      color: AeroColors.accentPurple,
      onTap: onTap,
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
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: isUser
                        ? const LinearGradient(
                            colors: [AeroColors.accentBlue, AeroColors.accentPurple],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          )
                        : null,
                    color: isUser ? null : AeroColors.bgElevated,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(isUser ? 8 : 4),
                      topRight: Radius.circular(isUser ? 4 : 8),
                      bottomLeft: const Radius.circular(8),
                      bottomRight: const Radius.circular(8),
                    ),
                    border: isUser
                        ? null
                        : Border.all(color: AeroColors.border, width: 0.5),
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      border: isUser
                          ? null
                          : const Border(
                              left: BorderSide(
                                color: AeroColors.accentCyan,
                                width: 2,
                              ),
                            ),
                    ),
                    padding: isUser
                        ? EdgeInsets.zero
                        : const EdgeInsets.only(left: 8),
                    child: SelectableText(
                      msg.content,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isUser
                                ? Colors.white
                                : AeroColors.textPrimary,
                            height: 1.6,
                          ),
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
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AeroColors.bgElevated,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(4),
                topRight: Radius.circular(8),
                bottomLeft: Radius.circular(8),
                bottomRight: Radius.circular(8),
              ),
              border: Border.all(color: AeroColors.border, width: 0.5),
            ),
            child: Container(
              decoration: const BoxDecoration(
                border: Border(
                  left: BorderSide(
                    color: AeroColors.accentCyan,
                    width: 2,
                  ),
                ),
              ),
              padding: const EdgeInsets.only(left: 8),
              child: _TypingIndicator(controller: _typingController),
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
                        horizontal: 8, vertical: 8),
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
                          color: AeroColors.accentPurple, width: 0.5),
                    ),
                    constraints: const BoxConstraints(
                      minHeight: 32,
                      maxHeight: 100,
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (_hasInputText && !_isLoading) ...[
            const SizedBox(width: 4),
            _SendButton(
              onTap: _sendMessage,
            ),
          ],
        ],
      ),
    );
  }
}

/// 打字指示器 — 三个跳动圆点
class _TypingIndicator extends StatelessWidget {
  final AnimationController controller;

  const _TypingIndicator({required this.controller});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildDot(0),
            const SizedBox(width: 3),
            _buildDot(1),
            const SizedBox(width: 3),
            _buildDot(2),
          ],
        );
      },
    );
  }

  Widget _buildDot(int index) {
    final delay = index * 0.15;
    final t = (controller.value + delay) % 1.0;
    final double translateY;

    if (t < 0.25) {
      translateY = -4 * (t / 0.25);
    } else if (t < 0.5) {
      translateY = -4 * (1 - (t - 0.25) / 0.25);
    } else {
      translateY = 0;
    }

    return Transform.translate(
      offset: Offset(0, translateY),
      child: Container(
        width: 6,
        height: 6,
        decoration: const BoxDecoration(
          color: AeroColors.accentCyan,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

/// 发送按钮（带悬停效果）
class _SendButton extends StatefulWidget {
  final VoidCallback onTap;

  const _SendButton({required this.onTap});

  @override
  State<_SendButton> createState() => _SendButtonState();
}

class _SendButtonState extends State<_SendButton> {
  bool _isHovering = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovering = true),
      onExit: (_) => setState(() => _isHovering = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeOutCubic,
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            gradient: _isHovering
                ? const LinearGradient(
                    colors: [AeroColors.accentBlue, AeroColors.accentPurple],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  )
                : null,
            color: _isHovering ? null : AeroColors.accentPurple.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Icon(
            Icons.send,
            size: 14,
            color: _isHovering ? Colors.white : AeroColors.accentPurple,
          ),
        ),
      ),
    );
  }
}
