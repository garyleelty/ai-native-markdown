# Tasks

- [ ] Task 1: 扩展 ViewMode 类型与状态管理
  - [ ] SubTask 1.1: 将 `ViewMode` 从 `'source' | 'preview'` 扩展为 `'source' | 'live' | 'preview'`
  - [ ] SubTask 1.2: 更新 `editorStore` 中的 `viewMode` 状态及 `setViewMode` 方法
  - [ ] SubTask 1.3: 更新 `App.vue` 中的模式切换逻辑，支持三种模式循环
  - [ ] SubTask 1.4: 更新状态栏显示，支持显示"实时预览"

- [ ] Task 2: 搭建 Live Preview 基础架构
  - [ ] SubTask 2.1: 创建 `src/extensions/livePreview/` 目录结构
  - [ ] SubTask 2.2: 创建 `plugin.ts` - CodeMirror ViewPlugin 主入口
  - [ ] SubTask 2.3: 创建 `parsers.ts` - Markdown 语法解析器
  - [ ] SubTask 2.4: 创建 `decorations.ts` - Decoration 生成逻辑
  - [ ] SubTask 2.5: 创建 `index.ts` - 统一导出

- [ ] Task 3: 实现整行切换核心逻辑
  - [ ] SubTask 3.1: 监听光标位置变化（selection update）
  - [ ] SubTask 3.2: 计算光标所在行及相邻行范围
  - [ ] SubTask 3.3: 对非光标行应用"隐藏"Decoration（使 Markdown 语法透明）
  - [ ] SubTask 3.4: 对光标行移除 Decoration，显示原始源码
  - [ ] SubTask 3.5: 实现 50ms 防抖优化

- [ ] Task 4: 实现基础行内元素渲染（P0）
  - [ ] SubTask 4.1: 粗体 `**text**` - Decoration.mark 加粗样式
  - [ ] SubTask 4.2: 斜体 `*text*` - Decoration.mark 倾斜样式
  - [ ] SubTask 4.3: 删除线 `~~text~~` - Decoration.mark 删除线样式
  - [ ] SubTask 4.4: 行内代码 `` `code` `` - Decoration.mark 等宽字体+背景
  - [ ] SubTask 4.5: 链接 `[text](url)` - Decoration.replace 为可点击链接
  - [ ] SubTask 4.6: 图片 `![alt](url)` - Decoration.widget 嵌入图片

- [ ] Task 5: 实现基础块级元素渲染（P0）
  - [ ] SubTask 5.1: 标题 `# H1` ~ `###### H6` - 隐藏 `#`，应用字号样式
  - [ ] SubTask 5.2: 引用块 `> text` - 隐藏 `>`，左侧边框+背景色
  - [ ] SubTask 5.3: 无序列表 `- item` - 隐藏 `-`，显示圆点标记
  - [ ] SubTask 5.4: 有序列表 `1. item` - 隐藏 `1.`，显示数字标记
  - [ ] SubTask 5.5: 水平线 `---` - 隐藏语法，显示分割线
  - [ ] SubTask 5.6: 代码块 ` ```lang ` - 语法高亮块样式

- [ ] Task 6: 实现点击编辑交互
  - [ ] SubTask 6.1: 为已渲染元素绑定点击事件
  - [ ] SubTask 6.2: 计算点击位置对应的源码范围
  - [ ] SubTask 6.3: 将光标跳转到对应源码位置
  - [ ] SubTask 6.4: 确保跳转后该行显示为源码模式

- [ ] Task 7: 实现增强元素渲染（P1）
  - [ ] SubTask 7.1: 任务列表 `- [ ] task` - 可交互复选框 Widget
  - [ ] SubTask 7.2: 表格 `| col | col |` - 表格样式渲染
  - [ ] SubTask 7.3: Wiki 链接 `[[note]]` - 内部链接样式

- [ ] Task 8: 实现复杂元素渲染（P2）
  - [ ] SubTask 8.1: KaTeX 行内公式 `$...$` - 公式渲染
  - [ ] SubTask 8.2: KaTeX 块级公式 `$$...$$` - 公式渲染
  - [ ] SubTask 8.3: Mermaid 图表 - SVG 渲染

- [ ] Task 9: 性能优化与边界处理
  - [ ] SubTask 9.1: 实现增量更新（仅计算光标附近 5 行）
  - [ ] SubTask 9.2: 实现语法树缓存（文档未变更时复用）
  - [ ] SubTask 9.3: 大文件性能测试与优化
  - [ ] SubTask 9.4: 边界情况处理（空文档、纯代码块、嵌套元素等）

- [ ] Task 10: 集成测试与回归验证
  - [ ] SubTask 10.1: 验证三种模式切换正常
  - [ ] SubTask 10.2: 验证现有 Source 模式功能不受影响
  - [ ] SubTask 10.3: 验证现有 Preview 模式功能不受影响
  - [ ] SubTask 10.4: 验证文件保存/打开/切换正常
  - [ ] SubTask 10.5: 验证 AI 面板、工具栏等功能正常

# Task Dependencies

- Task 2 依赖 Task 1（需要 ViewMode 类型定义）
- Task 3 依赖 Task 2（需要基础架构）
- Task 4 依赖 Task 3（需要整行切换逻辑）
- Task 5 依赖 Task 3（需要整行切换逻辑）
- Task 6 依赖 Task 4、Task 5（需要基础渲染完成后才能点击编辑）
- Task 7 依赖 Task 4、Task 5（增强元素依赖基础架构）
- Task 8 依赖 Task 7（复杂元素依赖增强元素架构）
- Task 9 依赖 Task 4、Task 5、Task 6（性能优化需要功能完成后进行）
- Task 10 依赖所有前置任务（最终集成验证）
