import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/toolbar_button.dart';
import '../../../core/widgets/close_button.dart';
import '../../../providers/settings_provider.dart';
import '../services/mermaid_service.dart';

class MermaidBlockWidget extends ConsumerStatefulWidget {
  final String code;
  final bool compact;

  const MermaidBlockWidget({
    super.key,
    required this.code,
    this.compact = false,
  });

  @override
  ConsumerState<MermaidBlockWidget> createState() => _MermaidBlockWidgetState();
}

class _MermaidBlockWidgetState extends ConsumerState<MermaidBlockWidget> {
  String get _imageUrl => MermaidService().renderToUrl(widget.code);

  @override
  Widget build(BuildContext context) {
    final type = _getDiagramType(widget.code);
    final mermaidEnabled = ref.watch(
      settingsProvider.select((s) => s.mermaidEnabled),
    );

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AeroColors.border, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(type),
          mermaidEnabled ? _buildContent() : _buildConsentPrompt(),
        ],
      ),
    );
  }

  String _getDiagramType(String code) {
    final firstLine = code.trimLeft().split('\n').first.trim();
    final parts = firstLine.split(' ');
    return parts.isNotEmpty ? parts.first : 'unknown';
  }

  Widget _buildHeader(String diagramType) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.account_tree_outlined,
              size: 14, color: AeroColors.accentPurple),
          const SizedBox(width: 6),
          const Text(
            'Mermaid 图表',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AeroColors.textSecondary,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(
              color: AeroColors.accentPurple.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Text(
              diagramType,
              style: const TextStyle(
                fontSize: 9,
                color: AeroColors.accentPurple,
                fontFamily: 'monospace',
              ),
            ),
          ),
          const Spacer(),
          Consumer(
            builder: (context, ref, _) {
              final enabled = ref.watch(
                settingsProvider.select((s) => s.mermaidEnabled),
              );
              if (!enabled) return const SizedBox.shrink();
              return ToolbarButton(
                icon: Icons.zoom_in,
                tooltip: '放大查看',
                onTap: () => _showZoomDialog(context, _imageUrl),
                size: 24,
                iconSize: 14,
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(8)),
      child: Image.network(
        _imageUrl,
        fit: BoxFit.contain,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return Container(
            height: 120,
            alignment: Alignment.center,
            child: const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor:
                    AlwaysStoppedAnimation(AeroColors.accentBlue),
              ),
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) {
          return _buildCodeFallback('图表加载失败，请检查网络连接');
        },
      ),
    );
  }

  Widget _buildConsentPrompt() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: AeroColors.bgDeep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.privacy_tip_outlined,
                  size: 14, color: AeroColors.accentOrange),
              SizedBox(width: 6),
              Text(
                '需要在线渲染服务',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AeroColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Mermaid 图表渲染使用 mermaid.ink 在线服务（第三方服务）。'
            '启用后，图表代码将通过 HTTPS 发送至 mermaid.ink 服务器进行渲染。'
            '你可以随时在设置中关闭此功能。',
            style: TextStyle(
              fontSize: 11,
              color: AeroColors.textMuted,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              TextButton(
                onPressed: () => ref
                    .read(settingsProvider.notifier)
                    .setMermaidEnabled(true),
                style: TextButton.styleFrom(
                  backgroundColor: AeroColors.accentPurple.withValues(alpha: 0.15),
                  foregroundColor: AeroColors.accentPurple,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                ),
                child: const Text('启用并渲染', style: TextStyle(fontSize: 11)),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: () => _showCodeOnly(context),
                style: TextButton.styleFrom(
                  foregroundColor: AeroColors.textMuted,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                ),
                child: const Text('仅显示代码', style: TextStyle(fontSize: 11)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showCodeOnly(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: AeroColors.bgDeep,
        insetPadding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: const BoxDecoration(
                border: Border(
                  bottom:
                      BorderSide(color: AeroColors.divider, width: 0.5),
                ),
              ),
              child: Row(
                children: [
                  const Text('Mermaid 源码',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AeroColors.textPrimary)),
                  const Spacer(),
                  InkWell(
                    onTap: () => Navigator.of(ctx).pop(),
                    child: const Icon(Icons.close,
                        size: 18, color: AeroColors.textMuted),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AeroColors.bgSurface,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: SelectableText(
                    widget.code,
                    style: const TextStyle(
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: AeroColors.textSecondary,
                      height: 1.5,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCodeFallback(String message) {
    return Container(
      padding: const EdgeInsets.all(12),
      color: AeroColors.bgDeep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber_rounded,
                  size: 12, color: AeroColors.accentOrange),
              const SizedBox(width: 4),
              Text(
                message,
                style: const TextStyle(
                  fontSize: 10,
                  color: AeroColors.accentOrange,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AeroColors.bgSurface,
              borderRadius: BorderRadius.circular(4),
            ),
            child: SelectableText(
              widget.code,
              style: const TextStyle(
                fontSize: 11,
                fontFamily: 'monospace',
                color: AeroColors.textSecondary,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

void _showZoomDialog(BuildContext context, String imageUrl) {
  showDialog<void>(
    context: context,
    builder: (ctx) => Dialog(
      backgroundColor: AeroColors.bgDeep,
      insetPadding: const EdgeInsets.all(20),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AeroRadius.lg),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              border: Border(
                bottom:
                    BorderSide(color: AeroColors.divider, width: 0.5),
              ),
            ),
            child: Row(
              children: [
                const Text('Mermaid 图表',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AeroColors.textPrimary)),
                const Spacer(),
                AeroCloseButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  size: AeroCloseButtonSize.sm,
                ),
              ],
            ),
          ),
          Flexible(
            child: InteractiveViewer(
              maxScale: 5.0,
              child: Image.network(
                imageUrl,
                fit: BoxFit.contain,
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return const SizedBox(
                    height: 200,
                    child: Center(child: CircularProgressIndicator()),
                  );
                },
                errorBuilder: (context, error, stackTrace) {
                  return const SizedBox(
                    height: 100,
                    child: Center(
                      child: Text('加载失败',
                          style: TextStyle(color: AeroColors.textMuted)),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
