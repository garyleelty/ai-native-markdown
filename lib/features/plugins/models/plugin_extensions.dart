/// ══════════════════════════════════════════════════
/// PluginExtensions — 插件扩展点类型定义
/// ══════════════════════════════════════════════════
/// 定义 AeroMind 所有扩展点的类型枚举和相关数据结构。
/// 插件通过声明 extensionTypes 来表明它实现了哪些扩展点。
/// ──────────────────────────────────────────────────

library;

import 'package:flutter/material.dart';

/// 扩展点类型枚举
enum ExtensionType {
  /// 命令: 注册到命令面板的操作
  command,

  /// 实体识别器: 自定义实体类型和识别逻辑
  entityRecognizer,

  /// 内容处理器: 笔记保存前的后处理管道
  contentProcessor,

  /// 搜索增强: 扩展或修改搜索结果
  searchEnhancer,

  /// 侧边栏面板: 在侧边栏中添加自定义面板
  sidebarPanel,

  /// 状态栏项: 在状态栏显示插件信息
  statusBarItem,

  /// 导出器: 自定义导出格式
  exporter,

  /// 导入器: 自定义导入格式
  importer,

  /// AI 提供者: 自定义 AI 后端 (LLM API)
  aiProvider,

  /// 主题扩展: 自定义颜色、字体等
  themeExtension,
}

/// 扩展点描述 (用于 UI 展示)
class ExtensionTypeDescriptor {
  final ExtensionType type;
  final String name;
  final String description;
  final IconData icon;

  const ExtensionTypeDescriptor({
    required this.type,
    required this.name,
    required this.description,
    required this.icon,
  });
}

/// 扩展点注册表 — 提供人类可读的描述
class ExtensionTypeRegistry {
  ExtensionTypeRegistry._();

  static const Map<ExtensionType, ExtensionTypeDescriptor> _descriptors = {
    ExtensionType.command: ExtensionTypeDescriptor(
      type: ExtensionType.command,
      name: '命令',
      description: '在命令面板中注册自定义操作',
      icon: Icons.terminal,
    ),
    ExtensionType.entityRecognizer: ExtensionTypeDescriptor(
      type: ExtensionType.entityRecognizer,
      name: '实体识别',
      description: '自定义实体类型识别规则',
      icon: Icons.auto_fix_high,
    ),
    ExtensionType.contentProcessor: ExtensionTypeDescriptor(
      type: ExtensionType.contentProcessor,
      name: '内容处理',
      description: '笔记保存前自动处理内容',
      icon: Icons.transform,
    ),
    ExtensionType.searchEnhancer: ExtensionTypeDescriptor(
      type: ExtensionType.searchEnhancer,
      name: '搜索增强',
      description: '扩展搜索结果',
      icon: Icons.manage_search,
    ),
    ExtensionType.sidebarPanel: ExtensionTypeDescriptor(
      type: ExtensionType.sidebarPanel,
      name: '侧边栏面板',
      description: '在侧边栏中添加自定义面板',
      icon: Icons.web_asset,
    ),
    ExtensionType.statusBarItem: ExtensionTypeDescriptor(
      type: ExtensionType.statusBarItem,
      name: '状态栏',
      description: '在状态栏显示插件信息',
      icon: Icons.info_outline,
    ),
    ExtensionType.exporter: ExtensionTypeDescriptor(
      type: ExtensionType.exporter,
      name: '导出',
      description: '自定义笔记导出格式',
      icon: Icons.file_upload_outlined,
    ),
    ExtensionType.importer: ExtensionTypeDescriptor(
      type: ExtensionType.importer,
      name: '导入',
      description: '自定义笔记导入格式',
      icon: Icons.file_download_outlined,
    ),
    ExtensionType.aiProvider: ExtensionTypeDescriptor(
      type: ExtensionType.aiProvider,
      name: 'AI 后端',
      description: '自定义 LLM API 提供者',
      icon: Icons.psychology,
    ),
    ExtensionType.themeExtension: ExtensionTypeDescriptor(
      type: ExtensionType.themeExtension,
      name: '主题',
      description: '自定义主题颜色和样式',
      icon: Icons.palette,
    ),
  };

  /// 获取扩展点描述
  static ExtensionTypeDescriptor? getDescriptor(ExtensionType type) {
    return _descriptors[type];
  }

  /// 获取所有扩展点描述
  static List<ExtensionTypeDescriptor> get all =>
      _descriptors.values.toList();

  /// 根据字符串名获取类型
  static ExtensionType? fromString(String name) {
    for (final type in ExtensionType.values) {
      if (type.name == name) return type;
    }
    return null;
  }
}
