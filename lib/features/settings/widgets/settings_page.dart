/// ══════════════════════════════════════════════════
/// SettingsPage — 应用设置页面
/// ══════════════════════════════════════════════════
/// 包含: 通用设置、AI 配置、插件管理入口、主题设置。
/// ──────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/plugin/plugin_registry.dart';
import '../../../features/ai_engine/services/entity_recognizer.dart';
import '../../../providers/plugin_provider.dart';
import '../../../providers/settings_provider.dart';
import '../../plugins/widgets/plugin_manager_panel.dart';

/// 设置页面 (全屏覆盖层)
class SettingsPage extends ConsumerStatefulWidget {
  final VoidCallback? onClose;

  const SettingsPage({super.key, this.onClose});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  int _selectedSection = 0;

  static const _sections = [
    _SectionDef(icon: Icons.tune, label: '通用'),
    _SectionDef(icon: Icons.auto_awesome, label: 'AI'),
    _SectionDef(icon: Icons.extension, label: '插件'),
    _SectionDef(icon: Icons.storage, label: '存储'),
    _SectionDef(icon: Icons.info_outline, label: '关于'),
  ];

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AeroColors.bgDeep,
      child: Column(
        children: [
          // ── 标题栏 ──
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: const BoxDecoration(
              color: AeroColors.bgElevated,
              border: Border(
                bottom: BorderSide(color: AeroColors.divider, width: 0.5),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.settings_outlined,
                    size: 18, color: AeroColors.accentBlue),
                const SizedBox(width: 8),
                const Text(
                  '设置',
                  style: TextStyle(
                    color: AeroColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close,
                      size: 18, color: AeroColors.textSecondary),
                  onPressed: widget.onClose,
                  splashRadius: 16,
                ),
              ],
            ),
          ),

