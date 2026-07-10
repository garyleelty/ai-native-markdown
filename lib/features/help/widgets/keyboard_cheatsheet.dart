/// ══════════════════════════════════════════════════
/// KeyboardCheatsheet — 快捷键速查表
/// ══════════════════════════════════════════════════
/// 列出应用所有快捷键。可通过 `?` 键或命令面板打开。
/// ──────────────────────────────────────────────────
library;

import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';

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
  final VoidCallback onClose;

  const KeyboardCheatsheetOverlay({super.key, required this.onClose});

  @override
  Widget build(BuildContext context) {
    // 按 category 分组
    final groups = <String, List<ShortcutItem>>{};
    for (final item in kAllShortcuts) {
      final cat = item.category ?? '其他';
      groups.putIfAbsent(cat, () => []);
      groups[cat]!.add(item);
    }
    final categories = groups.keys.toList();

    return Positioned.fill(
      child: Material(
        color: Colors.black54,
        child: GestureDetector(
          onTap: onClose,
          behavior: HitTestBehavior.opaque,
          child: Center(
            child: GestureDetector(
              onTap: () {},
              child: Container(
            width: 600,
            constraints: const BoxConstraints(maxHeight: 600),
            decoration: BoxDecoration(
              color: AeroColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AeroColors.border, width: 0.5),
              boxShadow: const [
                BoxShadow(color: AeroColors.shadow, blurRadius: 24),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── 标题栏 ──
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: const BoxDecoration(
                    color: AeroColors.bgElevated,
                    border: Border(
                      bottom: BorderSide(color: AeroColors.divider, width: 0.5),
                    ),
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(12),
                      topRight: Radius.circular(12),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.keyboard_outlined,
                          size: 18, color: AeroColors.accentBlue),
                      const SizedBox(width: 8),
                      const Text(
                        '快捷键速查表',
                        style: TextStyle(
                          color: AeroColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.close,
                            size: 16, color: AeroColors.textSecondary),
                        onPressed: onClose,
                        splashRadius: 14,
                      ),
                    ],
                  ),
                ),
                // ── 内容 ──
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
              ),
            ),
          ),
        ),
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
          // 快捷键
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AeroColors.bgElevated,
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
          // 描述
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
