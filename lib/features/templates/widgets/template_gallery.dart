import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/note_model.dart';
import '../../../core/theme/aeromind_theme.dart';
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
    extends ConsumerState<TemplateGalleryOverlay>
    with SingleTickerProviderStateMixin {
  late final TextEditingController _searchController;
  late final FocusNode _searchFocusNode;
  late final AnimationController _animController;
  late final Animation<double> _fadeAnimation;
  late final Animation<double> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _searchFocusNode = FocusNode();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOut,
    );
    _slideAnimation = Tween<double>(begin: 20.0, end: 0.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    _animController.dispose();
    super.dispose();
  }

  void _handleOpenChange(bool isOpen) {
    if (isOpen) {
      _searchController.clear();
      _animController.forward();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _searchFocusNode.requestFocus();
      });
    } else {
      _animController.reverse();
    }
  }

  /// 应用模板并创建新面板
  void _applyTemplate(TemplateDef template) async {
    final paneNotifier = ref.read(paneStackProvider.notifier);
    final templateNotifier = ref.read(templateGalleryProvider.notifier);
    final noteRepo = ref.read(noteRepositoryProvider);

    // 替换模板变量
    final content = templateNotifier.applyTemplate(template.id, {});

    // 创建新笔记
    final now = DateTime.now();
    final id = now.millisecondsSinceEpoch.toString();
    final note = NoteModel(
      id: id,
      title: template.name,
      rawMarkdown: content,
      filePath: '',
      createdAt: now,
      updatedAt: now,
    );
    await noteRepo.saveNote(note);

    // 打开新面板
    paneNotifier.openPane(id, template.name);

    // 刷新侧边栏
    await ref.read(sidebarProvider.notifier).loadNoteTree();

    // 关闭画廊
    templateNotifier.close();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(templateGalleryProvider);

    ref.listen<bool>(
      templateGalleryProvider.select((s) => s.isOpen),
      (prev, next) => _handleOpenChange(next),
    );

    if (!state.isOpen) return const SizedBox.shrink();

    return FadeTransition(
      opacity: _fadeAnimation,
      child: _buildOverlay(state),
    );
  }

  Widget _buildOverlay(TemplateGalleryState state) {
    return Material(
      color: Colors.black54,
      child: GestureDetector(
        onTap: () => ref.read(templateGalleryProvider.notifier).close(),
        behavior: HitTestBehavior.opaque,
        child: Center(
          child: GestureDetector(
            onTap: () {},
            child: ListenableBuilder(
            listenable: _animController,
            builder: (context, child) {
              return Transform.translate(
                offset: Offset(0, _slideAnimation.value),
                child: child,
              );
            },
            child: _buildPanel(state),
          ),
          ),
        ),
      ),
    );
  }

  Widget _buildPanel(TemplateGalleryState state) {
    final screenWidth = MediaQuery.of(context).size.width;
    final screenHeight = MediaQuery.of(context).size.height;
    final panelWidth = screenWidth > 800 ? 720.0 : screenWidth - 48.0;
    final panelHeight = screenHeight > 600 ? 520.0 : screenHeight - 80.0;

    return Container(
      width: panelWidth,
      height: panelHeight,
      decoration: BoxDecoration(
        color: AeroColors.bgElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AeroColors.border, width: 0.5),
        boxShadow: const [
          BoxShadow(
            color: AeroColors.shadow,
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          // ── 标题栏 ──
          _buildTitleBar(),
          const Divider(height: 1, thickness: 0.5),
          // ── 搜索栏 + 分类过滤 ──
          _buildSearchAndFilter(state),
          const Divider(height: 1, thickness: 0.5),
          // ── 模板卡片网格 ──
          Expanded(child: _buildTemplateGrid(state)),
        ],
      ),
    );
  }

  Widget _buildTitleBar() {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Icon(Icons.dashboard_customize_outlined,
              size: 18, color: AeroColors.accentBlue),
          const SizedBox(width: 8),
          Text(
            '模板画廊',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AeroColors.textPrimary,
            ),
          ),
          const Spacer(),
          Text(
            '${ref.read(templateGalleryProvider).templates.length} 个模板',
            style: TextStyle(
              fontSize: 11,
              color: AeroColors.textMuted,
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: () => ref.read(templateGalleryProvider.notifier).close(),
            child: Icon(Icons.close, size: 16, color: AeroColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchAndFilter(TemplateGalleryState state) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          // 搜索框
          Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: AeroColors.bgSurface,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AeroColors.border, width: 0.5),
            ),
            child: Row(
              children: [
                Icon(Icons.search, size: 14, color: AeroColors.textMuted),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    focusNode: _searchFocusNode,
                    onChanged: (q) {
                      ref
                          .read(templateGalleryProvider.notifier)
                          .updateSearch(q);
                    },
                    style: const TextStyle(
                      color: AeroColors.textPrimary,
                      fontSize: 13,
                    ),
                    decoration: const InputDecoration(
                      hintText: '搜索模板...',
                      hintStyle: TextStyle(color: AeroColors.textMuted),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
              ],
            ),
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
                    ? AeroColors.accentBlue.withOpacity(0.15)
                    : AeroColors.bgSurface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isSelected
                      ? AeroColors.accentBlue.withOpacity(0.4)
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
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off, size: 32, color: AeroColors.textMuted),
            const SizedBox(height: 8),
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
                      IconData(template.iconCodePoint,
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
                        style: TextStyle(
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
                    style: TextStyle(
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
                        color: _categoryColor.withOpacity(0.12),
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
                          color: AeroColors.accentOrange.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(
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
