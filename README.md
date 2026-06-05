# AI Native Markdown

AI Native Markdown 是一个本地优先的 Markdown 知识工作台，基于 Electron、Vue 3 和 CodeMirror 6 构建。它不是简单复刻 Obsidian，而是把 AI 写作、知识连接、多模态输入和本地工作区放在同一个可控环境里。

## 产品定位

- 本地优先：内容保存在浏览器 IndexedDB 虚拟工作区中，适合离线写作和个人知识库。
- AI 原生：Ollama、本地模型和 OpenAI-compatible Provider 都是一等功能。
- Markdown 优先：保留纯 Markdown 工作流，同时补齐预览、双链、图谱、模板、导出和版本历史。
- 知识工作流优先：从写作、链接、搜索、反链、未链接提及到图谱形成闭环。

## 与 Obsidian 的差异点

- 内置 AI 工作流：对话、续写、润色、摘要、内联编辑、Ghost Text 和 RAG 检索不依赖插件。
- 多模态输入：语音输入、智能粘贴、图片 OCR、PDF 拖拽提取直接进入编辑器。
- 更强的默认开箱体验：示例工作区、命令面板、今日笔记、模板、导出和知识索引默认可用。
- 更偏向安全默认值：预览、AI 消息和导出 HTML 都经过清理，降低 XSS 风险。

## 已支持功能

### 工作区与文件

- 基于 IndexedDB 的本地虚拟工作区
- 导入 Markdown 文件和本地文件夹
- 新建、重命名、删除文件和文件夹
- 重命名文件或文件夹时同步更新相关 Wiki Link
- 删除或重命名时同步维护标签页、版本历史和 RAG 文档索引
- 最近打开记录和示例工作区
- 文件名搜索、全局内容搜索和命令面板搜索入口
- 多标签页、会话恢复和未保存状态提示

### 编辑与预览

- CodeMirror 6 Markdown 编辑器
- 源码、预览、分屏三种模式
- 实时预览、任务列表和 Live Preview 任务勾选回写
- Markdown 工具栏：加粗、斜体、删除线、标题、代码块、引用、列表、链接、图片
- Mermaid 图表、KaTeX 数学公式、代码高亮
- Wiki Link 渲染、跳转、缺失笔记创建和标题片段定位
- Wiki Link 输入补全：笔记名、当前文档标题、跨文档标题
- 大纲、文档统计、查找替换、自动换行、专注模式
- Markdown 语法速查表

### 知识整理

- Frontmatter Properties 基础解析
- 标签识别
- Backlinks、Unlinked mentions 和一键链接未链接提及
- Outgoing Links 浏览和缺失目标创建
- 全局知识图谱和当前笔记一跳邻域图谱
- 图谱搜索、节点打开、孤立笔记提示和图谱刷新

### AI 与多模态

- Ollama 本地模型
- OpenAI-compatible 与 DeepSeek 配置
- AI 对话面板、历史持久化和清空历史
- AI 连接测试
- 续写、润色、摘要、格式调整等快速指令
- 内联编辑、AI 操作菜单和 Ghost Text 轻量补全
- RAG 检索，发送前可索引当前未保存文档
- 智能粘贴：富文本清理并转换为 Markdown
- 语音输入
- 图片拖拽插入并执行 OCR
- PDF 拖拽文字提取
- OCR/PDF 失败时提供用户可见错误提示

### 导出、模板与历史

- 导出 Markdown、HTML、纯文本
- HTML 导出文件名规范化、危险内容清理和目录锚点
- 模板库快速创建文档
- 今日笔记命令
- 版本历史保存、预览和恢复

### UI 与可访问性

- 深色优先的 Obsidian 风格工作台
- 响应式欢迎页、侧边栏抽屉、命令面板和弹窗
- 窄屏工具栏横向滚动，避免页面横向溢出
- 图标按钮 aria-label、命令面板 role/aria-selected、移动端触控尺寸
- localStorage 不可用时仍可进入基础工作流

## 技术栈

- Vue 3 + TypeScript + Vite
- Electron
- CodeMirror 6
- Pinia
- Markdown-it + Highlight.js
- Mermaid + KaTeX
- Dexie / IndexedDB
- D3.js
- Tesseract.js
- pdf.js

## 开发

```bash
npm install
npm run dev
npm run electron:dev
npm run typecheck
npm run build
npx playwright test
```

## 未来愿景

- 真实文件系统 Vault
- 跨设备同步
- 插件与主题市场
- 数据库视图与查询
- 块级引用和嵌入
- Canvas 白板
- 移动端应用

## License

MIT