          // ── 内容区 ──
          Expanded(
            child: Row(
              children: [
                // 左侧导航
                Container(
                  width: 160,
                  decoration: const BoxDecoration(
                    color: AeroColors.bgSurface,
                    border: Border(
                      right: BorderSide(color: AeroColors.divider, width: 0.5),
                    ),
                  ),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: _sections.length,
                    itemBuilder: (context, index) {
                      final section = _sections[index];
                      final isSelected = index == _selectedSection;
                      return InkWell(
                        onTap: () => setState(() => _selectedSection = index),
                        child: Container(
                          height: 36,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          color: isSelected
                              ? AeroColors.accentBlue.withOpacity(0.08)
                              : Colors.transparent,
                          child: Row(
                            children: [
                              Icon(section.icon,
                                  size: 16,
                                  color: isSelected
                                      ? AeroColors.accentBlue
                                      : AeroColors.textSecondary),
                              const SizedBox(width: 10),
                              Text(
                                section.label,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: isSelected
                                      ? AeroColors.accentBlue
                                      : AeroColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // 右侧内容
                Expanded(
                  child: _buildSectionContent(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionContent() {
    switch (_selectedSection) {
      case 0:
        return _GeneralSection();
      case 1:
        return _AISection();
      case 2:
        return _PluginSection();
      case 3:
        return _StorageSection();
      case 4:
        return _AboutSection();
      default:
        return const SizedBox.shrink();
    }
  }
}

class _SectionDef {
  final IconData icon;
  final String label;
  const _SectionDef({required this.icon, required this.label});
}

/// 通用设置
class _GeneralSection extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _SettingsGroup(
          title: '编辑器',
          children: [
            _SettingsTile(
              title: '自动保存',
              subtitle: '停止输入 2 秒后自动保存',
              trailing: Switch(
                value: settings.autoSaveEnabled,
                onChanged: notifier.setAutoSaveEnabled,
                activeColor: AeroColors.accentBlue,
              ),
            ),
            _SettingsTile(
              title: '默认打开模式',
              subtitle: settings.defaultEditMode ? '编辑模式' : '阅读模式',
              trailing: Switch(
                value: settings.defaultEditMode,
                onChanged: notifier.setDefaultEditMode,
                activeColor: AeroColors.accentBlue,
              ),
            ),
            _SettingsTile(
              title: '字体大小',
              subtitle:
                  '${settings.fontSize.toStringAsFixed(0)}px · 应用于编辑器与渲染',
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.remove, size: 16),
                    onPressed: () {
                      final newSize = (settings.fontSize - 1).clamp(10.0, 24.0);
                      notifier.setFontSize(newSize);
                    },
                    splashRadius: 16,
                  ),
                  IconButton(
                    icon: const Icon(Icons.add, size: 16),
                    onPressed: () {
                      final newSize = (settings.fontSize + 1).clamp(10.0, 24.0);
                      notifier.setFontSize(newSize);
                    },
                    splashRadius: 16,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _SettingsGroup(
          title: '外观',
          children: [
            _SettingsTile(
              title: '主题',
              subtitle: settings.themeMode == AppThemeMode.dark
                  ? '暗色 (默认)'
                  : '浅色',
              trailing: SegmentedButton<AppThemeMode>(
                segments: const [
                  ButtonSegment(
                    value: AppThemeMode.dark,
                    icon: Icon(Icons.dark_mode_outlined, size: 14),
                    label: Text('暗色', style: TextStyle(fontSize: 11)),
                  ),
                  ButtonSegment(
                    value: AppThemeMode.light,
                    icon: Icon(Icons.light_mode_outlined, size: 14),
                    label: Text('浅色', style: TextStyle(fontSize: 11)),
                  ),
                ],
                selected: {settings.themeMode},
                onSelectionChanged: (selection) =>
                    notifier.setThemeMode(selection.first),
                style: const ButtonStyle(
                  visualDensity: VisualDensity(horizontal: -3, vertical: -2),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// AI 设置
class _AISection extends ConsumerStatefulWidget {
  @override
  ConsumerState<_AISection> createState() => _AISectionState();
}

class _AISectionState extends ConsumerState<_AISection> {
  late final TextEditingController _endpointCtrl;
  late final TextEditingController _apiKeyCtrl;
  late final TextEditingController _modelCtrl;
  bool _obscureKey = true;

  @override
  void initState() {
    super.initState();
    final s = ref.read(settingsProvider);
    _endpointCtrl = TextEditingController(text: s.llmApiEndpoint);
    _apiKeyCtrl = TextEditingController(text: s.llmApiKey);
    _modelCtrl = TextEditingController(text: s.llmModel);
  }

  @override
  void dispose() {
    _endpointCtrl.dispose();
    _apiKeyCtrl.dispose();
    _modelCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _SettingsGroup(
          title: '实体识别',
          children: [
            _SettingsTile(
              title: '识别策略',
              subtitle: _strategyLabel(settings.entityRecognitionStrategy),
              trailing: DropdownButton<RecognitionStrategy>(
                value: settings.entityRecognitionStrategy,
                onChanged: (value) {
                  if (value != null) {
                    notifier.setEntityRecognitionStrategy(value);
                  }
                },
                dropdownColor: AeroColors.bgElevated,
                style: const TextStyle(
                  color: AeroColors.textPrimary,
                  fontSize: 12,
                ),
                underline: const SizedBox.shrink(),
                items: RecognitionStrategy.values.map((s) {
                  return DropdownMenuItem(
                    value: s,
                    child: Text(_strategyLabel(s)),
                  );
                }).toList(),
              ),
            ),
            _SettingsTile(
              title: '识别延迟',
              subtitle: '${settings.entityRecognitionDelay.inMilliseconds}ms',
            ),
          ],
        ),
        const SizedBox(height: 16),
        _SettingsGroup(
          title: '远程 LLM (OpenAI 兼容)',
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('API 端点',
                      style: TextStyle(
                          color: AeroColors.textPrimary, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _endpointCtrl,
                    style: const TextStyle(fontSize: 12),
                    decoration: InputDecoration(
                      hintText: 'https://api.openai.com/v1',
                      hintStyle: const TextStyle(
                          color: AeroColors.textMuted, fontSize: 11),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 8),
                      enabledBorder: OutlineInputBorder(
                        borderSide:
                            const BorderSide(color: AeroColors.divider),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: AeroColors.accentBlue),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    onSubmitted: notifier.setLlmApiEndpoint,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('API Key',
                      style: TextStyle(
                          color: AeroColors.textPrimary, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _apiKeyCtrl,
                    style: const TextStyle(fontSize: 12),
                    obscureText: _obscureKey,
                    decoration: InputDecoration(
                      hintText: 'sk-...',
                      hintStyle: const TextStyle(
                          color: AeroColors.textMuted, fontSize: 11),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 8),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureKey
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          size: 14,
                          color: AeroColors.textMuted,
                        ),
                        splashRadius: 12,
                        onPressed: () => setState(
                            () => _obscureKey = !_obscureKey),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderSide:
                            const BorderSide(color: AeroColors.divider),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: AeroColors.accentBlue),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    onSubmitted: notifier.setLlmApiKey,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('模型',
                      style: TextStyle(
                          color: AeroColors.textPrimary, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _modelCtrl,
                    style: const TextStyle(fontSize: 12),
                    decoration: InputDecoration(
                      hintText: 'gpt-3.5-turbo',
                      hintStyle: const TextStyle(
                          color: AeroColors.textMuted, fontSize: 11),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 8),
                      enabledBorder: OutlineInputBorder(
                        borderSide:
                            const BorderSide(color: AeroColors.divider),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: AeroColors.accentBlue),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    onSubmitted: notifier.setLlmModel,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.info_outline,
                      size: 12, color: AeroColors.textMuted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      settings.llmApiEndpoint.isEmpty
                          ? '当前未配置端点，远程识别将不可用'
                          : '当前端点：${settings.llmApiEndpoint}',
                      style: TextStyle(
                          color: settings.llmApiEndpoint.isEmpty
                              ? AeroColors.accentOrange
                              : AeroColors.textMuted,
                          fontSize: 11),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      notifier
                        ..setLlmApiEndpoint(_endpointCtrl.text.trim())
                        ..setLlmApiKey(_apiKeyCtrl.text.trim())
                        ..setLlmModel(_modelCtrl.text.trim());
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('已保存 LLM 配置'),
                          duration: Duration(seconds: 1),
                        ),
                      );
                    },
                    child: const Text('保存',
                        style: TextStyle(color: AeroColors.accentGreen)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _strategyLabel(RecognitionStrategy strategy) {
    switch (strategy) {
      case RecognitionStrategy.local:
        return '本地规则 (零延迟)';
      case RecognitionStrategy.remote:
        return '远程 LLM (高延迟)';
      case RecognitionStrategy.hybrid:
        return '混合模式 (推荐)';
    }
  }
}

/// 插件设置
class _PluginSection extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final registry = PluginRegistry.instance;
    final manifests = registry.allManifests;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _SettingsGroup(
          title: '已安装插件 (${manifests.length})',
          children: manifests.map((manifest) {
            final isActive = registry.isActive(manifest.id);
            return _SettingsTile(
              title: manifest.name,
              subtitle: 'v${manifest.version} · ${manifest.description}',
              trailing: Switch(
                value: isActive,
                onChanged: (_) async {
                  if (isActive) {
                    await registry.pausePlugin(manifest.id);
                  } else {
                    await registry.activatePlugin(manifest.id);
                  }
                  // ignore: use_build_context_synchronously
                  (context as Element).markNeedsBuild();
                },
                activeColor: AeroColors.accentCyan,
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

/// 存储设置
class _StorageSection extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _SettingsGroup(
          title: '本地存储',
          children: [
            const _SettingsTile(
              title: '笔记存储路径',
              subtitle: '~/Aeromind',
            ),
            const _SettingsTile(
              title: 'Hive 数据库',
              subtitle: '笔记元数据 · 版本历史 · 回收站',
            ),
            _SettingsTile(
              title: '清除所有数据',
              subtitle: '将删除所有笔记、版本历史、回收站与设置',
              trailing: TextButton(
                onPressed: () => _confirmClearAll(context, ref),
                child: const Text('清除',
                    style: TextStyle(color: AeroColors.accentRed)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _confirmClearAll(BuildContext context, WidgetRef ref) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text('清除所有数据', style: TextStyle(fontSize: 14)),
        content: const Text(
          '此操作将永久删除：\n'
          '• 所有笔记\n'
          '• 所有版本历史\n'
          '• 回收站中的内容\n'
          '• 应用设置\n\n'
          '此操作不可撤销，确定继续吗？',
          style: TextStyle(color: AeroColors.textSecondary, fontSize: 12),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(settingsProvider.notifier).clearAllData();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('已清除所有数据'),
                    duration: Duration(seconds: 2),
                  ),
                );
              }
            },
            child: const Text('确定清除',
                style: TextStyle(color: AeroColors.accentRed)),
          ),
        ],
      ),
    );
  }
}

/// 关于页面
class _AboutSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AeroColors.accentBlue, AeroColors.accentPurple],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Text(
                'A',
                style: TextStyle(
                  color: AeroColors.textOnAccent,
                  fontWeight: FontWeight.w700,
                  fontSize: 28,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'AeroMind',
            style: TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'v0.1.0',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 8),
          const Text(
            'AI Native 笔记应用',
            style: TextStyle(color: AeroColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 24),
          Text(
            'Sliding Panes · 实体识别 · 语义上下文 · 插件系统',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

/// 设置分组
class _SettingsGroup extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SettingsGroup({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: AeroColors.accentBlue,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AeroColors.bgSurface,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: AeroColors.border, width: 0.5),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
}

/// 单条设置项
class _SettingsTile extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;

  const _SettingsTile({
    required this.title,
    this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: AeroColors.divider, width: 0.3),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AeroColors.textPrimary,
                    fontSize: 13,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      color: AeroColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
