# AeroMind 生产级修复 v1 - Implementation Plan

## 任务依赖图
```
Task 1 (环境验证) ──┐
Task 2 (全局错误处理) ──┼── Task 6 (Overlay统一管理) ──┐
Task 3 (Hive/数据层) ──┤                              ├── Task 11 (综合验证)
Task 4 (编辑器保存) ────┤                              │
Task 5 (插件系统) ──────┼── Task 7 (Git备份) ──────────┤
                       ├── Task 8 (实体识别) ──────────┤
                       ├── Task 9 (搜索/UI错误处理) ───┤
                       └── Task 10 (操作错误处理) ─────┘
```

---

## [x] Task 1: 项目环境验证与基线确认
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 确认 `flutter test` 全部通过
  - 确认 `dart analyze lib/` 基线 issue 数量
  - 确认 macOS Debug 构建成功
  - 检查 uuid 包是否已在 pubspec.yaml 中
  - 检查 path 包是否可用
- **Acceptance Criteria Addressed**: NFR-1, NFR-2, NFR-3
- **Test Requirements**:
  - `programmatic` TR-1.1: `flutter test` 全部通过（89 tests）
  - `programmatic` TR-1.2: `dart analyze lib/` 记录基线
  - `programmatic` TR-1.3: `flutter build macos --debug` 成功

---

## [x] Task 2: 全局错误处理体系
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 在 `main.dart` 中设置 `FlutterError.onError` 和 `PlatformDispatcher.instance.onError`
  - Hive 初始化失败时显示错误页面而非继续运行
  - 创建统一的错误提示工具方法（`showErrorSnackBar`）
  - 将项目中所有空 `catch (_) {}` 替换为带 `debugPrint` 的处理
  - main.dart 中 Hive 初始化失败时不调用 runApp，显示错误 widget
- **Acceptance Criteria Addressed**: FR-1, FR-11, AC-2, AC-10
- **Test Requirements**:
  - `programmatic` TR-2.1: Hive 初始化路径不存在时不崩溃，显示错误
  - `human-judgment` TR-2.2: 全局错误捕获后不白屏，有错误提示
  - `programmatic` TR-2.3: 无空 catch 块（grep 验证）
- **Notes**: 关键文件：`lib/main.dart`

---

## [x] Task 3: 数据层修复（ID/缓存/路径/文件）
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 笔记 ID 改用 `Uuid().v4()` 替代 `DateTime.now().millisecondsSinceEpoch`
  - `NoteRepository.saveNote()` 自动设置 `updatedAt: DateTime.now()`
  - `saveNote()` 后 invalidate `allNotesProvider`
  - FileService 使用 `p.join()` 拼接路径（跨平台）
  - FileService JSON 转义补全（\t、\r、控制字符）
  - `syncToFile` 失败时 debugPrint 记录
  - 移除 `Hive.init('.')` 危险降级
  - Hive box 打开失败时正确清理资源
  - 应用退出时（app.dart dispose）调用 `HiveService.closeHive()`
  - FileService.generateId 使用 uuid 替代 hashCode
  - trash_service.dart 修复无效 ID 返回 DateTime.now() 的问题
- **Acceptance Criteria Addressed**: FR-3, FR-4, AC-7
- **Test Requirements**:
  - `programmatic` TR-3.1: 连续创建 100 篇笔记 ID 不重复
  - `programmatic` TR-3.2: saveNote 后 allNotesProvider 自动刷新
  - `programmatic` TR-3.3: saveNote 自动更新 updatedAt
  - `programmatic` TR-3.4: 路径拼接使用 p.join
- **Notes**: 关键文件：`lib/providers/note_provider.dart`、`lib/core/services/file_service.dart`、`lib/core/services/hive_service.dart`、`lib/core/services/trash_service.dart`

---

