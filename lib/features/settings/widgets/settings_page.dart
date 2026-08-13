/// ══════════════════════════════════════════════════
/// SettingsPage — 应用设置页面
/// ══════════════════════════════════════════════════
/// 包含: 通用设置、AI 配置、插件管理入口、主题设置。
/// ──────────────────────────────────────────────────

library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/dialog_header.dart';
import '../../../core/widgets/modal_overlay.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../core/plugin/plugin_registry.dart';
import '../../../features/ai_engine/services/entity_recognizer.dart';
import '../../../providers/settings_provider.dart';
import '../../../providers/git_backup_provider.dart';

/// 设置页面
class SettingsPage extends ConsumerStatefulWidget {
  final bool isOpen;
  final VoidCallback? onClose;

  const SettingsPage({
    super.key,
    required this.isOpen,
    this.onClose,
  });

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  int get _selectedSection => ref.watch(settingsPageSectionProvider);
  set _selectedSection(int value) =>
      ref.read(settingsPageSectionProvider.notifier).set(value);

  static const _sections = [
    _SectionDef(icon: Icons.tune, label: '通用'),
    _SectionDef(icon: Icons.auto_awesome, label: 'AI'),
    _SectionDef(icon: Icons.extension, label: '插件'),
    _SectionDef(icon: Icons.storage, label: '存储'),
    _SectionDef(icon: Icons.info_outline, label: '关于'),
  ];

