import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/aeromind_theme.dart';
import 'core/models/note_model.dart';
import 'core/plugin/plugin_registry.dart';
import 'core/plugin/plugin_api.dart';
import 'core/services/plugin_api_impl.dart';
import 'core/services/hive_service.dart';
import 'core/builtin_plugins/word_count_plugin.dart';
import 'core/builtin_plugins/markdown_enhance_plugin.dart';
import 'core/builtin_plugins/export_plugin.dart';
import 'core/builtin_plugins/mermaid_plugin.dart';
import 'features/sliding_panes/widgets/sliding_panes_container.dart';
import 'features/editor/widgets/note_panel.dart';
import 'features/knowledge_graph/widgets/graph_canvas.dart';
import 'features/knowledge_graph/widgets/graph_controls.dart';
import 'features/knowledge_graph/widgets/graph_overlay.dart';
import 'features/command_palette/widgets/command_palette.dart';
import 'features/templates/widgets/template_gallery.dart';
import 'features/sidebar/widgets/sidebar_container.dart';
import 'features/plugins/widgets/plugin_manager_panel.dart';
import 'features/settings/widgets/settings_page.dart';
import 'features/help/widgets/keyboard_cheatsheet.dart';
import 'features/help/widgets/welcome_page.dart';
import 'features/import_export/widgets/import_export_panel.dart';
import 'providers/pane_provider.dart';
import 'providers/ai_provider.dart';
import 'providers/graph_provider.dart';
import 'providers/command_provider.dart';
import 'providers/template_provider.dart';
import 'providers/sidebar_provider.dart';
import 'providers/plugin_provider.dart';
import 'providers/note_provider.dart';
import 'providers/settings_provider.dart';
import 'core/services/version_service.dart';
import 'features/editor/widgets/version_history_panel.dart';
import 'features/sidebar/models/sidebar_state.dart';

/// ══════════════════════════════════════════════════
/// AeroMind App Shell
/// ══════════════════════════════════════════════════
/// 顶层 Widget，组装:
///   - 左侧侧边栏 (笔记树/搜索/标签/插件)
///   - 中间 SlidingPanesContainer (笔记流)
///   - 右侧 AI 面板 (上下文预览)
///   - 知识图谱覆盖层
///   - 命令面板覆盖层
///   - 模板画廊覆盖层
///   - 插件管理覆盖层
/// ──────────────────────────────────────────────────

class AeroMindApp extends ConsumerWidget {
  const AeroMindApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    return MaterialApp(
      title: 'AeroMind',
      theme: AeroTheme.dark,
      darkTheme: AeroTheme.dark,
      themeMode: settings.flutterThemeMode,
      debugShowCheckedModeBanner: false,
      home: const _AppShell(),
    );
  }
}

/// App Shell — 所有覆盖层通过 Stack 叠加
class _AppShell extends ConsumerStatefulWidget {
  const _AppShell();

