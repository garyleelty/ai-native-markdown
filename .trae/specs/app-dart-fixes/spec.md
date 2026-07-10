# Spec: lib/app.dart Bug Fixes

## Why

修复 lib/app.dart 中存在的多个问题，包括：ID生成方式不安全、异步方法返回类型不正确、资源未正确释放、错误处理缺失、Overlay互斥问题、ESC键行为与方法名不一致等。这些问题可能导致内存泄漏、ID冲突、异常未捕获、用户体验混乱等。

## What Changes

1. **笔记ID生成修复** (第170行、323行、374行):
   - 使用 `repo.generateId()` 替代时间戳ID
   - （uuid包已存在于pubspec.yaml，无需额外添加依赖）

2. **异步方法返回类型修复**:
   - 将 `_openTodayDailyNote` 从 `void async` 改为 `Future<void>`
   - 将 `_showRenameDialog` 从 `void async` 改为 `Future<void>`
   - 将 `_showDeleteConfirmDialog` 从 `void async` 改为 `Future<void>`
   - 将 `_buildGraphData` 从 `void async` 改为 `Future<void>`

3. **错误处理增强**:
   - `_openTodayDailyNote` 的catch块添加 `debugPrint` 记录错误
   - `_buildGraphData` 添加 try-catch 错误处理，失败时降级到 demo graph

4. **资源释放修复**:
   - 在 `dispose()` 中添加 `HiveService.closeHive()` 调用
   - 修复 `_showRenameDialog` 中的 TextEditingController：使用 showDialog 的 then 回调在对话框关闭后 dispose
   - 修复 `_showDeleteConfirmDialog`（虽然没有 TextEditingController，但保持一致）

5. **Overlay互斥实现**:
   - 打开任何新overlay（命令面板/QuickSwitcher/模板/插件/设置/图谱/速查表/欢迎/导入导出）前，先关闭所有当前打开的overlay
   - 确保同一时间只有一个主要overlay可见

6. **ESC键行为修正**:
   - 将 `_closeAllOverlays` 重命名为 `_closeTopOverlay`
   - 保持现有 if-else 链逻辑不变（一次只关闭最上层的一个overlay）
   - ESC键只关闭当前最上层的一个overlay，符合用户预期
   - 新增 `_closeAllOverlays()` 方法用于打开新overlay前关闭所有

## Impact

- 影响文件: `lib/app.dart`
- 不影响其他模块，所有修改都在 _AppShellState 内部
- 笔记ID生成方式变更不影响已有笔记（已有笔记使用原有ID）
- Overlay行为变更：打开新overlay会自动关闭当前打开的，提升用户体验

## 设计决策 (Grill-me 自我拷问结论)

1. **TextEditingController dispose方式**: 使用 showDialog 的 `.then()` 回调，无需创建 StatefulWidget，代码更简洁。对话框关闭后 then 一定会被调用（包括点击外部关闭、ESC关闭、Navigator.pop关闭）。

2. **HiveService.closeHive() 在 dispose() 中调用**: dispose() 是同步方法，但 closeHive() 返回 Future。不 await 是可接受的，因为应用退出时不需要等待Hive完全关闭；或者可以使用 unawaited，但为了最小改动直接调用即可。

3. **_buildGraphData try-catch 降级方案**: catch 块中调用 `_buildDemoGraph()` 并 debugPrint 错误，确保图谱始终有内容显示，不会空白。

4. **Overlay互斥实现**: 
   - 保留 `_closeTopOverlay`（原_closeAllOverlays重命名）给ESC键使用，只关最上层
   - 新增真正的 `_closeAllOverlays()` 方法，关闭所有overlay，在打开新overlay前调用
   - 对于通过 Riverpod provider 管理的overlay（命令面板/QuickSwitcher/模板/插件），需要显式调用 close
   - 对于本地 bool 状态管理的overlay（设置/图谱/速查表/欢迎/导入导出），setState 设为 false

5. **方法返回类型修改**: 改为 Future<void> 后，调用方无需改动（可以选择await也可以不await，Dart允许忽略Future）。