## [x] Task 4: 编辑器保存可靠性修复
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - `_doSave` 添加 try-catch，失败时显示 SnackBar 错误提示
  - `_autoSave` Timer 回调添加 try-catch
  - `_loadNote` 添加 try-catch，失败时显示错误面板
  - `initState` 中的 `_loadNote()` 添加错误处理
  - `dispose()` 中的保存改为安全执行（不依赖已销毁的 State）
  - `didUpdateWidget` 中保存失败也要继续加载新笔记
  - LiveMarkdownEditor 的 addPostFrameCallback 添加 mounted 检查
  - WikiLinkHoverHandler._show 添加 try-catch
  - 侧边栏搜索 TextField 添加 controller listener 刷新 suffixIcon
- **Acceptance Criteria Addressed**: FR-2, FR-10, AC-3, AC-4
- **Test Requirements**:
  - `human-judgment` TR-4.1: 编辑内容后切换笔记不丢失
  - `human-judgment` TR-4.2: 保存失败有 SnackBar 提示
  - `programmatic` TR-4.3: _doSave 方法有 try-catch（代码审查）
  - `programmatic` TR-4.4: addPostFrameCallback 有 mounted 检查
- **Notes**: 关键文件：`lib/features/editor/widgets/note_panel.dart`、`lib/features/editor/widgets/live_markdown_editor.dart`、`lib/features/editor/widgets/wiki_link_preview.dart`

---

## [x] Task 5: 插件系统修复
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 修复 `plugin_registry.dart` 中 `resumePlugin` 空指针（添加 null 检查）
  - 修复 AI 聊天插件命令重复注册（onActivate 中不通过 API 注册，只通过 getCommands 返回）
  - PluginApi 添加事件取消注册方法（offNoteOpened/offNoteSaved 等）
  - 修复 `PluginApiImpl.getStorage` 未实现问题
  - PluginApiImpl 弱引用 WidgetRef 或在 dispose 时清理
  - 插件状态持久化到 Hive（启用/禁用状态重启后保持）
  - 插件 dispose 时注销事件监听器
- **Acceptance Criteria Addressed**: FR-5
- **Test Requirements**:
  - `programmatic` TR-5.1: resumePlugin 在 storage 为 null 时不崩溃
  - `programmatic` TR-5.2: 命令注册不重复（测试验证）
  - `programmatic` TR-5.3: getStorage 返回正确的 PluginStorage
- **Notes**: 关键文件：`lib/core/plugin/`、`lib/core/builtin_plugins/ai_chat_plugin.dart`、`lib/core/services/plugin_api_impl.dart`

---

## [x] Task 6: Overlay 统一管理
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 在 app.dart 中创建 `OverlayType` 枚举（none/commandPalette/quickSwitcher/templateGallery/pluginManager/settings/graph/cheatsheet/welcome/importExport）
  - 用单一 `_activeOverlay` 状态替代 9 个 boolean 标志
  - 打开新 overlay 时自动关闭当前 overlay（互斥）
  - ESC 键关闭当前活动的 overlay，全部关闭后焦点回到编辑器
  - CommandPalette/QuickSwitcher/TemplateGallery/PluginManager 的 provider 添加 `close()` 方法，由 App Shell 统一控制
  - 所有 overlay 打开/关闭时正确管理焦点
- **Acceptance Criteria Addressed**: FR-8, AC-5, AC-6
- **Test Requirements**:
  - `human-judgment` TR-6.1: 同时只能打开一个 overlay
  - `human-judgment` TR-6.2: ESC 关闭当前 overlay
  - `human-judgment` TR-6.3: 打开新 overlay 关闭旧的
  - `programmatic` TR-6.4: 无 boolean 标志冗余（代码审查）
- **Notes**: 关键文件：`lib/app.dart`

---

## [x] Task 7: Git 备份修复
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - 修复 `git clone` 命令：clone 前检查目录是否为空，使用 `git clone <url> .` 克隆到当前目录
  - 移除 `--allow-empty` 参数，只在有变更时 commit
  - 替换 `existsSync/createSync` 为异步方法
  - `_loadFromStorage` 改为 async，添加加载状态
  - 移除 `runInShell: true`，防止命令注入
