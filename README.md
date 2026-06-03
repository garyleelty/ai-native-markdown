# AI Native Markdown

一个本地优先的 AI Markdown 桌面编辑器，基于 Electron + Vue 3 + CodeMirror 6 构建，重点放在写作、整理和知识连接。

## 当前定位

这个项目不是 Obsidian 的完整替代品，而是一个围绕 AI 辅助写作和 Markdown 工作流打造的桌面应用。数据主要保存在本地，适合个人写作、笔记整理和轻量知识库管理。

## 已支持功能

### 文件与工作区

- 基于 IndexedDB 的本地虚拟工作区
- 导入本地文件夹或 Markdown 文件到虚拟工作区
- 新建、重命名、删除文件和文件夹
- 最近打开记录
- 示例工作区
- 文件名搜索与内容搜索

### 编辑与预览

- CodeMirror 6 编辑器
- 源码 / 预览 / 分屏模式
- Markdown 工具栏快捷操作：加粗、斜体、删除线、标题、代码块、引用、列表、链接、图片
- 实时预览
- Mermaid 图表渲染
- KaTeX 数学公式
- 任务列表、标题锚点、Wiki Link 识别
- 大纲、文档统计、查找替换
- 自动换行、专注模式、Markdown 速查表
- 版本历史与恢复
- 文档导出：Markdown / HTML / 纯文本
- 模板库快速创建文档

### AI 与多模态

- 支持 Ollama 本地模型
- 支持 OpenAI-compatible 与 DeepSeek 接口配置
- AI 对话面板与快速指令
- 续写、润色、摘要、格式调整等写作辅助
- 轻量补全、内联编辑、AI 操作菜单
- 智能粘贴
- 语音输入
- 拖拽图片时插入图片并执行 OCR 识别
- PDF 文字提取服务已有实现，编辑器拖拽接入仍需完善

### 知识整理

- Frontmatter Properties 基础解析
- 标签识别
- 基于知识索引的 Backlinks 与 Unlinked mentions
- 基于 Wiki Link、别名和标签的基础知识图谱
- 文档统计与基础链接关系浏览

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
npm run build
npm run electron:build
npm run typecheck
```

## 未来愿景

- 真实文件系统 Vault 与跨设备同步
- 更完整的双向链接、Backlinks 与 Unlinked mentions 工作流
- Properties / Frontmatter 元数据编辑体验
- 更完整的全库搜索与查询
- 插件系统与主题扩展
- 移动端支持
- 块级引用、嵌入和 Canvas 视图

## License

MIT
