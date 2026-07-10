/// ══════════════════════════════════════════════════
/// PluginSettingsForm — 插件设置表单
/// ══════════════════════════════════════════════════
/// 根据 PluginManifest.settings 渲染对应输入控件，
/// 修改即时持久化到隔离的 PluginStorage。
/// ──────────────────────────────────────────────────

library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/plugin/plugin_manifest.dart';
import '../../../core/plugin/plugin_storage.dart';

/// 插件设置表单
///
/// 根据 [manifest.settings] 中每个 [PluginSettingDef] 的 type 渲染对应控件：
/// string → TextField / number → 数字 TextField / boolean → Switch / choice → DropdownButton。
/// 每次修改即时通过 [storage] 持久化（单次写入）。
class PluginSettingsForm extends ConsumerWidget {
  /// 插件清单（提供 settings 定义）
  final PluginManifest manifest;

  /// 插件隔离存储（读写设置值）
  final PluginStorage storage;

  const PluginSettingsForm({
    super.key,
    required this.manifest,
    required this.storage,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (manifest.settings.isEmpty) {
      return const Center(
        child: Text(
          '此插件无可配置项',
          style: TextStyle(color: AeroColors.textMuted, fontSize: 13),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final setting in manifest.settings) ...[
            _buildSettingTile(setting),
            const SizedBox(height: 16),
          ],
        ],
      ),
    );
  }

  /// 根据 setting.type 分发到具体的 tile 组件
  Widget _buildSettingTile(PluginSettingDef setting) {
    switch (setting.type) {
      case PluginSettingType.string:
        return _StringSettingTile(setting: setting, storage: storage);
      case PluginSettingType.number:
        return _NumberSettingTile(setting: setting, storage: storage);
      case PluginSettingType.boolean:
        return _BooleanSettingTile(setting: setting, storage: storage);
      case PluginSettingType.choice:
        return _ChoiceSettingTile(setting: setting, storage: storage);
    }
  }
}

// ──────────────────────────────────────────────────────
// 共享子组件
// ──────────────────────────────────────────────────────

/// 设置项的标题 + 副标题描述
class _SettingHeader extends StatelessWidget {
  final String label;
  final String description;

  const _SettingHeader({required this.label, required this.description});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AeroColors.textPrimary,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
        if (description.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            description,
            style: const TextStyle(
              color: AeroColors.textMuted,
              fontSize: 11,
            ),
          ),
        ],
      ],
    );
  }
}

/// 通用输入框装饰（参考 plugin_manager_panel.dart 风格）
InputDecoration _buildInputDecoration({bool hasError = false}) {
  final borderColor =
      hasError ? AeroColors.accentRed : AeroColors.border;
  return InputDecoration(
    filled: true,
    fillColor: AeroColors.bgDeep,
    contentPadding:
        const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    helperText: hasError ? '请输入数字' : null,
    helperStyle: const TextStyle(color: AeroColors.accentRed, fontSize: 11),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(6),
      borderSide: BorderSide(color: borderColor, width: 0.5),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(6),
      borderSide: BorderSide(color: borderColor, width: 0.5),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(6),
      borderSide: BorderSide(
        color: hasError ? AeroColors.accentRed : AeroColors.accentBlue,
        width: 1,
      ),
    ),
  );
}

// ──────────────────────────────────────────────────────
// 各类型设置项 tile
// ──────────────────────────────────────────────────────

/// string 类型：TextField，即时持久化
class _StringSettingTile extends StatefulWidget {
  final PluginSettingDef setting;
  final PluginStorage storage;

  const _StringSettingTile({
    required this.setting,
    required this.storage,
  });

  @override
  State<_StringSettingTile> createState() => _StringSettingTileState();
}

class _StringSettingTileState extends State<_StringSettingTile> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    final initial = widget.storage.getString(widget.setting.key) ??
        widget.setting.defaultValue?.toString() ??
        '';
    _controller = TextEditingController(text: initial);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SettingHeader(
          label: widget.setting.label,
          description: widget.setting.description,
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _controller,
          style:
              const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
          decoration: _buildInputDecoration(),
          onChanged: (value) {
            widget.storage.putString(widget.setting.key, value);
          },
        ),
      ],
    );
  }
}

