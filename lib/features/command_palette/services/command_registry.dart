import 'package:flutter/material.dart';

// ──────────────────────────────────────────────
// 命令注册中心 (Command Registry)
// ──────────────────────────────────────────────
// 类似 VS Code / Obsidian 的命令面板后端
// 负责: 命令定义、注册、注销、搜索、最近使用记录
// ──────────────────────────────────────────────

/// 命令分类枚举，用于分组和过滤
enum CommandCategory {
  note,     // 笔记操作
  nav,      // 导航
  editor,   // 编辑器
  ai,       // AI 功能
  view,     // 视图切换
  settings, // 设置
  plugin,   // 插件命令
}

/// 单条命令的定义
class CommandDef {
  /// 唯一标识符，如 'note.new', 'ai.summarize'
  final String id;

  /// 显示名称，如 '新建笔记'
  final String name;

  /// Material Icons 图标
  final IconData icon;

  /// 快捷键提示文本，如 'Ctrl+N' / 'Cmd+K'
  final String? shortcut;

  /// 命令分类
  final CommandCategory category;

  /// 执行命令的回调（惰性绑定，由 Provider 层注入实际动作）
  VoidCallback? action;

  /// 可选的副标题/描述，用于搜索匹配
  final String? description;

  CommandDef({
    required this.id,
    required this.name,
    required this.icon,
    this.shortcut,
    required this.category,
    this.action,
    this.description,
  });
}

/// 命令注册中心 — 单例模式
///
/// 所有内置命令在 [_registerBuiltinCommands] 中预注册。
/// 外部模块可通过 [register] 动态追加命令。
class CommandRegistry {
  // 私有构造函数 (单例)
  CommandRegistry._();
  static final CommandRegistry instance = CommandRegistry._();

  /// 已注册命令表 (id → CommandDef)
  final Map<String, CommandDef> _commands = {};

  /// 最近使用的命令 ID 列表 (最多保留 10 条)
  final List<String> _recentIds = [];

  /// 最大最近使用记录数
  static const int _maxRecent = 10;

  /// 是否已初始化内置命令
  bool _initialized = false;

  // ──────────────────────────────────────────────
  // 公开 API
  // ──────────────────────────────────────────────

  /// 注册一条命令。如果已存在同 id 命令则覆盖。
  void register(CommandDef command) {
    _commands[command.id] = command;
  }

  /// 注销一条命令
  void unregister(String id) {
    _commands.remove(id);
  }

  /// 获取所有已注册命令
  List<CommandDef> get allCommands => _commands.values.toList();

  /// 根据 ID 获取命令定义
  CommandDef? getCommand(String id) => _commands[id];

  /// 绑定指定命令的 action 回调
  void bindAction(String commandId, VoidCallback action) {
    final cmd = _commands[commandId];
    if (cmd != null) {
      cmd.action = action;
    }
  }

  /// 批量绑定命令 actions
  void bindActions(Map<String, VoidCallback> actions) {
    actions.forEach(bindAction);
  }

  /// 模糊搜索命令列表
  ///
  /// 搜索逻辑:
  ///   1. 按名称包含关键字 (不区分大小写)
  ///   2. 按描述包含关键字
  ///   3. 按分类名称匹配
  /// 结果排序: 最近使用 → 名称匹配度
  List<CommandDef> search(String query) {
    if (query.trim().isEmpty) {
      // 无查询时返回「最近使用 + 其余命令」
      return _sortByRecent(_commands.values.toList());
    }

    final lowerQuery = query.toLowerCase();
    final matches = _commands.values.where((cmd) {
      return cmd.name.toLowerCase().contains(lowerQuery) ||
          (cmd.description?.toLowerCase().contains(lowerQuery) ?? false) ||
          cmd.category.name.toLowerCase().contains(lowerQuery);
    }).toList();

    return _sortByRecent(matches);
  }

  /// 记录一条命令被使用（更新最近使用列表）
  void recordUsage(String commandId) {
    _recentIds.remove(commandId); // 去重
    _recentIds.insert(0, commandId); // 置顶
    if (_recentIds.length > _maxRecent) {
      _recentIds.removeRange(_maxRecent, _recentIds.length);
    }
  }

  /// 获取最近使用的命令列表
  List<CommandDef> get recentCommands {
    return _recentIds
        .where((id) => _commands.containsKey(id))
        .map((id) => _commands[id]!)
        .toList();
  }

  /// 初始化内置命令（幂等，多次调用只执行一次）
  void ensureInitialized() {
    if (_initialized) return;
    _initialized = true;
    _registerBuiltinCommands();
  }

  // ──────────────────────────────────────────────
  // 内部方法
  // ──────────────────────────────────────────────