- **Acceptance Criteria Addressed**: FR-6, AC-9
- **Test Requirements**:
  - `programmatic` TR-7.1: clone 到指定目录不创建子目录
  - `programmatic` TR-7.2: 无变更时不创建空 commit
  - `programmatic` TR-7.3: 不使用 runInShell
- **Notes**: 关键文件：`lib/core/services/git_backup_service.dart`、`lib/providers/git_backup_provider.dart`

---

## [x] Task 8: 实体识别修复
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - 修复远程 LLM 识别偏移量问题：截断发送时记录截断前缀长度，返回时偏移量加前缀长度
  - 防抖回调（Timer 中 recognize 调用）添加 try-catch
  - EntityCache 添加容量上限（最多缓存 200 篇笔记的实体，LRU 策略或简单 FIFO）
- **Acceptance Criteria Addressed**: FR-7
- **Test Requirements**:
  - `programmatic` TR-8.1: 远程识别返回的偏移量映射到正确位置
  - `programmatic` TR-8.2: EntityCache 不超过 200 条
  - `programmatic` TR-8.3: recognize 异常不导致未捕获错误
- **Notes**: 关键文件：`lib/features/ai_engine/services/entity_recognizer.dart`、`lib/providers/ai_provider.dart`

---

## [x] Task 9: 搜索与 UI 错误处理
- **Priority**: medium
- **Depends On**: Task 3
- **Description**:
  - 侧边栏搜索 TextField 添加 controller listener，suffixIcon 清除按钮实时显示/隐藏
  - 搜索无结果时显示明确提示文案
  - 正则搜索无效时在搜索框下方提示"正则表达式无效，已按字面搜索"
  - 标签匹配 offset 正确（或移除不正确的高亮）
  - 搜索语法支持带空格的值（如 title:"hello world"）
  - 命令面板/Quick Switcher/模板画廊等 overlay 中键盘导航正常
  - 所有 overlay 中错误状态有明确提示
- **Acceptance Criteria Addressed**: FR-9
- **Test Requirements**:
  - `human-judgment` TR-9.1: 搜索输入时清除按钮实时出现
  - `human-judgment` TR-9.2: 无结果时显示提示
  - `human-judgment` TR-9.3: 正则无效有提示
- **Notes**: 关键文件：`lib/core/services/search_service.dart`、`lib/features/sidebar/widgets/sidebar_container.dart`、各 overlay widget

---

## [x] Task 10: 笔记操作错误处理全覆盖
- **Priority**: medium
- **Depends On**: Task 2, Task 4
- **Description**:
  - `_createNewNote` 添加 try-catch
  - `_finishEditing`（面板标题重命名）添加 try-catch 和 mounted 检查
  - `_duplicateNote` 添加 try-catch，失败刷新笔记树
  - `_doRename` 添加 try-catch
  - TrashPanel 的恢复/永久删除/清空添加 try-catch
  - `_openLocalFile` 添加 try-catch
  - `_openFile` 添加 try-catch
  - SidebarNotifier 的 toggleTask/renameTag/deleteTag 添加 try-catch
  - 对话框中的 TextEditingController 正确 dispose
  - 所有 `void async` 方法改为 `Future<void> async`
- **Acceptance Criteria Addressed**: FR-10, FR-11
- **Test Requirements**:
  - `programmatic` TR-10.1: 无 void async 方法（grep 验证）
  - `programmatic` TR-10.2: 关键操作有 try-catch（代码审查）
  - `human-judgment` TR-10.3: 操作失败有提示
- **Notes**: 关键文件：`lib/features/sliding_panes/widgets/sliding_panes_container.dart`、`lib/features/sidebar/widgets/sidebar_container.dart`、`lib/features/sidebar/widgets/trash_panel.dart`、`lib/providers/sidebar_provider.dart`

---

## [x] Task 11: 综合验证与提交
- **Priority**: high
- **Depends On**: Task 2-10
- **Description**:
  - 运行全部测试：`flutter test`
  - 运行静态分析：`dart analyze lib/`（确认 0 errors，warning 不超过基线）
  - 构建 macOS Debug：`flutter build macos --debug`
  - 手动验收测试：创建笔记→编辑→换行→保存→切换→wiki链接→搜索→各 overlay→ESC关闭→Git备份
  - 修复验证中发现的问题
  - 更新 CLAUDE.md（如有必要）
  - Git 提交并推送
