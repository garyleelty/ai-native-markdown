import 'package:intl/intl.dart';

// ──────────────────────────────────────────────
// 模板引擎 (Template Service)
// ──────────────────────────────────────────────
// 预置实用模板 + 变量替换 + 自定义模板管理
// 模板使用 {{variable}} 语法声明变量
// ──────────────────────────────────────────────

/// 模板变量定义，描述一个可替换的占位符
class TemplateVariable {
  /// 变量名，如 'date', 'title'
  final String name;

  /// 显示标签，用于 UI 提示
  final String label;

  /// 默认值（可为 null，表示必须由用户填写）
  final String? defaultValue;

  const TemplateVariable({
    required this.name,
    required this.label,
    this.defaultValue,
  });
}

/// 模板定义
class TemplateDef {
  /// 唯一标识符
  final String id;

  /// 显示名称
  final String name;

  /// 分类标签
  final String category;

  /// 图标名称（Material Icons codePoint，用于序列化）
  final int iconCodePoint;

  /// 模板原始内容（含 {{variable}} 占位符）
  final String content;

  /// 模板变量列表
  final List<TemplateVariable> variables;

  /// 简短描述
  final String description;

  /// 是否为用户自定义模板
  final bool isCustom;

  const TemplateDef({
    required this.id,
    required this.name,
    required this.category,
    required this.iconCodePoint,
    required this.content,
    this.variables = const [],
    this.description = '',
    this.isCustom = false,
  });

  /// 获取内容预览（前 N 行）
  String preview({int lines = 3}) {
    final allLines = content.split('\n');
    return allLines.take(lines).join('\n');
  }
}

/// 模板服务 — 管理预置模板和用户自定义模板
class TemplateService {
  TemplateService._();
  static final TemplateService instance = TemplateService._();

  /// 内置模板列表（惰性初始化）
  List<TemplateDef>? _builtinTemplates;

  /// 用户自定义模板列表（运行时维护，持久化由 Provider 层负责）
  final List<TemplateDef> _customTemplates = [];

  /// 获取所有模板（内置 + 自定义）
  List<TemplateDef> get allTemplates => [
    ...builtinTemplates,
    ..._customTemplates,
  ];

  /// 获取内置模板
  List<TemplateDef> get builtinTemplates {
    _builtinTemplates ??= _createBuiltinTemplates();
    return _builtinTemplates!;
  }

  /// 获取用户自定义模板
  List<TemplateDef> get customTemplates => List.unmodifiable(_customTemplates);

  /// 添加自定义模板
  void addCustomTemplate(TemplateDef template) {
    _customTemplates.add(template);
  }

  /// 移除自定义模板
  void removeCustomTemplate(String templateId) {
    _customTemplates.removeWhere((t) => t.id == templateId);
  }

  /// 根据 ID 查找模板
  TemplateDef? findById(String templateId) {
    try {
      return allTemplates.firstWhere((t) => t.id == templateId);
    } catch (_) {
      return null;
    }
  }

  /// 按分类获取模板
  List<TemplateDef> getByCategory(String category) {
    return allTemplates.where((t) => t.category == category).toList();
  }

  /// 获取所有分类列表
  List<String> get categories {
    return allTemplates.map((t) => t.category).toSet().toList();
  }

  /// 应用模板: 替换 {{variable}} 占位符
  ///
  /// [templateId] 模板 ID
  /// [variables] 变量值映射 { 'date': '2026-06-27', 'title': '我的笔记' }
  /// 返回替换后的完整 Markdown 内容
  String applyTemplate(String templateId, Map<String, String> variables) {
    final template = findById(templateId);
    if (template == null) return '';

    String result = template.content;

    // 合并默认值和用户提供的变量
    final mergedVars = <String, String>{};
    for (final v in template.variables) {
      mergedVars[v.name] = v.defaultValue ?? '';
    }
    mergedVars.addAll(variables);

    // 自动注入常用变量
    final now = DateTime.now();
    mergedVars.putIfAbsent('date', () => DateFormat('yyyy-MM-dd').format(now));
    mergedVars.putIfAbsent('time', () => DateFormat('HH:mm').format(now));
    mergedVars.putIfAbsent(
      'datetime',
      () => DateFormat('yyyy-MM-dd HH:mm').format(now),
    );
    mergedVars.putIfAbsent('weekday', () => _weekdayName(now.weekday));
    mergedVars.putIfAbsent('year', () => now.year.toString());
    mergedVars.putIfAbsent('month', () => now.month.toString().padLeft(2, '0'));
    mergedVars.putIfAbsent('day', () => now.day.toString().padLeft(2, '0'));

    // 执行 {{variable}} 替换
    mergedVars.forEach((key, value) {
      result = result.replaceAll('{{$key}}', value);
    });

    return result;
  }

