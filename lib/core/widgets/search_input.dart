import 'package:flutter/material.dart';
import '../theme/aeromind_theme.dart';

class SearchInput extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode? focusNode;
  final String hintText;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final double height;
  final IconData prefixIcon;
  final bool showClearButton;
  final TextInputAction? textInputAction;
  final VoidCallback? onClear;

  const SearchInput({
    super.key,
    required this.controller,
    this.focusNode,
    this.hintText = '搜索...',
    this.onChanged,
    this.onSubmitted,
    this.height = 36,
    this.prefixIcon = Icons.search,
    this.showClearButton = true,
    this.textInputAction,
    this.onClear,
  });

  @override
  State<SearchInput> createState() => _SearchInputState();
}

class _SearchInputState extends State<SearchInput> {
  late FocusNode _focusNode;
  bool _isFocused = false;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _focusNode = widget.focusNode ?? FocusNode();
    _focusNode.addListener(_onFocusChanged);
    widget.controller.addListener(_onTextChanged);
    _hasText = widget.controller.text.isNotEmpty;
  }

  @override
  void dispose() {
    if (widget.focusNode == null) {
      _focusNode.dispose();
    }
    _focusNode.removeListener(_onFocusChanged);
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onFocusChanged() {
    if (mounted) {
      setState(() => _isFocused = _focusNode.hasFocus);
    }
  }

  void _onTextChanged() {
    if (mounted) {
      setState(() => _hasText = widget.controller.text.isNotEmpty);
    }
  }

  void _clear() {
    widget.controller.clear();
    widget.onChanged?.call('');
    widget.onClear?.call();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: widget.height,
      child: TextField(
        controller: widget.controller,
        focusNode: _focusNode,
        onChanged: widget.onChanged,
        onSubmitted: widget.onSubmitted,
        textInputAction: widget.textInputAction,
        style: const TextStyle(
          color: AeroColors.textPrimary,
          fontSize: 13,
        ),
        decoration: InputDecoration(
          hintText: widget.hintText,
          hintStyle: const TextStyle(color: AeroColors.textMuted),
          prefixIcon: Icon(
            widget.prefixIcon,
            size: 16,
            color: _isFocused ? AeroColors.accentBlue : AeroColors.textMuted,
          ),
          suffixIcon: widget.showClearButton && _hasText
              ? IconButton(
                  icon: const Icon(
                    Icons.close,
                    size: 14,
                    color: AeroColors.textMuted,
                  ),
                  onPressed: _clear,
                  splashRadius: 12,
                  padding: const EdgeInsets.all(4),
                  constraints: const BoxConstraints(),
                )
              : null,
          filled: true,
          fillColor: AeroColors.bgDeep,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 8,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(6),
            borderSide: const BorderSide(color: AeroColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(6),
            borderSide:
                const BorderSide(color: AeroColors.border, width: 0.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(6),
            borderSide:
                const BorderSide(color: AeroColors.accentBlue, width: 1),
          ),
          isDense: true,
        ),
      ),
    );
  }
}