- **Acceptance Criteria Addressed**: NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, AC-1 through AC-10
- **Test Requirements**:
  - `programmatic` TR-11.1: `flutter test` 全部通过
  - `programmatic` TR-11.2: `dart analyze lib/` exit code 0
  - `programmatic` TR-11.3: `flutter build macos --debug` 成功
  - `human-judgment` TR-11.4: 手动验收场景全部通过

---

## Review 阶段发现的问题 (Round 2 评审)

## [x] Issue 1: 22处直接调用repo.saveNote()绕过NoteNotifier导致缓存不失效
- **Discovered During**: Review Session 1
- **Blocks Release**: Yes
- **Severity**: Critical
- **Resolution**:
  - 采用方案：在 LocalNoteRepository 中添加变更通知流（StreamController.broadcast），saveNote/deleteNote 后自动发出 NoteChangeEvent
  - allNotesProvider 和 noteByIdProvider 监听 changes 流自动 ref.invalidateSelf()，无需手动 invalidate
  - 从架构根源解决问题，所有调用路径（直接调用 repo.saveNote 或通过 NoteNotifier）都会自动触发缓存刷新
  - NoteNotifier 简化为直接代理 repo 方法
  - 新增 vaultRootProvider、fileServiceProvider 统一 vaultRoot 管理

## [x] Issue 2: 任意文件写入路径遍历漏洞
- **Discovered During**: Review Session 1
- **Blocks Release**: Yes
- **Severity**: Critical
- **Resolution**:
  - 添加 FileService._safePath() 静态方法，使用 p.canonicalize() + p.isWithin() 检查路径是否在 vaultRoot 内
  - syncToFile() 和 createNote() 在写入前调用 _safePath 验证
  - 越界路径抛出 SecurityException，被 try-catch 捕获并记录日志，不会写入
  - 同步修复 Issue #24：手动 JSON 转义替换为 dart:convert 的 jsonEncode
  - 新增 SecurityException 异常类

## [x] Issue 3: @人名和#标签实体高亮偏移量错误
- **Discovered During**: Review Session 1
- **Blocks Release**: Yes
- **Severity**: Critical
- **Resolution**:
  - 调整正则捕获组：将 @ 和 # 包含在捕获组内 (personPattern: `(@[A-Z...])`, tagPattern: `(#[\w...])`)
  - 对每个匹配，通过 fullMatch.indexOf('@')/indexOf('#') 计算实际起始偏移
  - endOffset = startOffset + 捕获文本长度（不含前导空格）
  - label 正确去掉 @/# 前缀（substring(1)）

## [x] Issue 4: HTML导出存在XSS漏洞
- **Discovered During**: Review Session 1
- **Blocks Release**: Yes
- **Severity**: Critical
- **Resolution**:
  - 添加 _sanitizeUrl() 方法，白名单允许 http/https/ftp/ftps/mailto/tel/file 协议
  - 危险协议（javascript:/data:/vbscript:等）替换为 #
  - URL 使用 HtmlEscapeMode.attribute 正确转义
  - 修复代码块双重转义问题：先占位提取代码块和行内代码，再 escape HTML，再还原代码块并单独 escape
  - 添加 rel="noopener noreferrer" 防止 window.opener 攻击
  - 提取静态 const HtmlEscape 实例避免重复构造

## [x] Issue 5: dispose时保存不可靠可能导致数据丢失
- **Discovered During**: Review Session 1
- **Blocks Release**: Yes
- **Severity**: Critical
- **Resolution**:
  - 移除 dispose() 中不可靠的 addPostFrameCallback 方案
  - 新增 _saveSilently() 方法：只做核心数据保存（repo.saveNote + syncToFile + versionSnapshot）
  - _saveSilently() 不依赖 mounted/context，不更新 pane title/sidebar，不显示 SnackBar
  - dispose() 中直接调用 _saveSilently()（fire-and-forget，但在 super.dispose() 前发起）
  - 保存失败只 debugPrint 记录，避免崩溃

