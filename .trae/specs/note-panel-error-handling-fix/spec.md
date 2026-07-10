# NotePanel 错误处理与安全性修复 Spec

## Why（为什么做）

当前 `note_panel.dart` 存在以下问题：
1. 关键异步操作（保存、自动保存、加载笔记）缺乏异常捕获，可能导致未处理异常崩溃
2. 创建新笔记时使用时间戳作为 ID，存在碰撞风险且不符合项目统一的 UUID 规范
3. `dispose()` 中直接调用 `_doSave()` 可能在 widget 已销毁后执行，导致 context 相关问题
4. `didUpdateWidget` 中保存失败会阻止新笔记加载，导致 UI 卡死
5. 加载笔记失败时缺乏友好的错误提示

## What Changes（改什么）

1. **_doSave 方法**：包裹 try-catch，异常时显示错误 SnackBar
2. **_autoSave Timer 回调**：添加 try-catch 防止定时器回调异常
3. **_loadNote 方法**：添加 try-catch，失败时设置 `_noteNotFound = true` 并显示错误提示
4. **创建新笔记（第1262行）**：使用 `ref.read(noteRepositoryProvider).generateId()` 替代时间戳 ID
5. **dispose() 保存**：使用 `WidgetsBinding.instance.addPostFrameCallback` 安全执行，不直接访问已销毁的 context
6. **didUpdateWidget**：无论保存成功失败都继续加载新笔记，使用 `whenComplete` 或 try-catch 确保 `_loadNote()` 总能执行

## Impact（影响范围）

- 修改文件：`lib/features/editor/widgets/note_panel.dart`
- 影响模块：笔记编辑面板的保存、加载、切换笔记、销毁流程
- 无破坏性变更，仅增加错误处理和安全性改进

## ADDED/MODIFIED Requirements

### R1: _doSave 异常处理
- 当保存操作抛出异常时，必须捕获异常
- 如果 widget 仍 mounted，使用 ScaffoldMessenger 显示红色错误 SnackBar
- 异常信息显示在 SnackBar 中

### R2: _autoSave 回调异常安全
- Timer 回调内调用 `_doSave` 必须被 try-catch 包裹
- 异常不应导致 Timer 或应用崩溃

### R3: _loadNote 异常处理
- 当加载笔记抛出异常时，必须捕获异常
- 设置 `_noteNotFound = true`
- 显示错误提示 SnackBar
- 不崩溃

### R4: 新笔记 ID 生成
- 创建新笔记时使用 UUID v4（通过 `noteRepositoryProvider.generateId()`）
- 不再使用 `DateTime.now().millisecondsSinceEpoch.toString()`

### R5: dispose() 安全保存
- 使用 `WidgetsBinding.instance.addPostFrameCallback` 包裹保存逻辑
- 在回调内检查 mounted 状态（但 dispose 后 mounted 为 false，需要更谨慎的处理）
- 保存不应依赖已销毁的 BuildContext
- 实际上，dispose 时应直接执行保存，不使用 context 相关操作，但要确保 _doSave 本身不依赖 context

### R6: didUpdateWidget 鲁棒性
- 切换笔记时，即使旧笔记保存失败，也要继续加载新笔记
- 使用 try-catch 或 whenComplete 确保 `_loadNote()` 被调用
- 保存失败时可显示错误提示，但不能阻塞新笔记加载

## 设计决策（grill-me 自我拷问结论）

1. **Q: dispose() 中如何安全使用 addPostFrameCallback？**
   - A: dispose() 时 widget 已经在销毁流程中，mounted 为 false。应该直接执行保存操作，但确保 _doSave 内部不使用 context（实际上 _doSave 只使用 ref 和 repo，不直接使用 context）。addPostFrameCallback 在 dispose 后可能不会执行或执行时 context 已无效，所以最佳方案是：直接调用 _doSave，但不 await（fire-and-forget with try-catch），因为 dispose 后无法处理 UI 反馈。
   - 修正：使用 `WidgetsBinding.instance.addPostFrameCallback` 但在回调内不依赖 context，只做数据保存；同时 _doSave 本身已有 try-catch。

2. **Q: showErrorSnackBar 不存在怎么办？**
   - A: 项目中没有统一的 showErrorSnackBar 函数，使用标准的 `ScaffoldMessenger.maybeOf(context)?.showSnackBar()` 配合红色背景的 SnackBar。

3. **Q: _loadNote 失败时设置 _noteNotFound 是否合适？**
   - A: 合适。加载失败（如 IO 异常、数据损坏）与笔记不存在表现类似，显示"笔记未找到/加载失败"界面让用户可以关闭面板。

4. **Q: NoteNotifier.generateId() 还是 noteRepository.generateId()？**
   - A: 直接用 `ref.read(noteRepositoryProvider).generateId()` 更直接，因为创建笔记后直接调用 repo.saveNote()，不需要经过 Notifier 的缓存失效逻辑（Notifier 主要用于更新后 invalidate provider，这里是新创建笔记，之后会手动 loadNoteTree，所以直接用 repo 即可）。

5. **Q: didUpdateWidget 中保存失败是否需要显示错误？**
   - A: 应该显示错误，但必须保证 _loadNote() 执行。可以在 catch 中显示错误，然后在 finally 中调用 _loadNote()。