  @override
  Widget build(BuildContext context) {
    return ModalOverlay(
      isOpen: widget.isOpen,
      onClose: widget.onClose ?? () {},
      child: DialogContainer(
        width: 800,
        height: 600,
        child: Column(
          children: [
            DialogHeader(
              icon: Icons.settings_outlined,
              iconColor: AeroColors.accentBlue,
              title: '设置',
              onClose: widget.onClose,
            ),
            Expanded(
              child: Row(
                children: [
                  Container(
                    width: 160,
                    decoration: const BoxDecoration(
                      color: AeroColors.bgSurface,
                      border: Border(
                        right: BorderSide(color: AeroColors.divider, width: AeroBorderWidth.thin),
                      ),
                    ),
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: AeroSpacing.sm),
                      itemCount: _sections.length,
                      itemBuilder: (context, index) {
                        final section = _sections[index];
                        final isSelected = index == _selectedSection;
                        return InkWell(
                          onTap: () => _selectedSection = index,
                          child: Container(
                            height: 36,
                            padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.lg),
                            color: isSelected
                                ? AeroColors.accentBlue.withValues(alpha: 0.08)
                                : Colors.transparent,
                            child: Row(
                              children: [
                                Icon(section.icon,
                                    size: AeroIconSize.md,
                                    color: isSelected
                                        ? AeroColors.accentBlue
                                        : AeroColors.textSecondary),
                                const SizedBox(width: AeroSpacing.md),
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
                  Expanded(
                    child: _buildSectionContent(),
                  ),
                ],
              ),
            ),
          ],
        ),
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
      padding: const EdgeInsets.all(AeroSpacing.xl),
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
                activeThumbColor: AeroColors.accentBlue,
              ),
            ),
            _SettingsTile(
              title: '默认打开模式',
              subtitle: settings.defaultEditMode ? '编辑模式' : '阅读模式',
              trailing: Switch(
                value: settings.defaultEditMode,
                onChanged: notifier.setDefaultEditMode,
                activeThumbColor: AeroColors.accentBlue,
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
                    icon: const Icon(Icons.remove, size: AeroIconSize.md),
                    onPressed: () {
                      final newSize = (settings.fontSize - 1).clamp(10.0, 24.0);
                      notifier.setFontSize(newSize);
                    },
                    splashRadius: 16,
                  ),
                  IconButton(
                    icon: const Icon(Icons.add, size: AeroIconSize.md),
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
        const SizedBox(height: AeroSpacing.lg),
        _SettingsGroup(
          title: '图表渲染',
          children: [
            _SettingsTile(
              title: 'Mermaid 在线渲染',
              subtitle: '使用 mermaid.ink 在线服务渲染 Mermaid 图表（需网络）',
              trailing: Switch(
                value: settings.mermaidEnabled,
                onChanged: notifier.setMermaidEnabled,
                activeThumbColor: AeroColors.accentPurple,
              ),
            ),
          ],
        ),
        const SizedBox(height: AeroSpacing.lg),
        const _SettingsGroup(
          title: '外观',
          children: [
            _SettingsTile(
              title: '主题',
              subtitle: '暗色 (推荐) · 浅色主题即将推出',
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
    // 当 provider 外部变化时，反向同步到控制器（避免控制器与 provider 不一致）
    // 注意：initState 中不可用 ref.listen（仅限 build），须用 listenManual
    ref.listenManual(settingsProvider, (previous, next) {
      if (!mounted) return;
      if (_endpointCtrl.text != next.llmApiEndpoint) {
        _endpointCtrl.text = next.llmApiEndpoint;
      }
      if (_apiKeyCtrl.text != next.llmApiKey) {
        _apiKeyCtrl.text = next.llmApiKey;
      }
      if (_modelCtrl.text != next.llmModel) {
        _modelCtrl.text = next.llmModel;
      }
    });
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
      padding: const EdgeInsets.all(AeroSpacing.xl),
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
        const SizedBox(height: AeroSpacing.lg),
        _SettingsGroup(
          title: '远程 LLM (OpenAI 兼容)',
          children: [
            _buildTextField(
              controller: _endpointCtrl,
              label: 'API 端点',
              hint: 'https://api.openai.com/v1',
              onSubmitted: notifier.setLlmApiEndpoint,
            ),
            _buildTextField(
              controller: _apiKeyCtrl,
              label: 'API Key',
              hint: 'sk-...',
              obscureText: _obscureKey,
              onSubmitted: notifier.setLlmApiKey,
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureKey
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  size: AeroIconSize.sm,
                  color: AeroColors.textMuted,
                ),
                splashRadius: 12,
                onPressed: () =>
                    setState(() => _obscureKey = !_obscureKey),
              ),
            ),
            _buildTextField(
              controller: _modelCtrl,
              label: '模型',
              hint: 'gpt-3.5-turbo',
              onSubmitted: notifier.setLlmModel,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: AeroSpacing.sm),
              child: Row(
                children: [
                  const Icon(Icons.info_outline,
                      size: AeroIconSize.sm, color: AeroColors.textMuted),
                  const SizedBox(width: AeroSpacing.sm),
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

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    ValueChanged<String>? onSubmitted,
    Widget? suffixIcon,
    bool obscureText = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: AeroSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: AeroSpacing.xs),
          TextField(
            controller: controller,
            onSubmitted: onSubmitted,
            obscureText: obscureText,
            style: const TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 12,
            ),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(
                color: AeroColors.textMuted,
                fontSize: 12,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: AeroSpacing.sm, vertical: AeroSpacing.sm),
              isDense: true,
              filled: true,
              fillColor: AeroColors.bgSurface,
              suffixIcon: suffixIcon,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AeroRadius.sm),
                borderSide: const BorderSide(color: AeroColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AeroRadius.sm),
                borderSide: const BorderSide(color: AeroColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AeroRadius.sm),
                borderSide: const BorderSide(color: AeroColors.accentBlue),
              ),
            ),
          ),
        ],
      ),
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
      padding: const EdgeInsets.all(AeroSpacing.xl),
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
                activeThumbColor: AeroColors.accentCyan,
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

/// 存储设置
class _StorageSection extends ConsumerStatefulWidget {
  @override
  ConsumerState<_StorageSection> createState() => _StorageSectionState();
}

class _StorageSectionState extends ConsumerState<_StorageSection> {
  late final TextEditingController _remoteUrlController;
  late final TextEditingController _userNameController;
  late final TextEditingController _userEmailController;
  late final TextEditingController _branchController;

  @override
  void initState() {
    super.initState();
    final s = ref.read(gitBackupProvider);
    _remoteUrlController = TextEditingController(text: s.remoteUrl);
    _userNameController = TextEditingController(text: s.userName);
    _userEmailController = TextEditingController(text: s.userEmail);
    _branchController = TextEditingController(text: s.branch);
    // 当 provider 外部变化时（如异步加载完成、远程恢复），反向同步到控制器
    ref.listenManual(gitBackupProvider, (previous, next) {
      if (!mounted) return;
      if (_remoteUrlController.text != next.remoteUrl) {
        _remoteUrlController.text = next.remoteUrl;
      }
      if (_userNameController.text != next.userName) {
        _userNameController.text = next.userName;
      }
      if (_userEmailController.text != next.userEmail) {
        _userEmailController.text = next.userEmail;
      }
      if (_branchController.text != next.branch) {
        _branchController.text = next.branch;
      }
    });
  }

  @override
  void dispose() {
    _remoteUrlController.dispose();
    _userNameController.dispose();
    _userEmailController.dispose();
    _branchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gitState = ref.watch(gitBackupProvider);
    return ListView(
      padding: const EdgeInsets.all(AeroSpacing.xl),
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
        const SizedBox(height: AeroSpacing.lg),
        _SettingsGroup(
          title: 'Git 远程备份',
          children: [
            _SettingsTile(
              title: '启用 Git 备份',
              subtitle: gitState.enabled ? '已启用' : '未启用',
              trailing: Switch(
                value: gitState.enabled,
                onChanged: (v) {
                  ref.read(gitBackupProvider.notifier).updateConfig(enabled: v);
                },
                activeThumbColor: AeroColors.accentBlue,
              ),
            ),
            _buildTextField(
              controller: _remoteUrlController,
              label: '远程仓库 URL',
              hint: 'https://github.com/user/notes.git 或 git@github.com:user/notes.git',
              onChanged: (v) => ref
                  .read(gitBackupProvider.notifier)
                  .updateConfig(remoteUrl: v),
              enabled: gitState.enabled,
            ),
            _buildTextField(
              controller: _userNameController,
              label: '用户名',
              hint: 'your-name',
              onChanged: (v) => ref
                  .read(gitBackupProvider.notifier)
                  .updateConfig(userName: v),
              enabled: gitState.enabled,
            ),
            _buildTextField(
              controller: _userEmailController,
              label: '邮箱',
              hint: 'you@example.com',
              onChanged: (v) => ref
                  .read(gitBackupProvider.notifier)
                  .updateConfig(userEmail: v),
              enabled: gitState.enabled,
            ),
            _buildTextField(
              controller: _branchController,
              label: '分支',
              hint: 'main',
              onChanged: (v) => ref
                  .read(gitBackupProvider.notifier)
                  .updateConfig(branch: v.isEmpty ? 'main' : v),
              enabled: gitState.enabled,
            ),
            _SettingsTile(
              title: '自动备份',
              subtitle: '编辑后自动提交并推送',
              trailing: Switch(
                value: gitState.autoBackup,
                onChanged: gitState.enabled
                    ? (v) => ref
                        .read(gitBackupProvider.notifier)
                        .updateConfig(autoBackup: v)
                    : null,
                activeThumbColor: AeroColors.accentBlue,
              ),
            ),
            const SizedBox(height: AeroSpacing.sm),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: AeroSpacing.sm),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: gitState.enabled &&
                              gitState.status != SyncStatus.syncing
                          ? () async {
                              final ok = await ref
                                  .read(gitBackupProvider.notifier)
                                  .backup();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(ok ? '备份成功' : '备份失败'),
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                              }
                            }
                          : null,
                      icon: gitState.status == SyncStatus.syncing
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AeroColors.textMuted),
                            )
                          : const Icon(Icons.cloud_upload, size: AeroIconSize.md),
                      label: const Text('立即备份'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AeroColors.textPrimary,
                        side:
                            const BorderSide(color: AeroColors.border),
                      ),
                    ),
                  ),
                  const SizedBox(width: AeroSpacing.md),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: gitState.enabled &&
                              gitState.status != SyncStatus.syncing &&
                              gitState.remoteUrl.isNotEmpty
                          ? () async {
                              final ok = await ref
                                  .read(gitBackupProvider.notifier)
                                  .restore();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(ok ? '恢复成功' : '恢复失败'),
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                              }
                            }
                          : null,
                      icon: const Icon(Icons.cloud_download, size: AeroIconSize.md),
                      label: const Text('从远程恢复'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AeroColors.textPrimary,
                        side:
                            const BorderSide(color: AeroColors.border),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (gitState.lastError != null)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: AeroSpacing.sm),
                child: Text(
                  '错误: ${gitState.lastError}',
                  style: const TextStyle(
                    color: AeroColors.accentRed,
                    fontSize: 11,
                  ),
                ),
              ),
            if (gitState.lastBackupTime != null)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: AeroSpacing.xs),
                child: Text(
                  '上次备份: ${_formatTime(gitState.lastBackupTime!)}',
                  style: const TextStyle(
                    color: AeroColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required ValueChanged<String> onChanged,
    bool enabled = true,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: AeroSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: enabled
                  ? AeroColors.textPrimary
                  : AeroColors.textMuted,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: AeroSpacing.xs),
          TextField(
            controller: controller,
            onChanged: onChanged,
            enabled: enabled,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(
                color: AeroColors.textMuted,
                fontSize: 12,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: AeroSpacing.sm, vertical: AeroSpacing.sm),
              isDense: true,
              filled: true,
              fillColor: AeroColors.bgSurface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AeroRadius.sm),
                borderSide:
                    const BorderSide(color: AeroColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AeroRadius.sm),
                borderSide:
                    const BorderSide(color: AeroColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AeroRadius.sm),
                borderSide:
                    const BorderSide(color: AeroColors.accentBlue),
              ),
            ),
            style: TextStyle(
              color: enabled
                  ? AeroColors.textPrimary
                  : AeroColors.textMuted,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes} 分钟前';
    if (diff.inHours < 24) return '${diff.inHours} 小时前';
    if (diff.inDays < 7) return '${diff.inDays} 天前';
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
  }

  void _confirmClearAll(BuildContext context, WidgetRef ref) async {
    final result = await showConfirmDialog(
      context,
      type: ConfirmDialogType.danger,
      isDestructive: true,
      title: '清除所有数据',
      content: '此操作将永久删除：\n'
          '• 所有笔记\n'
          '• 所有版本历史\n'
          '• 回收站中的内容\n'
          '• 应用设置\n\n'
          '此操作不可撤销，确定继续吗？',
      confirmText: '确定清除',
    );
    if (result == true) {
      await ref.read(settingsProvider.notifier).clearAllData();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('已清除所有数据'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
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
              borderRadius: BorderRadius.circular(AeroRadius.xl),
            ),
            child: const Center(
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
          const SizedBox(height: AeroSpacing.lg),
          const Text(
            'AeroMind',
            style: TextStyle(
              color: AeroColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AeroSpacing.xs),
          const Text(
            'v0.1.0',
            style: TextStyle(color: AeroColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: AeroSpacing.sm),
          const Text(
            'AI Native 笔记应用',
            style: TextStyle(color: AeroColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: AeroSpacing.xxl),
          const Text(
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
        const SizedBox(height: AeroSpacing.sm),
        Container(
          decoration: BoxDecoration(
            color: AeroColors.bgSurface,
            borderRadius: BorderRadius.circular(AeroRadius.sm),
            border: Border.all(color: AeroColors.border, width: AeroBorderWidth.thin),
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
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md, vertical: AeroSpacing.sm),
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
                  const SizedBox(height: AeroSpacing.xxs),
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