## [ ] Issue 6: Overlay仍使用多个boolean标志而非统一枚举管理
- **Discovered During**: Review Session 1
- **Blocks Release**: Yes
- **Severity**: High
- **Description**:
  - FR-8 要求用单一 `OverlayType` 枚举替代 boolean 标志
  - 实际 app.dart 中仍有 `_isGraphVisible`、`_isSettingsVisible`、`_isCheatsheetVisible`、`_isWelcomeVisible`、`_isImportExportVisible` 等5个独立 boolean
  - wiki link completer、搜索替换栏等局部浮层未纳入全局管理
- **Evidence / Signals**:
  - 文件：lib/app.dart:88-100 定义了5个 boolean 标志
- **Suggested Remediation**:
  - 创建 OverlayType 枚举和单一 `_activeOverlay` 状态
  - 统一所有 overlay 的打开/关闭逻辑
- **Notes**: 架构不一致，未来维护困难

## [ ] Issue 7: Overlay遮罩/动画/关闭行为不统一
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: High
- **Description**:
  - 命令面板/模板画廊遮罩 black54，QuickSwitcher/插件管理 black38，设置/快捷键/欢迎/导入导出完全无遮罩
  - 部分 overlay 点击背景可关，部分不可关（插件管理）
  - 入场动画不一致（Fade+Scale/Fade+Slide/无动画/Scale）
  - 部分支持键盘导航，部分不支持
- **Evidence / Signals**:
  - 文件：各 overlay widget 和 app.dart 中的 Stack 布局
- **Suggested Remediation**:
  - 抽取通用 OverlayDialog 组件统一遮罩、动画、关闭逻辑
  - 所有 modal 类 overlay 统一遮罩和点击背景关闭
- **Notes**: 用户体验不一致

## [x] Issue 8: 自动保存防抖时间1秒与设置描述的2秒不符
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Resolution**:
  - _autoSave() 方法不再硬编码 Duration(seconds:1)
  - 改为读取 ref.read(settingsProvider).autoSaveDelay
  - 默认值为 const Duration(seconds:2)，与设置页描述一致
  - 用户可在设置中自定义自动保存延迟

## [ ] Issue 9: AI Chat面板无法折叠/隐藏且小屏幕布局拥挤
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: High
- **Description**:
  - AiChatPanel 硬编码为 const Widget 始终显示在右侧 300px
  - 无折叠/关闭/隐藏机制
  - 小屏幕（<1200px）下三栏布局导致编辑区严重压缩
  - 完全没有响应式断点适配
- **Evidence / Signals**:
  - 文件：lib/app.dart:969 `const AiChatPanel()` 硬编码
- **Suggested Remediation**:
  - 添加侧边栏折叠按钮和快捷键
  - 添加响应式断点，小屏幕默认折叠右侧面板
  - 可考虑拖拽调整宽度
- **Notes**: 严重影响小屏用户体验

## [ ] Issue 10: 源码模式完全不显示实体高亮
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: High
- **Description**:
  - AI实体识别是产品核心卖点，但源码编辑模式下完全看不到任何高亮
  - 只能通过工具栏徽标知道识别了实体，但看不到具体位置
  - Obsidian 在源码模式也会对链接、标签、任务等着色
- **Evidence / Signals**:
  - 文件：lib/features/editor/widgets/note_panel.dart:1110-1222 注释明确说明
- **Suggested Remediation**:
  - 源码模式下使用 TextField 的 TextSpan 叠加语法高亮
  - 至少对 wiki link、tag、task 等内置实体进行基础着色
- **Notes**: 核心功能在主要使用场景不可见

## [ ] Issue 11: LiveMarkdownEditor按行拆分TextField导致编辑功能残缺
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: High
- **Description**:
  - 每行都是独立的 TextField，无法跨多行选择文本
  - Ctrl+A 全选功能完全失效
  - 光标上下移动在长行/代码块中行为异常
  - 撤销/重做与原生 TextField 历史冲突
