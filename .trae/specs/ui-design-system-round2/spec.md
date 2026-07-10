# UI 设计系统统一 - 第二轮

## Why（为什么做）

第一轮设计系统统一已经完成了核心组件（DialogHeader、SearchInput、ModalOverlay）的创建，并重构了命令面板和快速切换器。但项目中仍有多个 overlay/panel 组件使用各自独立的实现方式，导致：

1. **视觉不一致**：不同弹窗的标题栏高度、背景色、边框样式各不相同
2. **代码重复**：每个弹窗都重复实现遮罩、动画、标题栏、关闭按钮
3. **维护成本高**：修改设计需要逐个文件更新
4. **用户体验不统一**：关闭行为、动画效果、交互模式存在差异

## What Changes（改什么）

将剩余的 overlay 组件全部迁移到统一的设计系统：

### 待重构模块

1. **插件管理面板** (`plugin_manager_panel.dart`)
   - 使用 DialogHeader 替换自定义标题栏
   - 使用 DialogContainer 统一容器样式
   - 背景色从 bgSurface 改为 bgElevated

2. **模板画廊** (`template_gallery.dart`)
   - 使用 DialogHeader 替换自定义标题栏
   - 集成 SearchInput 统一搜索框样式
   - 简化动画逻辑，复用 ModalOverlay 模式

3. **设置页面** (`settings_page.dart`)
   - 使用 DialogHeader 替换自定义标题栏
   - 背景色从 bgDeep 改为 bgElevated（与其他弹窗一致）
   - 统一容器样式

4. **快捷键速查表** (`keyboard_cheatsheet.dart`)
   - 使用 DialogHeader 替换自定义标题栏
   - 使用 DialogContainer 统一容器样式
   - 添加入场动画

5. **导入导出面板** (`import_export_panel.dart`)
   - 使用 DialogHeader 替换自定义标题栏
   - 使用 DialogContainer 统一容器样式
   - 添加入场动画

## Impact（影响范围）

### 修改文件
- `lib/features/plugins/widgets/plugin_manager_panel.dart`
- `lib/features/templates/widgets/template_gallery.dart`
- `lib/features/settings/widgets/settings_page.dart`
- `lib/features/help/widgets/keyboard_cheatsheet.dart`
- `lib/features/import_export/widgets/import_export_panel.dart`

### 不受影响
- 知识图谱浮层（graph_overlay.dart）- 属于上下文提示卡片，不是标准对话框
- 编辑器内联组件（wiki_link_completer.dart 等）- 不是独立 overlay
- 侧边栏/面板等常驻 UI 组件

## ADDED/MODIFIED Requirements（可验证的需求）

### 视觉一致性
- [ ] 所有 overlay 标题栏高度统一为 44px
- [ ] 所有 overlay 标题栏背景色统一为 bgElevated
- [ ] 所有 overlay 关闭按钮样式一致（悬停效果、尺寸）
- [ ] 所有 overlay 容器背景色统一为 bgElevated
- [ ] 所有 overlay 圆角统一为 12px
- [ ] 所有 overlay 边框样式统一（0.5px border color）
- [ ] 所有 overlay 阴影样式统一

### 动画一致性
- [ ] 所有 overlay 入场动画时长统一为 200ms
- [ ] 所有 overlay 动画曲线统一为 easeOutCubic
- [ ] 所有 overlay 缩放范围统一为 0.95 → 1.0
- [ ] 所有 overlay 都有淡入效果

### 交互一致性
- [ ] 所有 overlay 点击遮罩都能关闭
- [ ] 所有 overlay 都有关闭按钮
- [ ] 所有 overlay 都支持 Escape 键关闭（由 app.dart 统一处理）

### 组件复用
- [ ] 所有 overlay 标题栏使用 DialogHeader 组件
- [ ] 所有 overlay 容器使用 DialogContainer 组件
- [ ] 有搜索功能的 overlay 使用 SearchInput 组件

## 设计决策（Grill-Me 自我拷问）

### 拷问 1：为什么选择逐个重构而不是创建一个统一的 Overlay 基类？
**决策**：保持当前的组合式设计（DialogHeader + DialogContainer + ModalOverlay），不创建继承式基类。
**理由**：
- 各个 overlay 的内部结构差异较大（有的是左右分栏，有的是列表，有的是网格）
- 组合式设计更灵活，每个组件可以自由安排内部布局
- Flutter 推荐组合优于继承
- 已经有 ModalOverlay 提供统一的遮罩和动画骨架

### 拷问 2：设置页面为什么要用 bgElevated 而不是保持 bgDeep？
**决策**：统一改为 bgElevated。
**理由**：
- 设置页面作为模态对话框，应该与其他对话框视觉一致
- bgDeep 通常用于最底层背景（如侧边栏、编辑器背景）
- 对话框层级使用 bgElevated 更符合视觉层次规范
- 左栏导航可以用稍深的颜色区分，但主容器统一用 bgElevated

### 拷问 3：模板画廊的动画使用 AnimationController 还是 TweenAnimationBuilder？
**决策**：重构为使用 ModalOverlay 的模式，简化动画逻辑。
**理由**：
- 当前实现使用 AnimationController + 显式 forward/reverse，逻辑复杂
- ModalOverlay 已经封装了统一的动画模式
- 简化代码，减少重复
- 保持与其他 overlay 一致的动画行为

### 拷问 4：导入导出面板和快捷键速查表需要添加搜索吗？
**决策**：不添加搜索功能，保持现有功能。
**理由**：
- 导入导出选项很少（4-5 个），不需要搜索
- 快捷键数量也不多（约 15 个），分组展示足够
- 本轮目标是设计统一，不是功能增强
- 未来如果条目增多可以再加

### 拷问 5：知识图谱浮层为什么不纳入统一范围？
**决策**：GraphOverlay 保持现状，不纳入本轮重构。
**理由**：
- 它是上下文提示卡片，不是标准对话框
- 尺寸和定位都不同（右上角小卡片 vs 居中对话框）
- 交互模式不同（悬停触发 vs 主动打开）
- 强行统一会破坏其作为提示卡片的视觉语义

### 拷问 6：如何确保重构不引入功能性回归？
**决策**：保持所有业务逻辑不变，只替换 UI 壳子。
**理由**：
- 只改标题栏、容器、动画等视觉层
- 不触碰内部状态管理、事件处理、业务逻辑
- 通过静态分析和现有测试验证
- 每个模块重构后都进行代码审查确认功能完整性

### 拷问 7：最小实现是什么？是否过度设计？
**决策**：本轮是必要的统一工作，不是过度设计。
**理由**：
- 已有 5 个主要 overlay 各自实现一套标题栏/容器/动画
- 代码重复导致维护困难
- 视觉不一致影响产品专业感
- 只复用现有组件（DialogHeader/DialogContainer/SearchInput），不新增复杂抽象
- 每个模块的改动都是机械性替换，风险可控

### 拷问 8：失败模式和回滚策略？
**决策**：逐个模块重构，每个模块独立可回滚。
**理由**：
- 5 个模块相互独立，可以一个一个来
- 每个模块的改动都是局部的，不影响其他模块
- 如果某个模块出问题，可以单独回滚
- 按优先级从高到低：插件管理 → 模板画廊 → 设置 → 快捷键 → 导入导出
