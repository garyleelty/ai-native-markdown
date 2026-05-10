# AI Native Markdown

一个 AI 原生的 Markdown 编辑器，基于 Tauri + Vue 3 + CodeMirror 6 构建。

## 功能特性

- 📝 实时 Markdown 编辑与预览
- 🤖 AI 辅助写作（续写、润色、摘要、格式调整）
- 📁 本地文件管理
- 🎨 简洁现代的界面设计（暗色/亮色主题）
- 🔒 数据安全保护（本地优先，支持离线 AI 模型）
- ↔️ 可折叠三栏布局，支持拖拽调整宽度

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite
- **桌面端**: Tauri 2.0 (Rust)
- **编辑器**: CodeMirror 6
- **预览**: Markdown-it + Highlight.js
- **状态管理**: Pinia

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建 Tauri 应用
npm run tauri build
```

## AI 支持

- 云端 API: OpenAI、Claude、Gemini 等
- 本地模型: Ollama、LM Studio
- 用户可自由切换和配置

## License

MIT
