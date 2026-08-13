# 快捷键与命令

## 全局快捷键（`app.dart` HardwareKeyboard 处理器）

不依赖焦点层级，全局生效。

| 快捷键 | 功能 |
|---|---|
| `Cmd/Ctrl + K` | 命令面板 |
| `Cmd/Ctrl + T` | 模板画廊 |
| `Cmd/Ctrl + D` | 打开今天的日记 |
| `Cmd/Ctrl + B` | 切换侧边栏 |
| `Cmd/Ctrl + O` | Quick Switcher |
| `Cmd/Ctrl + Option/Alt + P` | 插件管理（刻意避开 `Cmd+Shift+P` 与 VS Code 冲突） |
| `?` | 快捷键速查表 |
| `Cmd/Ctrl + .` | 切换 AI 面板 |
| `Escape` | 关闭最上层覆盖层 |

## 编辑器内快捷键

通过 `Shortcuts`/`Intent` 处理（`note_panel.dart`）：

- `Cmd/Ctrl + B` 加粗、`Cmd/Ctrl + I` 斜体
- `Cmd/Ctrl + Shift + K` 插入链接
- `Cmd/Ctrl + Z` / `Cmd/Ctrl + Y` 撤销 / 重做
- `Cmd/Ctrl + F` 查找、`Enter` / `Shift+Enter` 下一个 / 上一个
- `Esc` 关闭搜索
- 双击标题编辑标题

## 命令面板（~60 条内置命令）

按 `CommandCategory { note, nav, editor, ai, view, settings, plugin }` 分组：

- **笔记**：新建 (`Ctrl+N`)、打开 (`Ctrl+O`)、打开文件、导入文件、导出、重命名、删除、复制、今天的日记 (`Ctrl+D`)、日记、版本历史、导出全部、回收站、导入导出
- **导航**：搜索 (`Ctrl+Shift+F`)、Quick Switcher
- **编辑器**：查找 (`Ctrl+F`)、替换 (`Ctrl+H`)、撤销、重做、加粗、斜体、标题 1-3、列表/任务列表/引用/代码/链接 (`Ctrl+K`)/wiki 链接/图片/分隔线
- **视图**：切换主题 (`Ctrl+Shift+T`)、知识图谱、切换编辑模式 (`Ctrl+Shift+M`)、侧边栏 (`Ctrl+B`)、大纲、反向链接、标签、任务
- **模板**：插入模板 (`Ctrl+T`)
- **面板**：关闭面板 (`Ctrl+W`)、关闭全部
- **设置**：打开设置 (`Ctrl+,`)、插件 (`Ctrl+Alt+P`)、Git 备份/恢复/设置、快捷键速查 (`?`)、欢迎页
- **AI**：摘要、翻译、续写、识别实体

### 架构

`CommandRegistry`（`features/command_palette/services/command_registry.dart`）注册 `CommandDef`（action 为空），`app.dart` 的 `_initCommandActions()` 通过 `commandPaletteProvider.notifier.bindActions({...})` 注入实际回调，实现命令定义与 Widget 层解耦。最近使用记录最多 10 条。