  /// 按最近使用排序: 命中最近使用的排前面，其余保持原序
  List<CommandDef> _sortByRecent(List<CommandDef> commands) {
    final recentSet = _recentIds.toSet();
    final recent = <CommandDef>[];
    final others = <CommandDef>[];

    for (final cmd in commands) {
      if (recentSet.contains(cmd.id)) {
        recent.add(cmd);
      } else {
        others.add(cmd);
      }
    }

    // recent 按 _recentIds 顺序排序
    recent.sort((a, b) =>
        _recentIds.indexOf(a.id).compareTo(_recentIds.indexOf(b.id)));

    return [...recent, ...others];
  }

  /// 预注册所有内置命令
  ///
  /// 注意: action 字段此时为 null，由 Provider 层在绑定阶段注入实际回调。
  /// 这样做是为了避免 CommandRegistry 直接依赖 Flutter Widget 层。
  void _registerBuiltinCommands() {
    final builtins = <CommandDef>[
      // ── 笔记操作 ──
      CommandDef(
        id: 'note.new',
        name: '新建笔记',
        icon: Icons.note_add_outlined,
        shortcut: 'Ctrl+N',
        category: CommandCategory.note,
        description: '创建一篇空白笔记',
      ),
      CommandDef(
        id: 'note.open',
        name: '打开笔记',
        icon: Icons.folder_open,
        shortcut: 'Ctrl+O',
        category: CommandCategory.note,
        description: '搜索并打开已有笔记',
      ),
      CommandDef(
        id: 'note.openFile',
        name: '打开本地文件',
        icon: Icons.file_open_outlined,
        category: CommandCategory.note,
        description: '直接打开本地 .md 文件 (不导入)',
      ),
      CommandDef(
        id: 'note.importFile',
        name: '导入本地文件',
        icon: Icons.note_add_outlined,
        category: CommandCategory.note,
        description: '导入本地 .md 文件到笔记库',
      ),
      CommandDef(
        id: 'note.export',
        name: '导出笔记',
        icon: Icons.file_download_outlined,
        category: CommandCategory.note,
        description: '将当前笔记导出为其他格式',
      ),
      CommandDef(
        id: 'note.search',
        name: '全局搜索',
        icon: Icons.search,
        shortcut: 'Ctrl+Shift+F',
        category: CommandCategory.nav,
        description: '在所有笔记中搜索内容',
      ),
      // Quick Switcher：模糊跳转面板入口（与 note.open 共用 Ctrl+O）
      CommandDef(
        id: 'nav.quickSwitcher',
        name: '快速跳转',
        icon: Icons.flash_on,
        shortcut: null, // 不显示 shortcut（note.open 已声明 Ctrl+O，避免重复）
        category: CommandCategory.nav,
        description: '模糊搜索并打开笔记 (Ctrl+O)',
      ),
      CommandDef(
        id: 'note.rename',
        name: '重命名笔记',
        icon: Icons.edit,
        category: CommandCategory.note,
        description: '重命名当前打开的笔记',
      ),
      CommandDef(
        id: 'note.delete',
        name: '删除笔记',
        icon: Icons.delete_outline,
        category: CommandCategory.note,
        description: '删除当前打开的笔记',
      ),
      CommandDef(
        id: 'note.duplicate',
        name: '复制笔记',
        icon: Icons.copy,
        category: CommandCategory.note,
        description: '创建当前笔记的副本',
      ),
      CommandDef(
        id: 'note.today',
        name: '今天的日记',
        icon: Icons.today,
        shortcut: 'Ctrl+D',
        category: CommandCategory.note,
        description: '打开或创建今天的日记',
      ),

      // ── 编辑器操作 ──
      CommandDef(
        id: 'editor.find',
        name: '查找',
        icon: Icons.search,
        shortcut: 'Ctrl+F',
        category: CommandCategory.editor,
        description: '在当前笔记中查找文字',
      ),
      CommandDef(
        id: 'editor.replace',
        name: '查找替换',
        icon: Icons.find_replace,
        shortcut: 'Ctrl+H',
        category: CommandCategory.editor,
        description: '在当前笔记中查找并替换文字',
      ),
      CommandDef(
        id: 'editor.undo',
        name: '撤销',
        icon: Icons.undo,
        shortcut: 'Ctrl+Z',
        category: CommandCategory.editor,
        description: '撤销上一步操作',
      ),
      CommandDef(
        id: 'editor.redo',
        name: '重做',
        icon: Icons.redo,
        shortcut: 'Ctrl+Y',
        category: CommandCategory.editor,
        description: '重做已撤销的操作',
      ),
      CommandDef(
        id: 'editor.bold',
        name: '粗体',
        icon: Icons.format_bold,
        shortcut: 'Ctrl+B',
        category: CommandCategory.editor,
        description: '将选中文字设为粗体',
      ),
      CommandDef(
        id: 'editor.italic',
        name: '斜体',
        icon: Icons.format_italic,
        shortcut: 'Ctrl+I',
        category: CommandCategory.editor,
        description: '将选中文字设为斜体',
      ),
      CommandDef(
        id: 'editor.heading1',
        name: '标题 1',
        icon: Icons.looks_one,
        category: CommandCategory.editor,
        description: '将当前行设为一级标题',
      ),
      CommandDef(
        id: 'editor.heading2',
        name: '标题 2',
        icon: Icons.looks_two,
        category: CommandCategory.editor,
        description: '将当前行设为二级标题',
      ),
      CommandDef(
        id: 'editor.heading3',
        name: '标题 3',
        icon: Icons.looks_3,
        category: CommandCategory.editor,
        description: '将当前行设为三级标题',
      ),
      CommandDef(
        id: 'editor.bulletList',
        name: '无序列表',
        icon: Icons.format_list_bulleted,
        category: CommandCategory.editor,
        description: '将当前行转为无序列表项',
      ),
      CommandDef(
        id: 'editor.numberedList',
        name: '有序列表',
        icon: Icons.format_list_numbered,
        category: CommandCategory.editor,
        description: '将当前行转为有序列表项',
      ),
      CommandDef(
        id: 'editor.taskList',
        name: '任务列表',
        icon: Icons.check_box,
        category: CommandCategory.editor,
        description: '将当前行转为任务列表项',
      ),
      CommandDef(
        id: 'editor.quote',
        name: '引用',
        icon: Icons.format_quote,
        category: CommandCategory.editor,
        description: '将当前行转为引用块',
      ),
      CommandDef(
        id: 'editor.code',
        name: '行内代码',
        icon: Icons.code,
        category: CommandCategory.editor,
        description: '将选中文字设为行内代码',
      ),
      CommandDef(
        id: 'editor.link',
        name: '插入链接',
        icon: Icons.link,
        shortcut: 'Ctrl+K',
        category: CommandCategory.editor,
        description: '在光标处插入链接',
      ),
      CommandDef(
        id: 'editor.wikiLink',
        name: '插入双向链接',
        icon: Icons.insert_link,
        category: CommandCategory.editor,
        description: '在光标处插入双向链接 [[ ]]',
      ),
      CommandDef(
        id: 'editor.image',
        name: '插入图片',
        icon: Icons.image,
        category: CommandCategory.editor,
        description: '在光标处插入图片标记',
      ),
      CommandDef(
        id: 'editor.horizontalRule',
        name: '分割线',
        icon: Icons.horizontal_rule,
        category: CommandCategory.editor,
        description: '在光标处插入水平分割线',
      ),

      // ── 视图切换 ──
      CommandDef(
        id: 'view.toggleTheme',
        name: '切换主题',
        icon: Icons.brightness_6,
        shortcut: 'Ctrl+Shift+T',
        category: CommandCategory.view,
        description: '在暗色和亮色主题之间切换',
      ),
      CommandDef(
        id: 'view.knowledgeGraph',
        name: '打开知识图谱',
        icon: Icons.account_tree_outlined,
        category: CommandCategory.view,
        description: '查看笔记之间的关联关系图',
      ),
      CommandDef(
        id: 'view.toggleEditMode',
        name: '切换编辑/阅读模式',
        icon: Icons.edit_note,
        shortcut: 'Ctrl+Shift+M',
        category: CommandCategory.editor,
        description: '在编辑模式和阅读预览模式之间切换',
      ),
      CommandDef(
        id: 'view.toggleSidebar',
        name: '切换侧边栏',
        icon: Icons.menu,
        shortcut: 'Ctrl+B',
        category: CommandCategory.view,
        description: '显示或隐藏侧边栏',
      ),
      CommandDef(
        id: 'view.outline',
        name: '显示大纲',
        icon: Icons.list_alt,
        category: CommandCategory.view,
        description: '在侧边栏显示当前笔记大纲',
      ),
      CommandDef(
        id: 'view.backlinks',
        name: '显示反向链接',
        icon: Icons.arrow_back,
        category: CommandCategory.view,
        description: '在侧边栏显示当前笔记的反向链接',
      ),
      CommandDef(
        id: 'view.tags',
        name: '显示标签',
        icon: Icons.label_outline,
        category: CommandCategory.view,
        description: '在侧边栏显示标签列表',
      ),
      CommandDef(
        id: 'view.tasks',
        name: '显示任务',
        icon: Icons.check_box_outlined,
        category: CommandCategory.view,
        description: '在侧边栏显示所有任务',
      ),

      // ── 模板 ──
      CommandDef(
        id: 'template.insert',
        name: '插入模板',
        icon: Icons.dashboard_customize_outlined,
        shortcut: 'Ctrl+T',
        category: CommandCategory.note,
        description: '从模板画廊选择模板插入',
      ),

      // ── 日记 ──
      CommandDef(
        id: 'note.daily',
        name: '创建日记',
        icon: Icons.calendar_today,
        shortcut: 'Ctrl+D',
        category: CommandCategory.note,
        description: '打开或创建今天的日记',
      ),

      // ── 面板操作 ──
      CommandDef(
        id: 'pane.close',
        name: '关闭当前面板',
        icon: Icons.close,
        shortcut: 'Ctrl+W',
        category: CommandCategory.editor,
        description: '关闭当前活跃的笔记面板',
      ),
      CommandDef(
        id: 'pane.closeAll',
        name: '关闭所有面板',
        icon: Icons.close_fullscreen,
        category: CommandCategory.editor,
        description: '关闭所有打开的笔记面板',
      ),

      // ── 设置 ──
      CommandDef(
        id: 'settings.open',
        name: '打开设置',
        icon: Icons.settings_outlined,
        shortcut: 'Ctrl+,',
        category: CommandCategory.settings,
        description: '打开应用设置页面',
      ),
      CommandDef(
        id: 'settings.plugins',
        name: '插件管理',
        icon: Icons.extension_outlined,
        shortcut: 'Ctrl+Shift+P',
        category: CommandCategory.settings,
        description: '打开插件管理面板',
      ),
      CommandDef(
        id: 'git.backup',
        name: 'Git: 立即备份',
        icon: Icons.cloud_upload_outlined,
        category: CommandCategory.settings,
        description: '将笔记提交并推送到远程 Git 仓库',
      ),
      CommandDef(
        id: 'git.restore',
        name: 'Git: 从远程恢复',
        icon: Icons.cloud_download_outlined,
        category: CommandCategory.settings,
        description: '从远程 Git 仓库拉取最新笔记',
      ),
      CommandDef(
        id: 'git.settings',
        name: 'Git: 备份设置',
        icon: Icons.settings_outlined,
        category: CommandCategory.settings,
        description: '配置 Git 远程备份',
      ),

      // ── AI 功能 ──
      CommandDef(
        id: 'ai.summarize',
        name: 'AI: 摘要当前笔记',
        icon: Icons.auto_awesome,
        category: CommandCategory.ai,
        description: '使用 AI 生成当前笔记的摘要',
      ),
      CommandDef(
        id: 'ai.translate',
        name: 'AI: 翻译当前笔记',
        icon: Icons.translate,
        category: CommandCategory.ai,
        description: '使用 AI 翻译当前笔记内容',
      ),
      CommandDef(
        id: 'ai.continueWriting',
        name: 'AI: 续写当前段落',
        icon: Icons.edit_outlined,
        category: CommandCategory.ai,
        description: '使用 AI 续写当前光标所在段落',
      ),
      CommandDef(
        id: 'ai.recognizeEntities',
        name: 'AI: 识别实体',
        icon: Icons.smart_toy_outlined,
        category: CommandCategory.ai,
        description: '手动触发一次实体识别',
      ),
      CommandDef(
        id: 'note.versionHistory',
        name: '版本历史',
        icon: Icons.history,
        category: CommandCategory.note,
        description: '查看当前笔记的版本历史',
      ),
      CommandDef(
        id: 'note.exportAll',
        name: '导出全部笔记',
        icon: Icons.archive_outlined,
        category: CommandCategory.note,
        description: '将所有笔记导出为 JSON 文件',
      ),
      CommandDef(
        id: 'note.openTrash',
        name: '回收站',
        icon: Icons.delete_outline,
        category: CommandCategory.note,
        description: '查看和管理回收站',
      ),
      CommandDef(
        id: 'note.importExport',
        name: '导入 / 导出',
        icon: Icons.import_export,
        category: CommandCategory.note,
        description: '导出当前/全部笔记或从 JSON 导入',
      ),

      // ── 帮助 ──
      CommandDef(
        id: 'help.shortcuts',
        name: '快捷键速查表',
        icon: Icons.keyboard_outlined,
        shortcut: '?',
        category: CommandCategory.settings,
        description: '查看所有快捷键',
      ),
      CommandDef(
        id: 'help.welcome',
        name: '欢迎页面',
        icon: Icons.waving_hand_outlined,
        category: CommandCategory.settings,
        description: '查看应用介绍与欢迎页',
      ),
    ];

    for (final cmd in builtins) {
      register(cmd);
    }
  }
}
