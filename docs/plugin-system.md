# 插件系统

## 架构

```
BasePlugin（抽象基类）
    ├── PluginManifest    清单描述（id/name/version/settings/extensionTypes）
    ├── PluginApi         宿主 API 接口（受控沙箱）
    ├── PluginStorage     每插件隔离的 KV 存储（Hive box `plugin_<id>`）
    └── PluginRegistry    生命周期管理（单例）
```

## 生命周期

```
registered → initializing → active ⇄ paused → disposed
                                 ↑         │
                                 └─────────┘ (resume)
```

- 状态持久化到 Hive box `plugin_states`。
- 非内置插件支持卸载（`disposePlugin`）。
- 事件：`registered / activated / paused / resumed / disposed / error`。

## 扩展点类型（10 种）

| ExtensionType | 说明 | 钩子方法 |
|---|---|---|
| `command` | 命令面板操作 | `getCommands()` |
| `entityRecognizer` | 自定义实体识别 | `recognizeEntities(markdown)` |
| `contentProcessor` | 保存前处理 | `processContent(markdown, noteId)` |
| `searchEnhancer` | 搜索结果增强 | `enhanceSearchResults(results, query)` |
| `sidebarPanel` | 侧边栏自定义面板 | — |
| `statusBarItem` | 状态栏信息显示 | — |
| `exporter` | 自定义导出格式 | — |
| `importer` | 自定义导入格式 | — |
| `aiProvider` | 自定义 AI 后端 | — |
| `themeExtension` | 主题扩展 | — |

## PluginApi 能力

插件通过 `PluginApi` 访问宿主服务（受控沙箱，实现见 `core/services/plugin_api_impl.dart`）：

- **笔记 CRUD**：`getNote` / `getAllNotes` / `saveNote` / `searchNotes`
- **状态查询**：`activeNoteId` / `openNoteIds`
- **命令注册**：`registerCommand` / `unregisterCommand`
- **UI 反馈**：`showStatusMessage` / `showNotification`
- **隔离存储**：`getStorage(pluginId)`
- **事件监听**：`onNoteOpened` / `onNoteSaved` / `onEntitiesRecognized` / `onPaneStackChanged`（均含 off）
- **AI 能力**：`aiContextPrompt`（getter）/ `recognizeEntities(markdown)`

## 内置插件（5 个）

| 插件 | ID | 扩展点 | 设置 |
|---|---|---|---|
| 字数统计 | `com.aeromind.wordcount` | command, statusBarItem | includeCodeBlocks, minThreshold |
| Markdown 增强 | `com.aeromind.markdown-enhance` | contentProcessor | — |
| 多格式导出 | `com.aeromind.export` | command, exporter | default_format |
| Mermaid 渲染 | `builtin.mermaid-render` | contentProcessor, command | privacy_acknowledged, render_enabled |
| AI 对话 | `com.aeromind.ai-chat` | command | llm_endpoint, llm_api_key, llm_model |

> 注意：AI 对话的 LLM 配置存储在插件自己的 box（`plugin_com.aeromind.ai-chat`），与设置页 AI 区的全局 LLM 配置相互独立。

## 开发一个插件

参考 `lib/examples/hello_plugin.dart`：

```dart
class MyPlugin extends BasePlugin {
  @override
  PluginManifest get manifest => PluginManifest(
    id: 'com.example.my-plugin',
    name: '我的插件',
    version: '1.0.0',
    description: '描述',
    extensionTypes: ['command', 'contentProcessor'],
  );

  @override
  Future<void> onActivate(PluginContext ctx) async {
    ctx.api.onNoteOpened((noteId) { /* ... */ });
  }

  @override
  List<PluginCommand> getCommands() => [/* ... */];

  @override
  Future<String?> processContent(String markdown, String noteId) async {
    return null; // 不修改则返回 null
  }
}
```

## 插件聚合

`PluginRegistry` 提供三类聚合（供宿主调用）：

- `aggregateEntities` — 汇总所有 `entityRecognizer` 插件的结果
- `aggregateContentProcessors` — 链式处理保存前内容
- `aggregateSearchEnhancers` — 增强搜索结果

每个插件的异常被隔离，单个插件失败不影响其它插件。