import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/note_model.dart';
import '../../../core/services/file_service.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../core/widgets/dialog_header.dart';
import '../../../core/widgets/search_input.dart';
import '../../../core/widgets/modal_overlay.dart';
import '../../../providers/template_provider.dart';
import '../../../providers/pane_provider.dart';
import '../../../providers/note_provider.dart';
import '../../../providers/sidebar_provider.dart';
import '../services/template_service.dart';

// ──────────────────────────────────────────────
// 模板画廊弹窗 (Template Gallery)
// ──────────────────────────────────────────────
// 卡片网格展示模板预览，支持搜索和分类过滤
// 点击模板 → 创建新笔记并应用模板内容
// ──────────────────────────────────────────────

/// 模板画廊入口 Widget
///
/// 作为覆盖层弹窗展示，通过 Provider 控制显隐。
class TemplateGalleryOverlay extends ConsumerStatefulWidget {
  const TemplateGalleryOverlay({super.key});

  @override
  ConsumerState<TemplateGalleryOverlay> createState() =>
      _TemplateGalleryOverlayState();
}

class _TemplateGalleryOverlayState
    extends ConsumerState<TemplateGalleryOverlay> {
  late final TextEditingController _searchController;
  late final FocusNode _searchFocusNode;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _searchFocusNode = FocusNode();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _handleOpenChange(bool isOpen) {
    if (isOpen) {
      _searchController.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _searchFocusNode.requestFocus();
      });
    }
  }

  Future<void> _applyTemplate(TemplateDef template) async {
    final paneNotifier = ref.read(paneStackProvider.notifier);
    final templateNotifier = ref.read(templateGalleryProvider.notifier);
    final noteRepo = ref.read(noteRepositoryProvider);

    final content = templateNotifier.applyTemplate(template.id, {});
    final title = FileService.extractTitle(content, '');

    final now = DateTime.now();
    final note = NoteModel(
      id: noteRepo.generateId(),
      title: title,
      rawMarkdown: content,
      filePath: '',
      createdAt: now,
      updatedAt: now,
    );
    final saved = await noteRepo.saveNote(note);

    paneNotifier.openPane(saved.id, title);

    await ref.read(sidebarProvider.notifier).loadNoteTree();

    templateNotifier.close();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(templateGalleryProvider);

    ref.listen<bool>(
      templateGalleryProvider.select((s) => s.isOpen),
      (prev, next) => _handleOpenChange(next),
    );

    return ModalOverlay(
      isOpen: state.isOpen,
      onClose: () => ref.read(templateGalleryProvider.notifier).close(),
      child: _buildPanel(state),
    );
  }

  Widget _buildPanel(TemplateGalleryState state) {
    final screenWidth = MediaQuery.of(context).size.width;
    final screenHeight = MediaQuery.of(context).size.height;
    final panelWidth = screenWidth > 800 ? 720.0 : screenWidth - 48.0;
    final panelHeight = screenHeight > 600 ? 520.0 : screenHeight - 80.0;

    return DialogContainer(
      width: panelWidth,
      height: panelHeight,
      child: Column(
        children: [
          // ── 标题栏 ──
          DialogHeader(
            icon: Icons.dashboard_customize_outlined,
            iconColor: AeroColors.accentBlue,
            title: '模板画廊',
            badgeText: '${state.templates.length} 个模板',
            onClose: () => ref.read(templateGalleryProvider.notifier).close(),
          ),
          // ── 搜索栏 + 分类过滤 ──
          _buildSearchAndFilter(state),
          const Divider(height: 1, thickness: 0.5, color: AeroColors.divider),
          // ── 模板卡片网格 ──
          Expanded(
            child: _buildTemplateGrid(state),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchAndFilter(TemplateGalleryState state) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Column(
        children: [
          // 搜索框
          SearchInput(
            controller: _searchController,
            focusNode: _searchFocusNode,
            hintText: '搜索模板...',
            height: 36,
            onChanged: (q) {
              ref.read(templateGalleryProvider.notifier).updateSearch(q);
            },
          ),
          const SizedBox(height: 8),
          // 分类标签行
          _buildCategoryChips(state),
        ],
      ),
    );
  }

  Widget _buildCategoryChips(TemplateGalleryState state) {
    final categories = ['全部', ...state.categories];

    return SizedBox(
      height: 28,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, index) {
          final category = categories[index];
          final isSelected = (index == 0 && state.selectedCategory.isEmpty) ||
              category == state.selectedCategory;

          return GestureDetector(
            onTap: () {
              ref.read(templateGalleryProvider.notifier).setCategory(
                    index == 0 ? '' : category,
                  );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: isSelected
                    ? AeroColors.accentBlue.withValues(alpha: 0.15)
                    : AeroColors.bgSurface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isSelected
                      ? AeroColors.accentBlue.withValues(alpha: 0.4)
                      : AeroColors.border,
                  width: 0.5,
                ),
              ),
              child: Text(
                category,
                style: TextStyle(
                  fontSize: 11,
                  color: isSelected
                      ? AeroColors.accentBlue
                      : AeroColors.textSecondary,
                  fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildTemplateGrid(TemplateGalleryState state) {
    final templates = state.filteredTemplates;

    if (templates.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off, size: 32, color: AeroColors.textMuted),
            SizedBox(height: 8),
            Text(
              '没有找到匹配的模板',
              style: TextStyle(color: AeroColors.textMuted, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        // 响应式列数
        final crossAxisCount = constraints.maxWidth > 600 ? 3 : 2;

        return GridView.builder(
          padding: const EdgeInsets.all(12),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.3,
          ),
          itemCount: templates.length,
          itemBuilder: (context, index) {
            return _TemplateCard(
              template: templates[index],
              onTap: () => _applyTemplate(templates[index]),
            );
          },
        );
      },
    );
  }
}

/// 单个模板卡片
class _TemplateCard extends StatelessWidget {
  final TemplateDef template;
  final VoidCallback onTap;

  const _TemplateCard({
    required this.template,
    required this.onTap,
  });

  /// 根据分类返回对应的图标颜色
  Color get _categoryColor {
    switch (template.category) {
      case '日记':
        return AeroColors.accentBlue;
      case '工作':
        return AeroColors.accentOrange;
      case '学习':
        return AeroColors.accentCyan;
      case '效率':
        return AeroColors.accentGreen;
      default:
        return AeroColors.accentPurple;
    }
  }

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: BoxDecoration(
            color: AeroColors.bgSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AeroColors.border, width: 0.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── 顶部色条 + 图标 ──
              Container(
                height: 4,
                decoration: BoxDecoration(
                  color: _categoryColor,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(8),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
                child: Row(
                  children: [
                    Icon(
                      IconData(template.iconCodePoint, // ignore: non_const_argument_for_const_parameter
                          fontFamily: 'MaterialIcons'),
                      size: 14,
                      color: _categoryColor,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        template.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AeroColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // ── 预览内容 (前 3 行) ──
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Text(
                    template.preview(lines: 3),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AeroColors.textMuted,
                      height: 1.5,
                    ),
                  ),
                ),
              ),
              // ── 底部标签 ──
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: _categoryColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Text(
                        template.category,
                        style: TextStyle(
                          fontSize: 9,
                          color: _categoryColor,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    if (template.isCustom) ...[
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: AeroColors.accentOrange.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: const Text(
                          '自定义',
                          style: TextStyle(
                            fontSize: 9,
                            color: AeroColors.accentOrange,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
