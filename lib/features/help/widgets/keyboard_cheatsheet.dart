/// ══════════════════════════════════════════════════
/// KeyboardCheatsheet — 快捷键速查表
/// ══════════════════════════════════════════════════
/// 列出应用所有快捷键。可通过 `?` 键或命令面板打开。
/// ──────────────────────────────────────────────────
library;

import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/dialog_header.dart';
import '../../../core/widgets/modal_overlay.dart';

/// 单条快捷键记录
class ShortcutItem {
  final String keys;
  final String description;
  final String? category;

  const ShortcutItem({
    required this.keys,
    required this.description,
    this.category,
  });
}

/// 全部快捷键数据
const List<ShortcutItem> kAllShortcuts = [
  ShortcutItem(keys: 'Cmd/Ctrl + K', description: '打开命令面板', category: '全局'),
  ShortcutItem(keys: 'Cmd/Ctrl + T', description: '模板画廊', category: '全局'),
  ShortcutItem(keys: 'Cmd/Ctrl + D', description: '今天的日记', category: '全局'),
  ShortcutItem(keys: 'Cmd/Ctrl + B', description: '切换侧边栏', category: '全局'),
  ShortcutItem(keys: 'Cmd/Ctrl + Shift + P', description: '插件管理', category: '全局'),
  ShortcutItem(keys: 'Escape', description: '关闭覆盖层', category: '全局'),
  ShortcutItem(
      keys: 'Cmd/Ctrl + ,', description: '打开设置', category: '全局'),

  ShortcutItem(keys: 'Cmd/Ctrl + Z', description: '撤销', category: '编辑'),
  ShortcutItem(keys: 'Cmd/Ctrl + Y', description: '重做', category: '编辑'),
  ShortcutItem(keys: 'Cmd/Ctrl + F', description: '搜索替换', category: '编辑'),
  ShortcutItem(keys: 'Cmd/Ctrl + B', description: '粗体', category: '编辑'),
  ShortcutItem(keys: 'Cmd/Ctrl + I', description: '斜体', category: '编辑'),
  ShortcutItem(keys: 'Cmd/Ctrl + Shift + K', description: '插入链接', category: '编辑'),
  ShortcutItem(
      keys: 'Shift + Enter', description: '查找上一个', category: '编辑'),
  ShortcutItem(keys: 'Enter', description: '查找下一个', category: '编辑'),

  ShortcutItem(keys: '双击标题', description: '编辑笔记标题', category: '面板'),
];

/// 快捷键速查表覆盖层
class KeyboardCheatsheetOverlay extends StatelessWidget {
  final bool isOpen;
  final VoidCallback onClose;

  const KeyboardCheatsheetOverlay({
    super.key,
    required this.isOpen,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return ModalOverlay(
      isOpen: isOpen,
      onClose: onClose,
      child: _buildContent(),
    );
  }

  Widget _buildContent() {
    final groups = <String, List<ShortcutItem>>{};
    for (final item in kAllShortcuts) {
      final cat = item.category ?? '其他';
      groups.putIfAbsent(cat, () => []);
      groups[cat]!.add(item);
    }
    final categories = groups.keys.toList();

    return DialogContainer(
      width: 600,
      height: 500,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DialogHeader(
            icon: Icons.keyboard_outlined,
            iconColor: AeroColors.accentBlue,
            title: '快捷键速查表',
            badgeText: '${kAllShortcuts.length} 个快捷键',
            onClose: onClose,
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: categories.length,
              itemBuilder: (context, index) {
                final cat = categories[index];
                final items = groups[cat]!;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (index > 0) const SizedBox(height: 16),
                    Text(
                      cat,
                      style: const TextStyle(
                        color: AeroColors.accentBlue,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    ...items.map((item) => _ShortcutRow(item: item)),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ShortcutRow extends StatelessWidget {
  final ShortcutItem item;

  const _ShortcutRow({required this.item});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AeroColors.bgDeep,
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: AeroColors.border, width: 0.5),
            ),
            child: Text(
              item.keys,
              style: const TextStyle(
                color: AeroColors.accentCyan,
                fontSize: 11,
                fontFamily: 'monospace',
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              item.description,
              style: const TextStyle(
                color: AeroColors.textPrimary,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
