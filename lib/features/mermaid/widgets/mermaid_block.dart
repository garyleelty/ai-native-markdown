import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../services/mermaid_service.dart';

/// ══════════════════════════════════════════════════
/// MermaidBlockWidget — Mermaid 图表渲染组件
/// ══════════════════════════════════════════════════
/// 显示渲染后的 Mermaid 图表，支持:
///   - 图片加载状态
///   - 错误回退 (显示原始代码)
///   - 点击放大查看
/// ──────────────────────────────────────────────────

class MermaidBlockWidget extends StatefulWidget {
  /// Mermaid 代码
  final String code;

  /// 是否显示为紧凑模式
  final bool compact;

  const MermaidBlockWidget({
    super.key,
    required this.code,
    this.compact = false,
  });

  @override
  State<MermaidBlockWidget> createState() => _MermaidBlockWidgetState();
}

class _MermaidBlockWidgetState extends State<MermaidBlockWidget> {
  final _service = MermaidService();

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  @override
  void didUpdateWidget(covariant MermaidBlockWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.code != widget.code) {
      _loadImage();
    }
  }

  void _loadImage() {
    // 预加载图片，通过 Image.network 自带错误处理
  }

  String get _imageUrl => _service.renderToUrl(widget.code);

  @override
  Widget build(BuildContext context) {
    final type = _getDiagramType(widget.code);

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
          // ── 标题栏 ──
          _buildHeader(type),
          // ── 图表内容 ──
          _buildContent(),
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
          Icon(Icons.account_tree_outlined,
              size: 14, color: AeroColors.accentPurple),
          const SizedBox(width: 6),
          Text(
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
              color: AeroColors.accentPurple.withOpacity(0.15),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Text(
              diagramType,
              style: TextStyle(
                fontSize: 9,
                color: AeroColors.accentPurple,
                fontFamily: 'monospace',
              ),
            ),
          ),
          const Spacer(),
          // 放大按钮
          _ZoomButton(imageUrl: _imageUrl),
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
            child: SizedBox(
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
          return _buildCodeFallback();
        },
      ),
    );
  }

  /// 加载失败时的代码回退显示
  Widget _buildCodeFallback() {
    return Container(
      padding: const EdgeInsets.all(12),
      color: AeroColors.bgDeep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded,
                  size: 12, color: AeroColors.accentOrange),
              const SizedBox(width: 4),
              Text(
                '图表加载失败，显示原始代码',
                style: TextStyle(
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
              style: TextStyle(
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

/// 放大查看按钮
class _ZoomButton extends StatelessWidget {
  final String imageUrl;
  const _ZoomButton({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => _showZoomDialog(context),
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Icon(Icons.zoom_in, size: 14, color: AeroColors.textMuted),
      ),
    );
  }

  void _showZoomDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: AeroColors.bgDeep,
        insetPadding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 标题栏
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: AeroColors.divider, width: 0.5),
                ),
              ),
              child: Row(
                children: [
                  Text('Mermaid 图表',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AeroColors.textPrimary)),
                  const Spacer(),
                  InkWell(
                    onTap: () => Navigator.of(ctx).pop(),
                    child: Icon(Icons.close,
                        size: 18, color: AeroColors.textMuted),
                  ),
                ],
              ),
            ),
            // 图片
            InteractiveViewer(
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
          ],
        ),
      ),
    );
  }
}