  @override
  ConsumerState<_AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<_AppShell>
    with SingleTickerProviderStateMixin {
  /// 知识图谱是否可见
  bool _isGraphVisible = false;

  /// 设置页面是否可见
  bool _isSettingsVisible = false;

  /// 快捷键速查表是否可见
  bool _isCheatsheetVisible = false;

  /// 欢迎页面是否可见
  bool _isWelcomeVisible = false;

  /// 导入导出面板是否可见
  bool _isImportExportVisible = false;

  /// 是否已显示过欢迎页 (从 metaBox 读取)
  bool _hasShownWelcome = false;

  /// 展开动画控制器
  late AnimationController _graphAnimController;
  late Animation<double> _graphAnimation;

  /// 图谱按钮的位置
  Offset _graphButtonPosition = Offset.zero;

  /// 命令快捷键 FocusNode
  late final FocusNode _shortcutFocusNode;

  /// 全局 Scaffold Messenger Key (供插件通知使用)
  final _scaffoldKey = GlobalKey<ScaffoldMessengerState>();

  /// 插件 API 实例
  PluginApiImpl? _pluginApi;

  /// 是否已初始化插件
  bool _pluginsInitialized = false;

  @override
  void initState() {
    super.initState();
    _graphAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _graphAnimation = CurvedAnimation(
      parent: _graphAnimController,
      curve: Curves.easeOutCubic,
    );
    _shortcutFocusNode = FocusNode();

    // 注册全局键盘快捷键处理器（使用 HardwareKeyboard 确保在所有平台
    // 包括 Web 上都能收到键盘事件，不依赖 Focus 层级传播）
    HardwareKeyboard.instance.addHandler(_handleHardwareKeyEvent);

    // 延迟初始化插件系统
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initPlugins();
      _initCommandActions();
      _maybeShowWelcome();
    });
  }

  /// 首次启动时显示欢迎页
  Future<void> _maybeShowWelcome() async {
    try {
      final seen = HiveService.metaBox.get('welcome_shown') == true;
      if (!seen && mounted) {
        setState(() => _isWelcomeVisible = true);
        await HiveService.metaBox.put('welcome_shown', true);
      }
    } catch (_) {}
  }

  /// 初始化插件系统和内置插件
  Future<void> _initPlugins() async {
    if (_pluginsInitialized) return;
    _pluginsInitialized = true;

    final registry = PluginRegistry.instance;

    // 创建 PluginApi 实现
    _pluginApi = PluginApiImpl(ref);

    // 初始化注册表
    await registry.initialize(_pluginApi!);

    // 注册内置插件
    await registry.register(WordCountPlugin());
    await registry.register(MarkdownEnhancePlugin());
    await registry.register(ExportPlugin());
    await registry.register(MermaidRenderPlugin());

    // 内置插件注册完成后刷新插件状态，确保状态栏计数正确
    if (mounted) {
      ref.invalidate(pluginManagerProvider);
    }

    // 监听插件通知
    _pluginApi!.notifications.listen((notification) {
      if (_scaffoldKey.currentState != null) {
        _scaffoldKey.currentState!.showSnackBar(
          SnackBar(
            content: Text(notification.message),
            duration: const Duration(seconds: 3),
            backgroundColor: _notificationColor(notification.type),
          ),
        );
      }
    });
  }

  Color _notificationColor(NotificationType type) {
    switch (type) {
      case NotificationType.info:
        return AeroColors.accentBlue;
      case NotificationType.success:
        return AeroColors.accentGreen;
      case NotificationType.warning:
        return AeroColors.accentOrange;
      case NotificationType.error:
        return AeroColors.accentPurple;
    }
  }

  /// 初始化命令面板的 action 绑定
  void _initCommandActions() {
    final notifier = ref.read(commandPaletteProvider.notifier);

    notifier.bindActions({
      // 打开本地文件 (直接打开)
      'note.openFile': () async {
        final service = ref.read(filePickerServiceProvider);
        final note = await service.pickAndOpen();
        if (note != null && mounted) {
          ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
        }
      },

      // 导入本地文件 (存入 Hive)
      'note.importFile': () async {
        final service = ref.read(filePickerServiceProvider);
        final note = await service.pickAndImport();
        if (note != null && mounted) {
          ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
        }
      },

      // 新建笔记
      'note.new': () async {
        final repo = ref.read(noteRepositoryProvider);
        final now = DateTime.now();
        final note = NoteModel(
          id: now.millisecondsSinceEpoch.toString(),
          title: '新笔记',
          rawMarkdown: '',
          filePath: '',
          createdAt: now,
          updatedAt: now,
        );
        await repo.saveNote(note);
        if (mounted) {
          ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
        }
      },

      // 重命名当前笔记
      'note.rename': () {
        final paneState = ref.read(paneStackProvider);
        final noteId = paneState.activeNoteId;
        if (noteId == null) return;
        // 触发侧边栏的重命名（通过状态通知的方式）
        // 简单做法：直接显示对话框
        _showRenameDialog(noteId);
      },

      // 删除当前笔记
      'note.delete': () {
        final paneState = ref.read(paneStackProvider);
        final noteId = paneState.activeNoteId;
        if (noteId == null) return;
        _showDeleteConfirmDialog(noteId);
      },

      // 复制当前笔记
      'note.duplicate': () async {
        final paneState = ref.read(paneStackProvider);
        final noteId = paneState.activeNoteId;
        if (noteId == null) return;
        final repo = ref.read(noteRepositoryProvider);
        final note = await repo.getNote(noteId);
        if (note == null) return;
        final now = DateTime.now();
        final duplicated = NoteModel(
          id: now.millisecondsSinceEpoch.toString(),
          title: '${note.title} 副本',
          rawMarkdown: note.rawMarkdown,
          filePath: note.filePath,
          createdAt: now,
          updatedAt: now,
          tags: note.tags,
          folderPath: note.folderPath,
        );
        await repo.saveNote(duplicated);
        await ref.read(sidebarProvider.notifier).loadNoteTree();
        if (mounted) {
          ref.read(paneStackProvider.notifier).openPane(duplicated.id, duplicated.title);
        }
      },

      // 打开今天的日记
      'note.daily': () => _openTodayDailyNote(),

      // 打开知识图谱
      'view.knowledgeGraph': () => _toggleGraph(Offset.zero),

      // 切换侧边栏
      'view.toggleSidebar': () {
        ref.read(sidebarProvider.notifier).toggleExpanded();
      },

      // 打开设置
      'settings.open': () {
        setState(() => _isSettingsVisible = true);
      },

      // 版本历史
      'note.versionHistory': () {
        final noteId = ref.read(paneStackProvider).activeNoteId;
        if (noteId == null) return;
        _showVersionHistory(noteId);
      },

      // 导出全部笔记
      'note.exportAll': () => _exportAllNotes(),

      // 回收站
      'note.openTrash': () {
        ref.read(sidebarProvider.notifier).switchView(SidebarView.trash);
      },

      // 快捷键速查表
      'help.shortcuts': () {
        setState(() => _isCheatsheetVisible = true);
      },

      // 欢迎页面
      'help.welcome': () {
        setState(() => _isWelcomeVisible = true);
      },

      // 导入导出面板
      'note.importExport': () {
        setState(() => _isImportExportVisible = true);
      },
    });
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleHardwareKeyEvent);
    _graphAnimController.dispose();
    _shortcutFocusNode.dispose();
    _pluginApi?.dispose();
    PluginRegistry.instance.disposeAll();
    super.dispose();
  }

  /// 全局键盘快捷键处理器（基于 HardwareKeyboard，不依赖 Focus 层级）
  bool _handleHardwareKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final isMeta =
        HardwareKeyboard.instance.isMetaPressed ||
        HardwareKeyboard.instance.isControlPressed;

    // Cmd+K / Ctrl+K: 命令面板
    if (isMeta && event.logicalKey == LogicalKeyboardKey.keyK) {
      ref.read(commandPaletteProvider.notifier).toggle();
      return true;
    }

    // Cmd+T / Ctrl+T: 模板画廊
    if (isMeta && event.logicalKey == LogicalKeyboardKey.keyT) {
      final templateState = ref.read(templateGalleryProvider);
      if (templateState.isOpen) {
        ref.read(templateGalleryProvider.notifier).close();
      } else {
        ref.read(templateGalleryProvider.notifier).open();
      }
      return true;
    }

    // Cmd+D / Ctrl+D: 今天的日记
    if (isMeta && event.logicalKey == LogicalKeyboardKey.keyD) {
      _openTodayDailyNote();
      return true;
    }

    // Cmd+B / Ctrl+B: 切换侧边栏
    if (isMeta && event.logicalKey == LogicalKeyboardKey.keyB) {
      ref.read(sidebarProvider.notifier).toggleExpanded();
      return true;
    }

    // Cmd+Shift+P / Ctrl+Shift+P: 插件管理
    if (isMeta &&
        HardwareKeyboard.instance.isShiftPressed &&
        event.logicalKey == LogicalKeyboardKey.keyP) {
      final pluginState = ref.read(pluginManagerProvider);
      if (pluginState.isOpen) {
        ref.read(pluginManagerProvider.notifier).close();
      } else {
        ref.read(pluginManagerProvider.notifier).open();
      }
      return true;
    }

    // ?: 快捷键速查表 (Shift+/)
    if (event.logicalKey == LogicalKeyboardKey.slash &&
        HardwareKeyboard.instance.isShiftPressed) {
      setState(() => _isCheatsheetVisible = !_isCheatsheetVisible);
      return true;
    }

    // Escape: 关闭所有覆盖层
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      _closeAllOverlays();
      return true;
    }

    return false;
  }

  /// 关闭所有覆盖层
  void _closeAllOverlays() {
    final cmdState = ref.read(commandPaletteProvider);
    final tplState = ref.read(templateGalleryProvider);
    final pluginState = ref.read(pluginManagerProvider);

    if (cmdState.isOpen) {
      ref.read(commandPaletteProvider.notifier).close();
    } else if (tplState.isOpen) {
      ref.read(templateGalleryProvider.notifier).close();
    } else if (pluginState.isOpen) {
      ref.read(pluginManagerProvider.notifier).close();
    } else if (_isSettingsVisible) {
      setState(() => _isSettingsVisible = false);
    } else if (_isCheatsheetVisible) {
      setState(() => _isCheatsheetVisible = false);
    } else if (_isWelcomeVisible) {
      setState(() => _isWelcomeVisible = false);
    } else if (_isImportExportVisible) {
      setState(() => _isImportExportVisible = false);
    } else if (_isGraphVisible) {
      _toggleGraph(Offset.zero);
    }
  }

  /// 打开今天的日记
  void _openTodayDailyNote() async {
    try {
      final service = ref.read(dailyNoteServiceProvider);
      final (note, isNew) = await service.getTodayNote();
      if (mounted) {
        ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
      }
    } catch (e) {
      // 静默处理
    }
  }

  /// 显示重命名笔记对话框
  /// 显示版本历史面板
  void _showVersionHistory(String noteId) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
        backgroundColor: AeroColors.bgSurface,
        child: SizedBox(
          width: 500,
          height: 600,
          child: VersionHistoryPanel(
            noteId: noteId,
            onClose: () => Navigator.pop(ctx),
            onRestore: (content) async {
              final repo = ref.read(noteRepositoryProvider);
              final note = await repo.getNote(noteId);
              if (note != null) {
                await repo.saveNote(note.copyWith(
                  rawMarkdown: content,
                  updatedAt: DateTime.now(),
                ));
              }
              if (mounted) Navigator.pop(ctx);
            },
          ),
        ),
      ),
    );
  }

  /// 导出全部笔记为 JSON
  Future<void> _exportAllNotes() async {
    final repo = ref.read(noteRepositoryProvider);
    final notes = await repo.getAllNotes();
    if (notes.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('没有可导出的笔记')),
        );
      }
      return;
    }

    // 序列化所有笔记为 JSON 字符串
    final jsonList = notes.map((n) => {
      'id': n.id,
      'title': n.title,
      'rawMarkdown': n.rawMarkdown,
      'tags': n.tags,
      'createdAt': n.createdAt.toIso8601String(),
      'updatedAt': n.updatedAt.toIso8601String(),
    }).toList();

    final jsonStr = const JsonEncoder.withIndent('  ').convert(jsonList);

    // 复制到剪贴板
    await Clipboard.setData(ClipboardData(text: jsonStr));

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('已导出 ${notes.length} 篇笔记到剪贴板')),
      );
    }
  }

  void _showRenameDialog(String noteId) async {
    final repo = ref.read(noteRepositoryProvider);
    final note = await repo.getNote(noteId);
    if (note == null || !mounted) return;

    final controller = TextEditingController(text: note.title);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text('重命名笔记',
            style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: AeroColors.textPrimary, fontSize: 13),
          decoration: const InputDecoration(
            hintText: '新标题...',
            hintStyle: TextStyle(color: AeroColors.textMuted),
            isDense: true,
          ),
          onSubmitted: (_) => _doRename(ctx, noteId, controller.text),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
          ),
          TextButton(
            onPressed: () => _doRename(ctx, noteId, controller.text),
            child: const Text('确定', style: TextStyle(color: AeroColors.accentBlue)),
          ),
        ],
      ),
    );
  }

  Future<void> _doRename(BuildContext ctx, String noteId, String newTitle) async {
    if (newTitle.trim().isEmpty) {
      Navigator.pop(ctx);
      return;
    }
    await ref.read(sidebarProvider.notifier).renameNote(noteId, newTitle.trim());
    if (ctx.mounted) Navigator.pop(ctx);
  }

  /// 显示删除确认对话框
  void _showDeleteConfirmDialog(String noteId) async {
    final repo = ref.read(noteRepositoryProvider);
    final note = await repo.getNote(noteId);
    if (note == null || !mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AeroColors.bgElevated,
        title: const Text('确认删除',
            style: TextStyle(color: AeroColors.textPrimary, fontSize: 14)),
        content: Text(
          '确定要删除「${note.title}」吗？\n此操作不可撤销。',
          style: const TextStyle(color: AeroColors.textSecondary, fontSize: 12),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消', style: TextStyle(color: AeroColors.textMuted)),
          ),
          TextButton(
            onPressed: () async {
              await ref.read(sidebarProvider.notifier).deleteNote(noteId);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('删除', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  /// 切换知识图谱可见性
  void _toggleGraph(Offset buttonPosition) {
    if (_isGraphVisible) {
      _graphAnimController.reverse().then((_) {
        if (mounted) setState(() => _isGraphVisible = false);
      });
    } else {
      setState(() {
        _graphButtonPosition = buttonPosition;
        _isGraphVisible = true;
      });
      _buildGraphData();
      _graphAnimController.forward(from: 0.0);
    }
  }

  /// 从当前面板栈构建知识图谱数据
  void _buildGraphData() async {
    final paneState = ref.read(paneStackProvider);
    final repo = ref.read(noteRepositoryProvider);
    final graphNotifier = ref.read(graphProvider.notifier);

    // 收集面板中所有笔记 + 它们的链接笔记
    final noteIds = <String>{};
    for (final pane in paneState.panes) {
      noteIds.add(pane.noteId);
    }

    // 获取所有笔记
    final allNotes = await repo.getAllNotes();
    if (allNotes.isEmpty) {
      _buildDemoGraph();
      return;
    }

    // 如果打开的笔记太少，加入所有笔记到图谱
    if (noteIds.length < 3) {
      for (final note in allNotes) {
        noteIds.add(note.id);
      }
    }

    // 收集链接的笔记
    for (final note in allNotes) {
      if (noteIds.contains(note.id)) {
        for (final link in note.outgoingLinks) {
          noteIds.add(link);
        }
        for (final link in note.backlinks) {
          noteIds.add(link);
        }
      }
    }

    // 限制节点数量避免性能问题
    const maxNodes = 50;
    final selectedNotes = allNotes
        .where((n) => noteIds.contains(n.id))
        .take(maxNodes)
        .map((n) => n.asNoteData)
        .toList();

    if (selectedNotes.length < 2) {
      _buildDemoGraph();
      return;
    }

    graphNotifier.buildFromNotes(selectedNotes);
  }

  void _buildDemoGraph() {
    final graphNotifier = ref.read(graphProvider.notifier);
    final demoNotes = _createDemoNotes();
    graphNotifier.buildFromNotes(demoNotes);
  }

  List<_DemoNote> _createDemoNotes() {
    return [
      _DemoNote(
        'note_flutter',
        'Flutter 开发笔记',
        ['概念'],
        ['note_dart', 'note_state', 'note_ui'],
      ),
      _DemoNote(
        'note_dart',
        'Dart 语言特性',
        ['概念'],
        ['note_flutter', 'note_perf'],
      ),
      _DemoNote(
        'note_state',
        '状态管理方案',
        ['概念', '引用'],
        ['note_flutter', 'note_riverpod'],
      ),
      _DemoNote('note_ui', 'UI 设计原则', ['概念'], ['note_flutter', 'note_theme']),
      _DemoNote('note_perf', '性能优化策略', ['引用'], ['note_dart', 'note_flutter']),
      _DemoNote(
        'note_riverpod',
        'Riverpod 深入',
        ['引用'],
        ['note_state', 'note_flutter'],
      ),
      _DemoNote('note_theme', '主题与样式系统', ['概念'], ['note_ui']),
      _DemoNote('note_test', '测试最佳实践', ['任务'], ['note_flutter']),
      _DemoNote('note_deploy', '部署与发布', ['任务'], ['note_flutter', 'note_perf']),
      _DemoNote(
        'note_arch',
        '架构设计模式',
        ['概念', '引用'],
        ['note_flutter', 'note_state'],
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (!_shortcutFocusNode.hasFocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _shortcutFocusNode.requestFocus();
      });
    }

    return Focus(
      focusNode: _shortcutFocusNode,
      autofocus: true,
      child: ScaffoldMessenger(
        key: _scaffoldKey,
        child: Scaffold(
          backgroundColor: AeroColors.bgDeep,
          body: Stack(
            children: [
              // ── 主布局 ──
              Row(
                children: [
                  // ── 左侧: 侧边栏 ──
                  SidebarContainer(
                    onNoteSelected: (noteId, title) {
                      ref
                          .read(paneStackProvider.notifier)
                          .openPane(noteId, title);
                    },
                  ),

                  // ── 中间: Sliding Panes 笔记流 ──
                  Expanded(
                    child: Column(
                      children: [
                        Expanded(
                          child: SlidingPanesContainer(
                            paneBuilder: (context, noteId, index) {
                              return NotePanel(noteId: noteId);
                            },
                          ),
                        ),
                        // ── 底部状态栏 ──
                        const _StatusBar(),
                      ],
                    ),
                  ),

                  // ── 右侧: AI 上下文面板 ──
                  const _AIContextSidePanel(),
                ],
              ),

              // ── 知识图谱覆盖层 ──
              if (_isGraphVisible)
                ListenableBuilder(
                  listenable: _graphAnimController,
                  builder: (context, child) {
                    return _KnowledgeGraphOverlay(
                      animationValue: _graphAnimation.value,
                      buttonPosition: _graphButtonPosition,
                      onClose: () => _toggleGraph(Offset.zero),
                      onOpenNote: (noteId, title) {
                        _toggleGraph(Offset.zero);
                        ref
                            .read(paneStackProvider.notifier)
                            .openPane(noteId, title);
                      },
                    );
                  },
                ),

              // ── 命令面板覆盖层 ──
              const CommandPaletteOverlay(),

              // ── 模板画廊覆盖层 ──
              const TemplateGalleryOverlay(),

              // ── 插件管理覆盖层 ──
              const PluginManagerOverlay(),

              // ── 设置页面覆盖层 ──
              if (_isSettingsVisible)
                Positioned.fill(
                  child: SettingsPage(
                    onClose: () => setState(() => _isSettingsVisible = false),
                  ),
                ),

              // ── 快捷键速查表覆盖层 ──
              if (_isCheatsheetVisible)
                KeyboardCheatsheetOverlay(
                  onClose: () => setState(() => _isCheatsheetVisible = false),
                ),

              // ── 欢迎页面覆盖层 ──
              if (_isWelcomeVisible)
                WelcomePage(
                  onClose: () => setState(() => _isWelcomeVisible = false),
                  onShowShortcuts: () {
                    setState(() {
                      _isWelcomeVisible = false;
                      _isCheatsheetVisible = true;
                    });
                  },
                ),

              // ── 导入导出面板覆盖层 ──
              if (_isImportExportVisible)
                ImportExportPanel(
                  activeNoteId: ref.watch(paneStackProvider).activeNoteId,
                  onClose: () =>
                      setState(() => _isImportExportVisible = false),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 知识图谱覆盖层
class _KnowledgeGraphOverlay extends StatelessWidget {
  final double animationValue;
  final Offset buttonPosition;
  final VoidCallback onClose;
  final void Function(String noteId, String title) onOpenNote;

  const _KnowledgeGraphOverlay({
    required this.animationValue,
    required this.buttonPosition,
    required this.onClose,
    required this.onOpenNote,
  });

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final maxRadius = math.sqrt(
      screenSize.width * screenSize.width +
          screenSize.height * screenSize.height,
    );

    return ClipPath(
      clipper: _CircleRevealClipper(
        center: buttonPosition,
        radius: maxRadius * animationValue,
      ),
      child: Material(
        color: AeroColors.bgDeep,
        child: Column(
          children: [
            Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: const BoxDecoration(
                color: AeroColors.bgElevated,
                border: Border(
                  bottom: BorderSide(color: AeroColors.divider, width: 0.5),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.account_tree_outlined,
                    size: 16,
                    color: AeroColors.accentBlue,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '知识图谱',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AeroColors.accentBlue,
                      fontSize: 14,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(
                      Icons.close,
                      size: 18,
                      color: AeroColors.textSecondary,
                    ),
                    onPressed: onClose,
                    tooltip: '关闭图谱',
                    splashRadius: 16,
                  ),
                ],
              ),
            ),
            Expanded(
              child: Row(
                children: [
                  const GraphControls(),
                  Expanded(
                    child: Stack(
                      children: [
                        GraphCanvas(onOpenNote: onOpenNote),
                        GraphOverlay(onOpenNote: onOpenNote),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 圆形展开裁剪器
class _CircleRevealClipper extends CustomClipper<Path> {
  final Offset center;
  final double radius;

  _CircleRevealClipper({required this.center, required this.radius});

  @override
  Path getClip(Size size) {
    return Path()..addOval(Rect.fromCircle(center: center, radius: radius));
  }

  @override
  bool shouldReclip(covariant _CircleRevealClipper oldClipper) {
    return center != oldClipper.center || radius != oldClipper.radius;
  }
}

/// 右侧 AI 上下文面板
class _AIContextSidePanel extends ConsumerWidget {
  const _AIContextSidePanel();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final aiContext = ref.watch(aiContextPromptProvider);

    return Container(
      width: 260,
      decoration: const BoxDecoration(
        color: AeroColors.bgSurface,
        border: Border(left: BorderSide(color: AeroColors.divider, width: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: const BoxDecoration(
              color: AeroColors.bgElevated,
              border: Border(
                bottom: BorderSide(color: AeroColors.divider, width: 0.5),
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.auto_awesome,
                  size: 14,
                  color: AeroColors.accentPurple,
                ),
                const SizedBox(width: 6),
                Text(
                  'AI 上下文',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AeroColors.accentPurple,
                  ),
                ),
                const Spacer(),
                Text(
                  '~${aiContext.estimatedTokens} tokens',
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(8),
              children: [
                Text(
                  '可见面板 (${aiContext.fragments.length})',
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: AeroColors.textMuted),
                ),
                const SizedBox(height: 6),
                ...aiContext.fragments.map(
                  (f) => _ContextFragmentTile(fragment: f),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ContextFragmentTile extends StatelessWidget {
  final PaneContextFragment fragment;
  const _ContextFragmentTile({required this.fragment});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: fragment.isActive
            ? AeroColors.accentBlue.withOpacity(0.08)
            : AeroColors.bgElevated,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: fragment.isActive
              ? AeroColors.accentBlue.withOpacity(0.3)
              : AeroColors.border,
          width: 0.5,
        ),
      ),
      child: Row(
        children: [
          Icon(
            fragment.isActive ? Icons.push_pin : Icons.description_outlined,
            size: 12,
            color: fragment.isActive
                ? AeroColors.accentBlue
                : AeroColors.textMuted,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              fragment.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: fragment.isActive
                    ? AeroColors.accentBlue
                    : AeroColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 底部状态栏
class _StatusBar extends ConsumerWidget {
  const _StatusBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paneState = ref.watch(paneStackProvider);
    final pluginState = ref.watch(pluginManagerProvider);

    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        color: AeroColors.bgElevated,
        border: Border(top: BorderSide(color: AeroColors.divider, width: 0.5)),
      ),
      child: Row(
        children: [
          // 面板信息
          Icon(Icons.article_outlined, size: 12, color: AeroColors.textMuted),
          const SizedBox(width: 4),
          Text(
            '${paneState.panes.length} 个面板',
            style: const TextStyle(color: AeroColors.textMuted, fontSize: 10),
          ),

          if (paneState.activeNoteId != null) ...[
            const SizedBox(width: 12),
            const Text(
              '·',
              style: TextStyle(color: AeroColors.textMuted, fontSize: 10),
            ),
            const SizedBox(width: 12),
            Text(
              paneState.panes[paneState.activeIndex].title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AeroColors.textSecondary,
                fontSize: 10,
              ),
            ),
          ],

          const Spacer(),

          // 插件状态
          Icon(Icons.extension, size: 12, color: AeroColors.accentCyan),
          const SizedBox(width: 4),
          Text(
            '${pluginState.activeCount} 插件',
            style: const TextStyle(color: AeroColors.textMuted, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

/// 演示用笔记数据
class _DemoNote implements NoteData {
  @override
  final String id;
  @override
  final String title;
  @override
  final List<String> tags;
  @override
  final List<String> backlinks;
  @override
  final List<String> outgoingLinks;
  @override
  final DateTime updatedAt;

  _DemoNote(this.id, this.title, this.tags, this.outgoingLinks)
    : backlinks = const [],
      updatedAt = DateTime.now();
}