  /// 从已有笔记内容创建自定义模板
  ///
  /// [name] 模板名称
  /// [category] 分类
  /// [content] 笔记原始内容
  TemplateDef createFromContent({
    required String name,
    required String category,
    required String content,
  }) {
    final id = 'custom_${DateTime.now().millisecondsSinceEpoch}';
    final template = TemplateDef(
      id: id,
      name: name,
      category: category,
      iconCodePoint: 0xe8b7, // Icons.custom_toggle 的 codePoint
      content: content,
      description: '用户自定义模板',
      isCustom: true,
    );
    addCustomTemplate(template);
    return template;
  }

  /// 获取中文星期名
  String _weekdayName(int weekday) {
    const names = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return weekday >= 1 && weekday <= 7 ? names[weekday] : '';
  }

  // ──────────────────────────────────────────────
  // 预置模板内容
  // ──────────────────────────────────────────────

  List<TemplateDef> _createBuiltinTemplates() {
    return [
      // ── 1. 日记模板 ──
      const TemplateDef(
        id: 'builtin.daily',
        name: '日记',
        category: '日记',
        iconCodePoint: 0xe878, // Icons.today
        description: '每日记录：时间线 + 心情 + 反思',
        variables: [
          TemplateVariable(name: 'date', label: '日期'),
          TemplateVariable(name: 'weekday', label: '星期'),
          TemplateVariable(name: 'mood', label: '今日心情', defaultValue: ''),
        ],
        content: '''# {{date}} {{weekday}}

> [[{{date}}|昨日]] | [[明天]]

## 今日心情

{{mood}}

## 时间线

### 上午
-

### 下午
-

### 晚间
-

## 今日收获

-

## 明日计划

-

## 随想

''',
      ),

      // ── 2. 会议记录模板 ──
      const TemplateDef(
        id: 'builtin.meeting',
        name: '会议记录',
        category: '工作',
        iconCodePoint: 0xe0af, // Icons.groups
        description: '会议记录：参会人 + 议题 + 行动项',
        variables: [
          TemplateVariable(name: 'title', label: '会议主题', defaultValue: '周会'),
          TemplateVariable(name: 'date', label: '日期'),
          TemplateVariable(name: 'time', label: '时间'),
          TemplateVariable(name: 'attendees', label: '参会人', defaultValue: ''),
        ],
        content: '''# 会议记录: {{title}}

| 项目 | 内容 |
|------|------|
| 日期 | {{date}} |
| 时间 | {{time}} |
| 参会人 | {{attendees}} |
| 地点 | |

## 议题

### 1.

### 2.

### 3.

## 讨论要点

-

## 决议事项

- [ ]

## 行动项

| 待办事项 | 负责人 | 截止日期 |
|----------|--------|----------|
|          |        |          |

## 下次会议

- 时间:
- 议题预告:
''',
      ),

      // ── 3. 读书笔记模板 ──
      const TemplateDef(
        id: 'builtin.reading',
        name: '读书笔记',
        category: '学习',
        iconCodePoint: 0xe02c, // Icons.book
        description: '读书笔记：书名 + 作者 + 核心观点 + 摘录',
        variables: [
          TemplateVariable(name: 'title', label: '书名', defaultValue: ''),
          TemplateVariable(name: 'author', label: '作者', defaultValue: ''),
          TemplateVariable(name: 'date', label: '日期'),
        ],
        content: '''# 《{{title}}》读书笔记

> **作者**: {{author}}
> **阅读日期**: {{date}}
> **评分**: /5
> **状态**: #reading

## 一句话总结

>

## 核心观点

### 观点一

### 观点二

### 观点三

## 精彩摘录

> ""

> ""

> ""

## 我的思考

-

## 行动启发

- [ ]

## 关联笔记

- [[]]
''',
      ),

      // ── 4. 项目周报模板 ──
      const TemplateDef(
        id: 'builtin.weekly',
        name: '项目周报',
        category: '工作',
        iconCodePoint: 0xe8f9, // Icons.assessment
        description: '项目周报：进展 / 风险 / 计划',
        variables: [
          TemplateVariable(name: 'project', label: '项目名称', defaultValue: ''),
          TemplateVariable(name: 'date', label: '日期'),
          TemplateVariable(name: 'week', label: '第几周', defaultValue: ''),
        ],
        content: '''# {{project}} 周报 — {{date}} (W{{week}})

## 本周进展

- [x]

## 遇到的问题 / 风险

| 问题 | 影响 | 当前状态 | 需要的支持 |
|------|------|----------|-----------|
|      |      |          |           |

## 下周计划

- [ ]

## 关键指标

| 指标 | 目标 | 实际 | 达成率 |
|------|------|------|--------|
|      |      |      |        |

## 备注

''',
      ),

      // ── 5. GTD 模板 ──
      const TemplateDef(
        id: 'builtin.gtd',
        name: 'GTD 清单',
        category: '效率',
        iconCodePoint: 0xe8e6, // Icons.checklist
        description: 'GTD 工作流：收件箱 / 下一步 / 等待 / 项目',
        variables: [TemplateVariable(name: 'date', label: '日期')],
        content: '''# GTD 清单 — {{date}}

## 收件箱 (Inbox)

> 尚未处理的事项，定期清空

- [ ]

## 下一步行动 (Next Actions)

### @电脑
- [ ]

### @电话
- [ ]

### @外出
- [ ]

### @办公室
- [ ]

## 等待中 (Waiting For)

| 事项 | 等待对象 | 跟进日期 |
|------|----------|----------|
|      |          |          |

## 项目 (Projects)

###
- 目标:
- 下一步:
- 截止:

## 日程 (Calendar)

### 今天
-

### 本周
-

## 定期回顾

- [ ] 每日: 清空收件箱
- [ ] 每周: 回顾所有项目
- [ ] 每月: 检视目标
''',
      ),

      // ── 6. Zettelkasten 卡片模板 ──
      const TemplateDef(
        id: 'builtin.zettelkasten',
        name: 'Zettelkasten 卡片',
        category: '学习',
        iconCodePoint: 0xe163, // Icons.style
        description: '原子化知识卡片：一个想法一张卡片',
        variables: [
          TemplateVariable(name: 'title', label: '卡片标题', defaultValue: ''),
          TemplateVariable(name: 'date', label: '日期'),
        ],
        content: '''# {{title}}

> **创建**: {{date}}
> **标签**: #zettelkasten
> **来源**: [[]]

## 核心想法

用自己的话简洁表达这一个想法:

## 原文引用

> ""

## 我的理解

## 与其他想法的关联

- [[]] —
- [[]] —

## 后续思考

- [ ]
''',
      ),

      // ── 7. 周回顾模板 ──
      const TemplateDef(
        id: 'builtin.weeklyReview',
        name: '周回顾',
        category: '日记',
        iconCodePoint: 0xe06c, // Icons.calendar_view_week
        description: '每周一次：回顾 + 反思 + 计划',
        variables: [
          TemplateVariable(name: 'weekStart', label: '本周开始日期'),
          TemplateVariable(name: 'weekEnd', label: '本周结束日期'),
        ],
        content: '''# 周回顾 — {{weekStart}} ~ {{weekEnd}}

## 本周总结

> 用 3 句话概括这一周

-

## 完成的事

- [x]

## 未完成的事

- [ ] 原因：

## 关键事件

| 日期 | 事件 | 反思 |
|------|------|------|
|      |      |      |

## 学到的

-

## 下周计划

### 工作

- [ ]

### 学习

- [ ]

### 生活

- [ ]

## 自我评分

| 维度 | 评分 (1-10) | 说明 |
|------|-------------|------|
| 工作 |             |      |
| 健康 |             |      |
| 学习 |             |      |
| 人际 |             |      |
''',
      ),

      // ── 8. 月回顾模板 ──
      const TemplateDef(
        id: 'builtin.monthlyReview',
        name: '月回顾',
        category: '日记',
        iconCodePoint: 0xe06b, // Icons.calendar_view_month
        description: '每月一次：目标检视 + 复盘 + 调整',
        variables: [
          TemplateVariable(name: 'month', label: '月份'),
        ],
        content: '''# 月回顾 — {{month}}

## 本月目标回顾

> 月初制定的目标完成情况

| 目标 | 完成度 | 状态 | 备注 |
|------|--------|------|------|
|      |        |      |      |

## 关键成就

-

## 关键问题

> 本月遇到的最大挑战与应对

-

## 习惯养成

| 习惯 | 完成天数 | 完成率 | 评估 |
|------|----------|--------|------|
|      |          |        |      |

## 财务

- 收入：
- 支出：
- 储蓄率：

## 阅读

| 书名 | 完成度 | 评分 | 笔记 |
|------|--------|------|------|
|      |        |      | [[]] |

## 下月目标

### 工作

- [ ]

### 个人

- [ ]

## 月度感悟

>

## 关联

- [[本月日记]]
''',
      ),
    ];
  }
}
