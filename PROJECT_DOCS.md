# AI Native Markdown Editor

> Status: historical document. This file contains older Tauri-era architecture notes and is no longer the current source of truth. For the current Electron + IndexedDB architecture, see `docs/current-architecture.md`.

一个 AI 原生的 Markdown 编辑器，基于 Tauri + Vue 3 + CodeMirror 6 构建。

---

## 功能特性

### 核心功能
1. **实时 Markdown 编辑与预览**
   - 源码模式和预览模式切换
   - 所见即所得的编辑体验

2. **AI 辅助写作**
   - AI 聊天面板集成
   - 支持本地 Ollama 模型和云端 API（OpenAI、DeepSeek）
   - 续写、润色、摘要、格式调整等 AI 功能
   - 流式输出体验
   - Ghost Text 智能补全
   - Inline Edit 内联编辑

3. **文件管理**
   - 本地文件系统集成（通过 Tauri）
   - 文件树浏览
   - 文件搜索（文件名和内容）
   - 新建/重命名/删除文件

4. **知识图谱**
   - 自动构建文档间的知识关联
   - 可视化展示
   - 支持从图谱跳转至文档

5. **RAG (Retrieval-Augmented Generation)**
   - 本地文档向量化索引
   - 智能检索相关文档片段
   - 增强 AI 写作的上下文理解

### 增强特性
- **实时预览**：边写边看效果
- **智能粘贴**：自动识别并格式化粘贴的内容
- **多模态支持**：图片拖拽上传、OCR 识别
- **语音输入**：支持语音转文字
- **导出功能**：支持导出为 Markdown 和 HTML
- **主题切换**：深色/浅色主题
- **状态栏**：显示字数、行数、光标位置等信息
- **标签页**：支持多文档同时打开

---

## UI 设计

### 整体布局
采用经典的三栏式布局，可灵活调整：

```
┌─────────────────────────────────────────────────────────────┐
│  标题栏 (Header)                                              │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│  侧边栏       │          主编辑区域                        │
│  (Sidebar)    │                                             │
│               │                                             │
│  - 文件       │                                             │
│  - 知识图谱   │                                             │
│  - AI 配置    │                                             │
│  - 设置       │                                             │
│               │                                             │
├───────────────┴─────────────────────────────────────────────┤
│  状态栏 (Status Bar)                                         │
└─────────────────────────────────────────────────────────────┘
```

### 详细组件设计

#### 1. 标题栏 (Header)
- **左侧**：侧边栏开关按钮 + 应用品牌标识
- **中间**：当前打开文件名（可选）
- **右侧**：
  - AI 面板开关
  - 视图模式切换（源码/预览）
  - 导出菜单
  - 主题切换按钮

#### 2. 侧边栏 (Sidebar)
左侧侧边栏包含四个标签页：

**文件管理**
- 工作区选择按钮
- 搜索框（支持文件名搜索和内容搜索切换）
- 文件树（支持展开/折叠、新建、重命名、删除）
- 搜索结果展示

**知识图谱**
- 可视化展示文档间的关联关系
- 节点点击跳转至对应文档

**AI 配置**
- 提供商选择：Ollama（本地）/ OpenAI / DeepSeek
- 服务地址配置
- API Key 输入
- 模型选择
- 温度参数调节
- 连接测试按钮
- 连接状态显示

**设置**
- 主题切换
- AI 助手开关
- 关于信息

#### 3. 主编辑区域
- **标签页栏**：显示所有打开的文档标签，支持关闭
- **编辑器**：
  - CodeMirror 6 编辑器
  - Markdown 语法高亮
  - 工具栏（粗体、斜体、删除线、标题、列表、链接、图片等）
  - 行号显示
- **AI 面板**（底部，可折叠）：
  - 聊天对话窗口
  - 消息输入框
  - 可调整高度的分隔条

#### 4. 状态栏 (Status Bar)
- Markdown 标识
- 光标位置（行号）
- 保存状态提示
- 已修改提示
- 视图模式指示（可点击切换）
- 字符数统计
- AI 连接状态（脉冲圆点）

### 设计系统

#### 颜色方案
- **主色调**：蓝色系 (`var(--accent-primary)`)
- **背景色**：
  - 基础背景 `var(--bg-base)`
  - 抬升背景 `var(--bg-elevated)`
  - 表面背景 `var(--bg-surface)`
- **文字色**：
  - 主要 `var(--text-primary)`
  - 次要 `var(--text-secondary)`
  - 禁用 `var(--text-muted)`
- **边框色**：`var(--border-subtle)`、`var(--border-default)`
- **功能色**：成功、警告、错误、信息

#### 字体
- **无衬线**：`var(--font-sans)` - UI 文本
- **等宽**：`var(--font-mono)` - 编辑器和代码
- 字号范围：10px - 15px（根据用途）

#### 间距系统
- 基于 4px 网格系统
- 预定义变量：`--space-1` (4px) 到 `--space-8` (32px)

#### 圆角
- `--radius-sm` (4px)
- `--radius-md` (6px)
- `--radius-lg` (8px)

