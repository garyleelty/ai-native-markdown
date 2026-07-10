/// ══════════════════════════════════════════════════
/// WelcomePage — 欢迎页面
/// ══════════════════════════════════════════════════
/// 新用户引导，介绍核心特性、快捷键、首次启动提示。
/// ──────────────────────────────────────────────────

import 'package:flutter/material.dart';
import '../../../core/theme/aeromind_theme.dart';

class WelcomePage extends StatelessWidget {
  final VoidCallback onClose;
  final VoidCallback? onShowShortcuts;
  final VoidCallback? onCreateNote;

  const WelcomePage({
    super.key,
    required this.onClose,
    this.onShowShortcuts,
    this.onCreateNote,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Material(
        color: Colors.black54,
        child: Center(
          child: Container(
            width: 560,
            constraints: const BoxConstraints(maxHeight: 640),
            decoration: BoxDecoration(
              color: AeroColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AeroColors.border, width: 0.5),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Hero 区 ──
                Container(
                  padding: const EdgeInsets.fromLTRB(28, 32, 28, 24),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AeroColors.accentBlue, AeroColors.accentPurple],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(12),
                      topRight: Radius.circular(12),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Center(
                              child: Text(
                                'A',
                                style: TextStyle(
                                  color: AeroColors.textOnAccent,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 26,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Text(
                            '欢迎使用 AeroMind',
                            style: TextStyle(
                              color: AeroColors.textOnAccent,
                              fontSize: 22,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'AI Native 笔记应用 — Sliding Panes · 实体识别 · 语义上下文 · 插件系统',
                        style: TextStyle(
                          color: AeroColors.textOnAccent,
                          fontSize: 12,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                // ── 特性列表 ──
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(24),
                    children: const [
                      _FeatureItem(
                        icon: Icons.view_carousel_outlined,
                        title: 'Sliding Panes 横向滑动面板',
                        description: '同时打开多篇笔记，横向滑动切换。双击标题可重命名。',
                      ),
                      _FeatureItem(
                        icon: Icons.auto_awesome,
                        title: 'AI 实体识别',
                        description: '自动识别 wiki 链接、人物提及、标签、任务、引文与时间戳。',
                      ),
                      _FeatureItem(
                        icon: Icons.account_tree_outlined,
                        title: '知识图谱',
                        description: '可视化笔记间的双向链接关系，力导向布局。',
                      ),
                      _FeatureItem(
                        icon: Icons.code,
                        title: 'Markdown 编辑与语法高亮',
                        description: '源码 / 实时预览 / 阅读三种模式，代码块带语法高亮。',
                      ),
                      _FeatureItem(
                        icon: Icons.history,
                        title: '版本历史与回收站',
                        description: '自动快照、一键回滚；删除笔记进入回收站，30 天可恢复。',
                      ),
                      _FeatureItem(
                        icon: Icons.extension,
                        title: '插件系统',
                        description: '内置字数统计、Markdown 增强、导出与 Mermaid 插件。',
                      ),
                    ],
                  ),
                ),
                // ── 操作按钮 ──
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: const BoxDecoration(
                    border: Border(
                      top: BorderSide(color: AeroColors.divider, width: 0.5),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: onShowShortcuts,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.keyboard_outlined,
                                size: 14, color: AeroColors.accentCyan),
                            SizedBox(width: 6),
                            Text('查看快捷键',
                                style: TextStyle(
                                    color: AeroColors.accentCyan, fontSize: 12)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      FilledButton.icon(
                        onPressed: () {
                          onClose();
                          onCreateNote?.call();
                        },
                        icon: const Icon(Icons.add, size: 14),
                        label: const Text('开始写作',
                            style: TextStyle(fontSize: 12)),
                        style: FilledButton.styleFrom(
                          backgroundColor: AeroColors.accentBlue,
                          foregroundColor: AeroColors.textOnAccent,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FeatureItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const _FeatureItem({
    required this.icon,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AeroColors.accentBlue.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: AeroColors.accentBlue),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AeroColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: const TextStyle(
                    color: AeroColors.textSecondary,
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