- **Evidence / Signals**:
  - 文件：lib/features/editor/widgets/live_markdown_editor.dart:29-291
- **Suggested Remediation**:
  - 考虑重写为单一 TextField + TextSpan 叠加渲染方案
  - 或使用 flutter_markdown 在编辑框上层叠加只读渲染层
- **Notes**: 这是较大的架构问题，短期可考虑提示用户主要使用源码模式

## [ ] Issue 12: 搜索功能不高亮所有匹配项
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - 编辑器内搜索只选中当前匹配项，其他匹配项完全没有视觉标记
  - Obsidian/VS Code 会用黄色背景高亮所有匹配项
  - 缺少区分大小写/正则/全字匹配选项
- **Evidence / Signals**:
  - 文件：lib/features/editor/widgets/note_panel.dart:1409-1642
- **Suggested Remediation**:
  - 添加 TextSpan 高亮所有匹配项
  - 补充搜索选项
- **Notes**: 搜索体验不符合预期

## [ ] Issue 13: 浅色主题不可用但设置中提供选项
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - AeroColors 是固定暗色调色板，90% 的 UI 组件硬编码使用暗色
  - 切换浅色模式后文字看不清、对比度错误
  - 设置页面却提供浅色模式选项，会让用户踩坑
- **Evidence / Signals**:
  - 文件：lib/core/theme/aeromind_theme.dart:100-130
  - 注释："AeroColors 为固定暗色调色板，自定义组件仍以暗色为主"
- **Suggested Remediation**:
  - 要么完整实现浅色主题的 AeroColors 变体
  - 要么暂时移除设置中的浅色模式选项，只保留暗色
- **Notes**: 体验陷阱

## [ ] Issue 14: Git备份clone空目录检查误判和分支硬编码
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - `dir.list().isEmpty` 会被 macOS 的 .DS_Store 等隐藏文件干扰，导致空目录误判为非空
  - push/pull 硬编码 branch: 'main'，不兼容 master 默认分支的仓库
  - 未检查是否已有 .git 目录
- **Evidence / Signals**:
  - 文件：lib/core/services/git_backup_service.dart:204-212
  - 文件：lib/core/services/git_backup_service.dart:179,191
- **Suggested Remediation**:
  - 过滤隐藏文件检查目录是否为空，或检查是否存在 .git 目录
  - 自动检测当前分支名或让用户配置
  - 添加 Git 参数注入防护
- **Notes**: 功能可用性问题

## [ ] Issue 15: Git参数注入风险
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - setUserInfo(name, email)、addRemote(url)、clone(url)、push/pull、checkout、resetHard 等方法接受用户输入但未验证
  - 参数以 `-` 开头可注入 git 选项（如 `--upload-pack=<命令>`）
- **Evidence / Signals**:
  - 文件：lib/core/services/git_backup_service.dart
- **Suggested Remediation**:
  - 对所有用户输入参数添加验证：禁止以 `-` 开头
  - commitHash 用正则 `^[0-9a-fA-F]+$` 验证
  - URL 用 Uri.tryParse 验证格式
- **Notes**: 安全防护

## [ ] Issue 16: 知识图谱圆形揭示动画永远从左上角开始
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Low
- **Description**:
  - `_toggleGraph(Offset.zero)` 永远传 Offset.zero
  - 圆形展开动画中心点始终是屏幕左上角，不是按钮位置
- **Evidence / Signals**:
  - 文件：lib/app.dart:800-815 view.knowledgeGraph
- **Suggested Remediation**:
  - 从按钮点击位置获取 Offset 传入
- **Notes**: 视觉 polish

## [ ] Issue 17: 侧边栏resizer拖拽热区太小且无悬停反馈
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - 视觉分割线仅 1px 宽
  - 可拖拽区域虽可能是透明 3px，但没有悬停变色反馈
  - 用户很难发现可以拖拽调整宽度
- **Evidence / Signals**:
  - 文件：lib/features/sidebar/widgets/sidebar_container.dart:362-395