/// number 类型：TextField + 数字校验，非法时不持久化并显示红边框
class _NumberSettingTile extends StatefulWidget {
  final PluginSettingDef setting;
  final PluginStorage storage;

  const _NumberSettingTile({
    required this.setting,
    required this.storage,
  });

  @override
  State<_NumberSettingTile> createState() => _NumberSettingTileState();
}

class _NumberSettingTileState extends State<_NumberSettingTile> {
  late final TextEditingController _controller;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    final initial = widget.storage.getString(widget.setting.key) ??
        widget.setting.defaultValue?.toString() ??
        '';
    _controller = TextEditingController(text: initial);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SettingHeader(
          label: widget.setting.label,
          description: widget.setting.description,
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _controller,
          keyboardType: TextInputType.number,
          style:
              const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
          decoration: _buildInputDecoration(hasError: _hasError),
          onChanged: (value) {
            // 空字符串视为合法（重置输入），不持久化也不报错
            if (value.isEmpty) {
              setState(() => _hasError = false);
              return;
            }
            final parsed =
                int.tryParse(value) ?? double.tryParse(value);
            if (parsed != null) {
              setState(() => _hasError = false);
              widget.storage.putString(widget.setting.key, value);
            } else {
              // 非数字：显示红边框 + helperText，不持久化
              setState(() => _hasError = true);
            }
          },
        ),
      ],
    );
  }
}

/// boolean 类型：Switch，即时持久化
class _BooleanSettingTile extends StatefulWidget {
  final PluginSettingDef setting;
  final PluginStorage storage;

  const _BooleanSettingTile({
    required this.setting,
    required this.storage,
  });

  @override
  State<_BooleanSettingTile> createState() => _BooleanSettingTileState();
}

class _BooleanSettingTileState extends State<_BooleanSettingTile> {
  late bool _value;

  @override
  void initState() {
    super.initState();
    _value = widget.storage.getBool(widget.setting.key) ??
        (widget.setting.defaultValue == true);
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: _SettingHeader(
            label: widget.setting.label,
            description: widget.setting.description,
          ),
        ),
        const SizedBox(width: 12),
        Switch(
          value: _value,
          onChanged: (value) {
            setState(() => _value = value);
            widget.storage.putBool(widget.setting.key, value);
          },
          activeThumbColor: AeroColors.accentCyan,
        ),
      ],
    );
  }
}

/// choice 类型：DropdownButton，即时持久化
class _ChoiceSettingTile extends StatefulWidget {
  final PluginSettingDef setting;
  final PluginStorage storage;

  const _ChoiceSettingTile({
    required this.setting,
    required this.storage,
  });

  @override
  State<_ChoiceSettingTile> createState() => _ChoiceSettingTileState();
}

class _ChoiceSettingTileState extends State<_ChoiceSettingTile> {
  String? _value;

  @override
  void initState() {
    super.initState();
    final stored = widget.storage.getString(widget.setting.key);
    final defaultVal = widget.setting.defaultValue?.toString();
    final choices = widget.setting.choices;
    _value = stored ?? defaultVal ?? (choices.isNotEmpty ? choices.first : null);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SettingHeader(
          label: widget.setting.label,
          description: widget.setting.description,
        ),
        const SizedBox(height: 8),
        DropdownButton<String>(
          value: _value,
          items: widget.setting.choices
              .map((c) => DropdownMenuItem<String>(
                    value: c,
                    child: Text(
                      c,
                      style: const TextStyle(
                        color: AeroColors.textPrimary,
                        fontSize: 13,
                      ),
                    ),
                  ))
              .toList(),
          onChanged: (value) {
            if (value == null) return;
            setState(() => _value = value);
            widget.storage.putString(widget.setting.key, value);
          },
          dropdownColor: AeroColors.bgElevated,
          underline: Container(
            height: 0.5,
            color: AeroColors.border,
          ),
        ),
      ],
    );
  }
}