#### 动画
- 基础过渡：`var(--duration-fast)` (150ms)
- 标准过渡：`var(--duration-normal)` (250ms)
- 慢速过渡：`var(--duration-slow)` (350ms)
- 缓动函数：`--ease-default`、`--ease-enter`、`--ease-spring`

#### 阴影
- 小阴影：`var(--shadow-sm)`
- 中阴影：`var(--shadow-md)`
- 大阴影：`var(--shadow-lg)`
- 发光效果：`var(--shadow-glow)`

---

## 技术栈

### 前端
- **框架**：Vue 3 (Composition API)
- **类型系统**：TypeScript
- **构建工具**：Vite
- **状态管理**：Pinia
- **编辑器**：CodeMirror 6
- **Markdown 解析**：markdown-it
- **语法高亮**：highlight.js
- **数学公式**：KaTeX
- **图表**：mermaid、d3.js
- **UI 组件**：自定义组件（无第三方 UI 库）

### 桌面端
- **框架**：Tauri 2.0
- **后端语言**：Rust
- **插件**：
  - dialog（文件选择对话框）
  - fs（文件系统）
  - notification（通知）
  - process（进程）
  - shell（系统调用）
  - store（本地存储）

### AI 服务
- **本地**：Ollama
- **云端**：OpenAI API、DeepSeek API
- **流式输出**：支持 SSE (Server-Sent Events)

---

## 项目结构

```
ai-native-markdown/
├── src/
│   ├── components/
│   │   ├── ai-panel/          # AI 聊天面板组件
│   │   ├── editor/            # 编辑器相关组件
│   │   ├── knowledge/         # 知识图谱组件
│   │   ├── preview/           # 预览组件
│   │   ├── App.vue            # 根组件
│   │   ├── Editor.vue         # 编辑器主组件
│   │   └── Sidebar.vue        # 侧边栏组件
│   ├── composables/           # Vue 组合式函数
│   │   ├── useRAG.ts          # RAG 功能
│   │   ├── useKnowledgeGraph.ts
│   │   └── ...
│   ├── extensions/            # CodeMirror 扩展
│   │   ├── ai-actions/        # AI 动作插件
│   │   ├── ghost-text/        # 幽灵文本补全
│   │   ├── inline-edit/       # 内联编辑
│   │   ├── live-preview/      # 实时预览
│   │   ├── multimodal/        # 多模态支持
│   │   └── smart-paste/       # 智能粘贴
│   ├── plugins/               # 插件
│   ├── services/              # 服务层
│   │   └── ai.ts              # AI 服务
│   ├── stores/                # Pinia 状态管理
│   ├── types/                 # TypeScript 类型定义
│   ├── utils/                 # 工具函数
│   ├── App.vue                # 应用根组件
│   ├── main.ts                # 应用入口
│   └── style.css              # 全局样式
├── src-tauri/                 # Tauri Rust 后端
│   ├── src/
│   │   ├── commands/          # Tauri 命令
│   │   │   ├── embedding.rs   # 向量化
│   │   │   ├── rag.rs         # RAG 检索
│   │   │   └── ...
│   │   ├── db/                # 数据库
│   │   └── main.rs            # Rust 入口
│   └── Cargo.toml
├── design-system/             # 设计系统文档
├── docs/                      # 项目文档
└── package.json
```

---

## 核心模块说明

### AI 服务 (src/services/ai.ts)
- 支持多种 AI 提供商：Ollama、OpenAI、DeepSeek
- 统一的 Provider 接口
- 连接状态管理
- 流式和非流式对话支持
- 配置持久化

### RAG 系统 (src/composables/useRAG.ts)
- 文档向量化索引
- 相似度检索
- 上下文构建
- 与 AI 对话集成

### 编辑器扩展
- **Ghost Text**：AI 智能补全，灰色提示文本
- **Inline Edit**：选中文本后 AI 重写建议
- **AI Actions**：编辑器内快捷 AI 操作菜单
- **Live Preview**：实时 Markdown 渲染装饰
- **Smart Paste**：智能格式化粘贴内容
- **Multimodal**：图片拖拽、OCR 识别

---

## 使用流程

### 1. 初始设置
1. 打开应用
2. 选择工作区文件夹
3. 配置 AI 服务（本地 Ollama 或云端 API）
4. 测试连接

### 2. 日常使用
1. 在侧边栏浏览或创建 Markdown 文件
2. 在编辑器中写作
3. 使用工具栏格式化文本
4. 开启 AI 面板获得写作帮助
5. 利用知识图谱管理文档关联
6. 自动保存或手动保存文档
7. 需要时导出为 HTML 或 Markdown

---

## 快捷键（待完善）

- `Ctrl/Cmd + B`：粗体
- `Ctrl/Cmd + I`：斜体
- `Ctrl/Cmd + Shift + E`：切换侧边栏
- `Ctrl/Cmd + Shift + A`：切换 AI 面板
- `Ctrl/Cmd + 1/2`：切换视图模式

---

## 开发计划（未来方向）

- [ ] 更多 AI 模型支持
- [ ] 协作编辑功能
- [ ] 版本控制集成
- [ ] 更多导出格式（PDF、Word）
- [ ] 移动端适配
- [ ] 插件系统
- [ ] 云同步功能
