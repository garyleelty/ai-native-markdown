# Progress Tracking: production-readiness-v1

## 当前阶段：Production Ready (Critical + UI Fixes Complete)

- [x] Phase 1: Setup (Day 1 - 2026-03-18)
- [x] Phase 2: Spec (Day 1 - 2026-03-18)
- [x] Phase 3: Plan (Day 1 - 2026-03-18)
- [x] Phase 4: Execution (Day 1-2 - 2026-03-18 ~ 2026-03-19)
- [x] Phase 5: Review (Day 2 - 2026-03-19)
- [x] Phase 6: Critical Bug Fix (Day 3 - 2026-03-21)
- [x] Phase 6.5: UI/UX Polish (Day 3 - 2026-03-21)
- [ ] Phase 7: High Priority Fix (Overlay统一管理/性能优化)

## Task Status

### Phase 1-4: Completed (March 19, 2026)
- 规范文档(65页)
- 35个测试通过
- macOS构建通过
- 12项功能FR-1~FR-12全部实现
- 13项技术债务TD-1~TD-13全部修复
- 11项需求缺口G-1~G-11全部补齐

### Phase 5: Review Round 1 (March 19, 2026)
- grill-me发现8个额外问题
- 包含2个Critical级安全漏洞(路径遍历/XSS)
- 包含1个Critical级数据一致性问题(缓存不失效)
- 包含1个Critical级核心功能bug(实体偏移量)
- 包含1个Critical级数据丢失风险(dispose保存)

### Phase 6: Critical Bug Fix (March 21, 2026)

#### ✅ Issue 1: 缓存不失效 → 变更通知流架构
- 新增 NoteChangeType 枚举 / NoteChangeEvent 类
- NoteRepository 抽象类新增 changes Stream
- LocalNoteRepository 实现 StreamController.broadcast
- saveNote/deleteNote 自动发出事件
- allNotesProvider/noteByIdProvider 自动监听并 invalidate
- 新增 vaultRootProvider / fileServiceProvider 统一 vaultRoot 管理
- NoteNotifier 简化（移除手动 invalidate 逻辑）

#### ✅ Issue 2: 路径遍历漏洞修复
- FileService 添加 _globalVaultRoot 静态字段
- initializeVaultRoot() 在 HiveService 初始化时设置
- _safePath() 静态方法：p.canonicalize + p.isWithin 边界检查
- syncToFile/createNote 调用 _safePath 验证
- 越界抛出 SecurityException（新增异常类）
- exportAsJson 使用 jsonEncode 替代手动转义

#### ✅ Issue 3: @人名/#标签偏移量修复
- 正则捕获组包含 @ 和 # 符号
- 计算 fullMatch.indexOf('@')/indexOf('#') 得到实际起始偏移
- label 正确 substring(1) 去掉前缀符号
- 所有实体识别测试通过

#### ✅ Issue 4: HTML导出XSS修复
- _sanitizeUrl() 白名单协议检查(http/https/ftp/ftps/mailto/tel/file)
- 危险协议返回 #，URL 用 HtmlEscapeMode.attribute 转义
- 代码块占位提取 → HTML转义 → 代码块还原单独escape（修复双重转义）
- 链接添加 rel="noopener noreferrer"
- 提取 const HtmlEscape 实例复用

#### ✅ Issue 5: dispose保存不可靠修复
- 移除 addPostFrameCallback 方案
- 新增 _saveSilently()：直接 repo.saveNote + syncToFile + versionSnapshot
- 不依赖 mounted/context/ScaffoldMessenger
- dispose() 中直接 fire-and-forget 调用

### Phase 6.5: UI/UX Polish (March 21, 2026)

#### ✅ 主题系统清理与统一
- 移除重复/未使用的颜色定义(surface/surfaceVariant/accent蓝紫调色板)
- 新增语义化状态色: success/warning/error/info
- 新增 bgInput 输入框背景色
- 保留 accentBlue 作为 primary 别名向后兼容
- surface/surfaceVariant 作为 bgSurface/bgElevated 别名保持兼容

#### ✅ Issue 8 修复: 自动保存时间不一致
- 自动保存延迟从硬编码1秒改为读取 settingsProvider.autoSaveDelay
- 默认值2秒与设置页描述一致

#### ✅ 编辑器视觉改进
- TextField cursorColor 设置为主题蓝色, cursorWidth=1.5
- 编辑器内边距从16px增加到20px,更舒适的写作空间
- 文字行高统一为1.7,提升可读性
- wikiLink补全弹层位置对齐新padding

#### ✅ 模式切换按钮重构
- 移除 PopupMenuButton+_ToolbarButton 的手势冲突设计
- 改为带图标+文字标签+下拉箭头的紧凑按钮
- 点击弹出菜单选择模式,菜单项带选中标记(✓)
- 弹出菜单位置在按钮下方,带圆角边框和暗色背景

#### ✅ 状态栏全面重构
- 左侧:保存状态(绿色✓"已保存"/橙色●"未保存")
- 左中:编辑模式指示器(图标+文字)
- 右侧:光标位置(行/列或选区字符数)+精简统计(字数/行数/阅读时间)
- 高度从24px调整为26px,顶部边框分隔,背景色提升为bgElevated
- 移除冗余统计(字符数/段落数),保留最实用信息

#### ✅ 颜色硬编码清理
- 删除按钮/错误SnackBar从硬编码Colors.red统一为AeroColors.error
- SnackBar背景色统一为AeroColors.bgElevated
- version_history_panel 中旧的紫色AeroColors.accent统一为AeroColors.primary

### Verification Results (March 21, 2026)
- ✅ flutter test: 89 passed, 0 failed
- ✅ dart analyze lib/: 2 info only (pre-existing daily_note_storage), 0 errors/warnings
- ✅ flutter build macos --debug: 构建成功

### Remaining Issues (from review, to be addressed in future)
- [ ] Issue 6: Overlay统一枚举管理(High)
- [ ] Issue 7: Overlay遮罩/动画/关闭行为统一(High)
- [ ] Issue 9: SlidingPane DragGesture与Editor冲突(Low)
- [ ] Issue 10: Isar向量索引未接通(Medium)
- [ ] Issue 11: 国际化支持缺失(Medium)
- [ ] Issue 12: Web端适配(Medium)
- [ ] Widget测试补充(Medium)

## 关键决策记录
1. **缓存失效方案选择Stream-based而非全局Notifier**: 选择Repository层变更通知流，因为它更接近数据源头，所有调用路径（无论通过Notifier还是直接repo）都自动触发刷新，未来Isar接通后可无缝对接watch() API。
2. **路径安全使用canonicalize+isWithin而非正则**: 选择path库提供的规范化+边界检查方法，比正则更可靠，能正确处理/../././/等各种路径注入手段。
3. **dispose保存使用fire-and-forget**: Flutter dispose是同步方法，无法await异步操作。选择直接发起Future但不等待，相比addPostFrameCallback更可靠（不会因为framework已停止处理帧而丢失）。
4. **状态栏不实时追踪光标移动**: 避免每次光标移动都setState重建整个编辑器,在输入时随文本变化更新,性能优先。

## Blockers
None. All critical issues resolved. Product is production-ready.

## Notes
- 项目已从"架构完成+核心功能可用"升级为"生产可用的安全稳定版本"
- 5个Critical级问题全部修复，包括2个安全漏洞、1个数据一致性bug、1个核心功能bug、1个数据丢失风险
- 8个UI/UX问题修复:主题统一、编辑器体验、模式切换、状态栏、颜色一致性
- 所有现有测试（89个）全部通过，macOS构建成功，静态分析0错误
