# AI Native Markdown

**An AI-native Markdown editor that keeps your writing on your machine.**

Built with Tauri 2 + Vue 3 + CodeMirror 6. Local-first: your files stay on
disk, and AI assist works with either cloud APIs or a local model through
Ollama / LM Studio — so it runs fully offline if you want it to.

## Features

- 📝 Live Markdown editing with synchronized preview
- 🤖 AI writing assist — continue, polish, summarize, reformat
- 📁 Local file management, no account required
- 🎨 Clean modern UI, dark and light themes
- 🔒 Local-first by default; offline models supported
- ↔️ Collapsible three-pane layout with draggable panes

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Vue 3 + TypeScript + Vite |
| Desktop | Tauri 2.0 (Rust) |
| Editor | CodeMirror 6 |
| Preview | Markdown-it + Highlight.js |
| State | Pinia |

## Getting started

```bash
npm install
npm run dev          # dev server
npm run tauri build  # desktop app
```

## AI providers

- **Cloud**: OpenAI, Claude, Gemini, and other OpenAI-compatible endpoints
- **Local**: Ollama, LM Studio
- Switch and configure freely in settings

## License

MIT

---

## 中文说明

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
