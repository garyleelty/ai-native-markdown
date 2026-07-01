/// 测试辅助工具
/// 提供测试中常用的数据构建和 Provider override 辅助函数

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/core/models/note_model.dart';
import 'package:aeromind/core/models/predictive_link.dart';
import 'package:aeromind/core/plugin/plugin_manifest.dart';
import 'package:aeromind/core/plugin/base_plugin.dart';
import 'package:aeromind/core/plugin/plugin_api.dart';
import 'package:aeromind/core/plugin/plugin_storage.dart';

/// 创建测试用 NoteModel
NoteModel createTestNote({
  String id = 'test-id-1',
  String title = '测试笔记',
  String content = '# 测试笔记\n\n这是测试内容',
  String filePath = '/test/path.md',
  List<String> tags = const [],
  List<String> backlinks = const [],
  List<String> outgoingLinks = const [],
  List<EntityHighlight> entities = const [],
}) {
  return NoteModel(
    id: id,
    title: title,
    rawMarkdown: content,
    filePath: filePath,
    createdAt: DateTime(2024, 1, 1),
    updatedAt: DateTime(2024, 6, 1),
    tags: tags,
    backlinks: backlinks,
    outgoingLinks: outgoingLinks,
    entities: entities,
  );
}

/// 创建测试用 Widget 包裹器 (带 ProviderScope)
Widget createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: Scaffold(body: child),
    ),
  );
}

/// 创建测试用 PluginManifest
PluginManifest createTestManifest({
  String id = 'com.test.example',
  String name = '测试插件',
  String version = '1.0.0',
}) {
  return PluginManifest(
    id: id,
    name: name,
    version: version,
    description: '用于测试的示例插件',
  );
}