- **Suggested Remediation**:
  - 增大热区到 6px
  - 添加 MouseRegion 悬停时变色/光标变化
- **Notes**: 可发现性问题

## [ ] Issue 18: 任务复选框点击同时触发打开笔记
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - _TaskTile 整个区域是 InkWell 点击打开笔记
  - 复选框是子组件，点击复选框会同时触发勾选和打开笔记两个动作
- **Evidence / Signals**:
  - 文件：lib/features/sidebar/widgets/sidebar_container.dart:2032-2101
- **Suggested Remediation**:
  - 复选框区域单独处理点击事件，不让事件冒泡到父 InkWell
- **Notes**: 交互违反预期

## [ ] Issue 19: 删除笔记文案"不可撤销"与回收站功能矛盾
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Low
- **Description**:
  - 删除确认对话框显示"此操作不可撤销"
  - 但侧边栏有回收站视图，笔记被移到回收站可恢复
  - 文案矛盾误导用户
- **Evidence / Signals**:
  - 文件：lib/features/sidebar/widgets/sidebar_container.dart:968
  - 文件：lib/features/editor/widgets/note_panel.dart:780
- **Suggested Remediation**:
  - 将文案改为"笔记将移到回收站，可从侧边栏回收站恢复"
- **Notes**: 文案不一致

## [ ] Issue 20: 多处addPostFrameCallback缺少mounted检查
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - 至少 10+ 处 addPostFrameCallback 回调中未检查 mounted 就调用 setState
  - 可能导致 setState-after-dispose 异常
- **Evidence / Signals**:
  - 需要全面 grep 排查
- **Suggested Remediation**:
  - 所有 addPostFrameCallback 回调开头添加 `if (!mounted) return;`
- **Notes**: 稳定性问题

## [ ] Issue 21: saveNote中updatedAt强制覆盖不支持保留时间戳
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - LocalNoteRepository.saveNote() 总是将 updatedAt 设为 DateTime.now()
  - 版本恢复、数据迁移等场景无法保留原始时间戳
- **Evidence / Signals**:
  - 文件：lib/providers/note_provider.dart:61-66
- **Suggested Remediation**:
  - 改为仅当传入 note 的 updatedAt 为 null 时才设置当前时间
  - 或添加参数控制是否覆盖
- **Notes**: 灵活性不足

## [ ] Issue 22: 全局错误处理在Release模式无用户反馈
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - FlutterError.onError 和 PlatformDispatcher.onError 仅调用 debugPrint
  - Release 模式下用户看不到任何错误提示
  - 没有错误上报机制
  - Hive 初始化错误页面无重试按钮和错误详情
- **Evidence / Signals**:
  - 文件：lib/main.dart:12-21
- **Suggested Remediation**:
  - Release 模式下显示友好的错误对话框而非静默
  - 错误页面添加重试按钮
  - 可考虑添加崩溃日志本地记录
- **Notes**: 可观测性不足

## [ ] Issue 23: Mermaid图表代码发送至第三方服务
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Medium
- **Description**:
  - Mermaid 代码通过 URL 编码发送到 mermaid.ink 第三方服务渲染
  - 可能导致敏感笔记内容泄露
  - 未提供本地渲染选项或用户提示
- **Evidence / Signals**:
  - 文件：lib/features/mermaid/services/mermaid_service.dart:42-44
- **Suggested Remediation**:
  - 添加用户确认提示说明内容会发送到第三方
  - 考虑本地 mermaid 渲染方案
- **Notes**: 隐私问题

## [ ] Issue 24: 手动JSON转义不完整
- **Discovered During**: Review Session 1
- **Blocks Release**: No
- **Severity**: Low
- **Description**:
  - FileService._escapeJson 手动实现 JSON 转义
  - 未处理完整的控制字符（\u0000-\u001F）
- **Evidence / Signals**:
  - 文件：lib/core/services/file_service.dart:100-111
- **Suggested Remediation**:
  - 使用 dart:convert 的 jsonEncode 替代手动实现
- **Notes**: 代码健壮性

