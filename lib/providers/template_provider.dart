import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/services/platform_env.dart';
import '../features/templates/services/template_service.dart';
import '../features/daily_notes/services/daily_note_service.dart';

// ──────────────────────────────────────────────
// 模板状态管理 (Template Provider)
// ──────────────────────────────────────────────
// 管理模板列表、当前选中模板、模板应用状态
// ──────────────────────────────────────────────

/// 模板画廊的不可变状态
class TemplateGalleryState {
  /// 是否打开模板画廊弹窗
  final bool isOpen;

  /// 当前搜索关键字
  final String searchQuery;

  /// 当前选中的分类过滤（空字符串表示全部）
  final String selectedCategory;

  /// 所有可用模板
  final List<TemplateDef> templates;

  /// 当前选中的模板 ID
  final String? selectedTemplateId;

  const TemplateGalleryState({
    this.isOpen = false,
    this.searchQuery = '',
    this.selectedCategory = '',
    this.templates = const [],
    this.selectedTemplateId,
  });

  TemplateGalleryState copyWith({
    bool? isOpen,
    String? searchQuery,
    String? selectedCategory,
    List<TemplateDef>? templates,
    String? selectedTemplateId,
  }) {
    return TemplateGalleryState(
      isOpen: isOpen ?? this.isOpen,
      searchQuery: searchQuery ?? this.searchQuery,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      templates: templates ?? this.templates,
      selectedTemplateId: selectedTemplateId,
    );
  }

  /// 过滤后的模板列表
  List<TemplateDef> get filteredTemplates {
    var result = templates;

    // 按分类过滤
    if (selectedCategory.isNotEmpty) {
      result = result.where((t) => t.category == selectedCategory).toList();
    }

    // 按搜索关键字过滤
    if (searchQuery.isNotEmpty) {
      final lowerQuery = searchQuery.toLowerCase();
      result = result.where((t) {
        return t.name.toLowerCase().contains(lowerQuery) ||
            t.description.toLowerCase().contains(lowerQuery) ||
            t.category.toLowerCase().contains(lowerQuery);
      }).toList();
    }

    return result;
  }

  /// 获取所有分类
  List<String> get categories {
    return templates.map((t) => t.category).toSet().toList()..sort();
  }
}

/// 模板画廊 Notifier
class TemplateGalleryNotifier extends Notifier<TemplateGalleryState> {
  late final TemplateService _service;

  @override
  TemplateGalleryState build() {
    _service = TemplateService.instance;
    return TemplateGalleryState(
      templates: _service.allTemplates,
    );
  }

  /// 打开模板画廊
  void open() {
    state = state.copyWith(
      isOpen: true,
      searchQuery: '',
      selectedCategory: '',
      selectedTemplateId: null,
      templates: _service.allTemplates,
    );
  }

  /// 关闭模板画廊
  void close() {
    state = state.copyWith(isOpen: false);
  }

  /// 更新搜索关键字
  void updateSearch(String query) {
    state = state.copyWith(
      searchQuery: query,
      selectedTemplateId: null,
    );
  }

  /// 设置分类过滤
  void setCategory(String category) {
    state = state.copyWith(
      selectedCategory: category,
      selectedTemplateId: null,
    );
  }

  /// 选中一个模板
  void selectTemplate(String templateId) {
    state = state.copyWith(selectedTemplateId: templateId);
  }

  /// 应用选中的模板，返回替换后的内容
  ///
  /// [variables] 变量值映射
  /// 返回替换后的 Markdown 内容，如果无选中模板则返回 null
  String? applySelectedTemplate(Map<String, String> variables) {
    if (state.selectedTemplateId == null) return null;
    return _service.applyTemplate(state.selectedTemplateId!, variables);
  }

  /// 应用指定模板
  String applyTemplate(String templateId, Map<String, String> variables) {
    return _service.applyTemplate(templateId, variables);
  }

  /// 从笔记内容保存为自定义模板
  TemplateDef saveAsTemplate({
    required String name,
    required String category,
    required String content,
  }) {
    final template = _service.createFromContent(
      name: name,
      category: category,
      content: content,
    );
    // 刷新模板列表
    state = state.copyWith(templates: _service.allTemplates);
    return template;
  }

  /// 删除自定义模板
  void removeCustomTemplate(String templateId) {
    _service.removeCustomTemplate(templateId);
    state = state.copyWith(templates: _service.allTemplates);
  }
}

/// 模板画廊 Provider
final templateGalleryProvider =
    NotifierProvider<TemplateGalleryNotifier, TemplateGalleryState>(
  TemplateGalleryNotifier.new,
);

/// TemplateService 单例 Provider
final templateServiceProvider = Provider<TemplateService>((ref) {
  return TemplateService.instance;
});

/// 日记服务 Provider
///
/// 使用默认配置。如果需要自定义配置，可以在 app 启动时 override。
final dailyNoteServiceProvider = Provider<DailyNoteService>((ref) {
  // 默认知识库根目录: 用户文档目录下的 Aeromind
  // 实际项目中应从配置或 path_provider 获取
  return DailyNoteService(
    vaultRoot: _defaultVaultRoot(),
  );
});

/// 日记配置 Provider
final dailyNoteConfigProvider = Provider<DailyNoteConfig>((ref) {
  return const DailyNoteConfig();
});

/// 获取默认知识库根目录
/// Web 端使用相对路径，桌面端使用用户主目录
String _defaultVaultRoot() {
  if (kIsWeb) {
    return '/aeromind';
  }
  // 桌面端使用用户主目录下的 Aeromind 文件夹
  final env = platformEnv;
  final home = env['HOME'] ?? env['USERPROFILE'] ?? '/tmp';
  return '$home/Aeromind';
}
