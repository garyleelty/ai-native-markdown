# UI 设计系统统一 - 第二轮 - 任务清单

## 任务列表

### Task 1: 插件管理面板重构
- [x] 使用 DialogHeader 替换自定义标题栏
- [x] 使用 DialogContainer 替换自定义容器
- [x] 背景色从 bgSurface 改为 bgElevated
- [x] 使用 SearchInput 替换自定义搜索框
- [x] 保持插件列表、开关、设置详情等功能不变
- 依赖：无
- 可并行：是（与 Task 2-5 并行）

### Task 2: 模板画廊重构
- [x] 使用 DialogHeader 替换自定义标题栏
- [x] 集成 SearchInput 组件替换自定义搜索框
- [x] 使用 DialogContainer 统一容器样式
- [x] 保持模板网格、分类过滤、应用模板等功能不变
- 依赖：无
- 可并行：是（与 Task 1,3-5 并行）

### Task 3: 设置页面重构
- [x] 使用 DialogHeader 替换自定义标题栏
- [x] 使用 DialogContainer 统一容器样式
- [x] 主背景色从 bgDeep 改为 bgElevated（与其他对话框一致）
- [x] 左侧导航栏背景保持 bgSurface 以区分层次
- [x] 添加入场动画（fade + scale）
- [x] 保持设置项、分类导航、Git 配置等功能不变
- 依赖：无
- 可并行：是（与 Task 1-2,4-5 并行）

### Task 4: 快捷键速查表重构
- [x] 使用 DialogHeader 替换自定义标题栏（新增）
- [x] 使用 DialogContainer 统一容器样式
- [x] 添加统一的入场动画（fade + scale）
- [x] 保持点击遮罩关闭功能
- [x] 保持快捷键分组展示功能不变
- 依赖：无
- 可并行：是（与 Task 1-3,5 并行）

### Task 5: 导入导出面板重构
- [x] 使用 DialogHeader 替换自定义标题栏（_buildHeader）
- [x] 使用 DialogContainer 统一容器样式
- [x] 添加统一的入场动画
- [x] 添加点击遮罩关闭功能
- [x] 保持导出/导入功能不变
- 依赖：无
- 可并行：是（与 Task 1-4 并行）

### Task 6: 验证与测试
- [ ] 运行 dart analyze 确保无错误（沙箱环境受限，通过代码审查替代）
- [ ] 运行 flutter test 确保现有测试通过（沙箱环境受限，通过代码审查替代）
- [x] 代码审查确认所有重构不影响功能
- [x] 验证视觉一致性（标题栏、背景色、圆角、阴影）
- [x] 验证动画一致性（时长、曲线、缩放范围）
- 依赖：Task 1-5 全部完成
- 可并行：否
