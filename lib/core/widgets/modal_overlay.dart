import 'package:flutter/material.dart';
import '../theme/aeromind_theme.dart';

enum OverlayPosition { center, topCenter }

class ModalOverlay extends StatefulWidget {
  final Widget child;
  final bool isOpen;
  final VoidCallback onClose;
  final OverlayPosition position;
  final Duration duration;
  final Curve curve;
  final bool dismissOnMaskTap;
  final double? width;
  final double? height;

  const ModalOverlay({
    super.key,
    required this.child,
    required this.isOpen,
    required this.onClose,
    this.position = OverlayPosition.center,
    this.duration = const Duration(milliseconds: 200),
    this.curve = Curves.easeOutCubic,
    this.dismissOnMaskTap = true,
    this.width,
    this.height,
  });

  @override
  State<ModalOverlay> createState() => _ModalOverlayState();
}

class _ModalOverlayState extends State<ModalOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnimation;
  late final Animation<double> _scaleAnimation;

  bool _visible = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _fadeAnimation = CurvedAnimation(parent: _controller, curve: widget.curve);
    _scaleAnimation = Tween<double>(begin: 0.95, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: widget.curve),
    );
    _visible = widget.isOpen;
    if (widget.isOpen) {
      _controller.forward();
    }
  }

  @override
  void didUpdateWidget(ModalOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isOpen != widget.isOpen) {
      if (widget.isOpen) {
        setState(() => _visible = true);
        _controller.forward();
      } else {
        _controller.reverse().then((_) {
          if (mounted) setState(() => _visible = false);
        });
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible) return const SizedBox.shrink();

    return Material(
      color: Colors.black54,
      child: GestureDetector(
        onTap: widget.dismissOnMaskTap ? widget.onClose : null,
        behavior: HitTestBehavior.opaque,
        child: _buildPositionedChild(),
      ),
    );
  }

  Widget _buildPositionedChild() {
    switch (widget.position) {
      case OverlayPosition.center:
        return Center(
          child: GestureDetector(
            onTap: () {},
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: ScaleTransition(
                scale: _scaleAnimation,
                child: _buildDialogContainer(),
              ),
            ),
          ),
        );
      case OverlayPosition.topCenter:
        return SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: Padding(
              padding: const EdgeInsets.only(top: 80),
              child: GestureDetector(
                onTap: () {},
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, -0.1),
                      end: Offset.zero,
                    ).animate(CurvedAnimation(
                      parent: _controller,
                      curve: widget.curve,
                    )),
                    child: _buildDialogContainer(),
                  ),
                ),
              ),
            ),
          ),
        );
    }
  }

  Widget _buildDialogContainer() {
    if (widget.width == null && widget.height == null) {
      return widget.child;
    }
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: widget.child,
    );
  }
}

class DialogContainer extends StatelessWidget {
  final Widget child;
  final double width;
  final double? height;
  final BorderRadius? borderRadius;
  final Color? backgroundColor;
  final List<BoxShadow>? shadows;

  const DialogContainer({
    super.key,
    required this.child,
    this.width = 640,
    this.height,
    this.borderRadius,
    this.backgroundColor,
    this.shadows,
  });

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(12);
    return Container(
      width: width,
      height: height,
      constraints: height == null
          ? const BoxConstraints(maxHeight: 600)
          : null,
      decoration: BoxDecoration(
        color: backgroundColor ?? AeroColors.bgElevated,
        borderRadius: radius,
        border: Border.all(color: AeroColors.border, width: 0.5),
        boxShadow: shadows ??
            const [
              BoxShadow(
                color: AeroColors.shadow,
                blurRadius: 24,
                offset: Offset(0, 8),
              ),
            ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: child,
      ),
    );
  }
}
