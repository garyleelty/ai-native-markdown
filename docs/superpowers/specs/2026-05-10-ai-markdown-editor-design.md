# AI Native Markdown Editor - 重构设计文档

**日期**: 2026-05-10
**版本**: v1.0
**状态**: 草案待审批

---

## 1. 产品概述

### 1.1 产品定位

AI Native Markdown Editor 是一款面向知识工作者的全平台 Markdown 编辑器，深度融合 AI 能力，支持本地优先的文件管理、知识库构建和定时任务自动化。

### 1.2 目标用户

- 技术写作者、开发者文档维护者
- 知识管理爱好者（PKM 实践者）
- 需要本地优先、隐私安全的内容创作者
- 跨设备工作的移动办公用户

### 1.3 核心价值主张

> "你的知识，本地掌控，AI 赋能，全平台随行。"

---

## 2. 架构设计

### 2.1 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| **桌面端** | Tauri 2.0 | Rust 后端 + 系统 WebView |
| **移动端** | Tauri 2.0 Mobile | iOS/Android 原生插件 |
| **前端框架** | Vue 3 + TypeScript | 组合式 API + 严格类型 |
| **构建工具** | Vite 6 | 极速开发体验 |
| **状态管理** | Pinia | 类型安全的状态管理 |
| **编辑器** | CodeMirror 6 | 专业级文本编辑 |
| **预览渲染** | Markdown-it + Highlight.js | 标准 Markdown + 代码高亮 |
| **样式方案** | CSS Variables + Tailwind CSS | 主题系统 + 原子化样式 |
| **后端语言** | Rust | 性能、安全、跨平台 |

### 2.2 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端层 (Vue 3 + TS)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 编辑器    │  │ 预览面板  │  │ 文件管理  │  │ AI 面板   │   │
│  │CodeMirror│  │Markdown-it│  │ 文件树   │  │对话/补全 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 知识图谱  │  │ 定时任务  │  │ 设置面板  │  │ 主题系统  │   │
│  │ 双向链接  │  │ 调度器   │  │ 配置管理  │  │ 明暗切换  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Tauri Bridge    │
                    │  (IPC / Commands) │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      后端层 (Rust)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 文件系统  │  │ AI 服务   │  │ 定时任务  │  │ 配置存储  │   │
│  │ 读写管理  │  │ 本地/云端 │  │ 调度引擎  │  │ SQLite   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ 安全权限  │  │ 跨平台   │  │ 系统通知  │                  │
│  │ 沙箱模型  │  │ 抽象层   │  │ 定时提醒  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 模块边界

| 模块 | 职责 | 依赖 |
|------|------|------|
| `editor-core` | 文本编辑、语法高亮、快捷键 | 无 |
| `preview-engine` | Markdown 渲染、数学公式、图表 | `editor-core` |
| `file-manager` | 文件树、读写、监听、搜索 | `tauri-fs` |
| `ai-service` | AI 配置、对话、补全、润色 | `file-manager` |
| `knowledge-base` | 双向链接、图谱、标签 | `file-manager` |
| `task-scheduler` | 定时任务、提醒、自动化 | `tauri-notification` |
| `theme-system` | 明暗主题、自定义配色 | 无 |
| `settings-manager` | 配置持久化、导入导出 | `tauri-store` |

---

## 3. 功能设计

### 3.1 MVP 功能清单

#### 3.1.1 编辑器核心 (Editor Core)

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 实时编辑与预览 | P0 | 分栏/纯编辑/纯预览三模式 |
| 语法高亮 | P0 | Markdown + 代码块高亮 |
| 快捷键系统 | P0 | Vim/Emacs/Sublime 模式可选 |
| 搜索替换 | P0 | 支持正则、全局搜索 |
| 大纲导航 | P0 | 基于标题的文档结构 |
| 多标签页 | P1 | 同时打开多个文件 |
| 版本历史 | P2 | 本地自动保存的历史版本 |

#### 3.1.2 文件管理 (File Manager)

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 文件夹打开 | P0 | 本地文件夹选择、最近打开 |
| 文件树浏览 | P0 | 树形结构、拖拽排序 |
| 文件搜索 | P0 | 全文搜索、文件名搜索 |
| 新建/重命名/删除 | P0 | 基础文件操作 |
| 文件监听 | P1 | 外部修改自动同步 |
| 工作区切换 | P1 | 多个工作区快速切换 |

#### 3.1.3 AI 功能 (AI Service)

| 功能 | 优先级 | 说明 |
|------|--------|------|
| AI 对话面板 | P0 | 侧边栏对话、上下文感知 |
| 续写/润色 | P0 | 选中文字后 AI 处理 |
| 智能补全 | P1 | 行内 Ghost 文本提示 |
| 摘要生成 | P1 | 自动生成文档摘要 |
| 格式调整 | P1 | AI 自动排版 |
| 多 Provider 支持 | P0 | OpenAI/Ollama/DeepSeek 等 |

#### 3.1.4 知识库 (Knowledge Base)

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 双向链接 | P0 | `[[文件名]]` 语法 |
| 知识图谱 | P1 | 可视化关系图 |
| 标签系统 | P1 | #标签 分类管理 |
| 每日笔记 | P2 | 自动创建日期笔记 |

#### 3.1.5 定时任务 (Task Scheduler)

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 任务创建 | P0 | 定时执行、循环执行 |
| 任务类型 | P0 | 备份、提醒、AI 处理 |
| 通知提醒 | P0 | 系统通知、声音提醒 |
| 执行日志 | P1 | 历史记录查看 |

### 3.2 功能流程图

#### 文件打开流程

```
用户点击"打开文件夹"
    │
    ▼
┌──────────────┐
│ 调用 Tauri   │
│ dialog.open  │
│ (directory)  │
└──────────────┘
    │
    ▼
┌──────────────┐
│ Rust 后端    │
│ read_dir()   │
│ 遍历目录     │
└──────────────┘
    │
    ▼
┌──────────────┐
│ 过滤 .md     │
│ 构建文件树   │
└──────────────┘
    │
    ▼
┌──────────────┐
│ Vue 渲染     │
│ 文件树组件   │
└──────────────┘
```

#### AI 对话流程

```
用户输入问题
    │
    ▼
┌──────────────┐
│ 构建 Prompt  │
│ 注入上下文   │
│ (当前文档)   │
└──────────────┘
    │
    ▼
┌──────────────┐
│ 调用 AI      │
│ Provider     │
│ (流式响应)   │
└──────────────┘
    │
    ▼
┌──────────────┐
│ 实时渲染     │
│ 打字机效果   │
└──────────────┘
    │
    ▼
┌──────────────┐
│ 用户可选择   │
│ 插入/复制    │
└──────────────┘
```

---

## 4. 数据模型

### 4.1 核心数据结构

```typescript
// 文件项
interface FileItem {
  id: string           // 唯一标识 (路径哈希)
  name: string         // 文件名
  path: string         // 绝对路径
  parentPath: string   // 父目录路径
  isDirectory: boolean // 是否文件夹
  isMarkdown: boolean  // 是否为 Markdown
  modifiedAt: number   // 修改时间戳
  size: number         // 文件大小
}

// 文档元数据 (存储在 SQLite)
interface DocumentMeta {
  path: string         // 文件路径
  title: string        // 文档标题 (H1)
  summary: string      // AI 生成的摘要
  tags: string[]       // 标签列表
  links: string[]      // 双向链接
  backlinks: string[]  // 反向链接
  createdAt: number    // 创建时间
  updatedAt: number    // 更新时间
  readTime: number     // 预计阅读时间
}

// AI 配置
interface AIConfig {
  provider: 'ollama' | 'openai' | 'deepseek' | 'custom'
  baseURL: string
  apiKey?: string
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
}

// 定时任务
interface ScheduledTask {
  id: string
  name: string
  type: 'backup' | 'reminder' | 'ai-process'
  cron: string         // Cron 表达式
  enabled: boolean
  lastRun: number
  nextRun: number
  config: TaskConfig   // 任务特定配置
}
```

### 4.2 存储策略

| 数据类型 | 存储方式 | 说明 |
|----------|----------|------|
| Markdown 文件 | 本地文件系统 | 用户指定的文件夹 |
| 文档元数据 | SQLite (Tauri) | 索引、标签、链接 |
| 应用配置 | Tauri Store | 设置、主题、AI 配置 |
| 版本历史 | 本地 .git 或快照 | 自动保存的历史 |
| 任务调度 | SQLite + 系统定时器 | 持久化 + 触发 |

---

## 5. 界面设计

### 5.1 布局架构

```
┌─────────────────────────────────────────────────────────────┐
│  标题栏 (Title Bar)                                          │
│  [菜单] [品牌]        [文件名]        [AI] [预览] [主题]    │
├──────────┬──────────────────────────────┬───────────────────┤
│          │                              │                   │
│  侧边栏   │      编辑器区域               │    预览/AI 面板   │
│          │                              │                   │
│  [文件]   │    ┌──────────────────┐    │   ┌───────────┐  │
│  [搜索]   │    │                  │    │   │ 预览渲染   │  │
│  [图谱]   │    │   CodeMirror     │    │   │           │  │
│  [任务]   │    │                  │    │   ├───────────┤  │
│  [设置]   │    │                  │    │   │ AI 对话   │  │
│          │    └──────────────────┘    │   │ 面板      │  │
│          │                              │   └───────────┘  │
├──────────┴──────────────────────────────┴───────────────────┤
│  状态栏 (Status Bar)                                         │
│  [行号:列号] [字数] [当前文件] [AI 状态] [同步状态]          │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 响应式断点

| 断点 | 宽度 | 布局调整 |
|------|------|----------|
| Desktop | > 1200px | 三栏布局 (侧边栏 + 编辑器 + 预览) |
| Tablet | 768-1200px | 双栏布局 (侧边栏 + 编辑器/预览切换) |
| Mobile | < 768px | 单栏布局 (底部 Tab 切换不同视图) |

### 5.3 主题系统

```css
:root {
  /* 基础色板 */
  --bg-primary: #1e1e2e;
  --bg-secondary: #313244;
  --bg-surface: #45475a;
  --text-primary: #cdd6f4;
  --text-secondary: #a6adc8;
  --text-muted: #6c7086;
  --accent: #89b4fa;
  --accent-hover: #b4befe;
  --border: #313244;
  --error: #f38ba8;
  --success: #a6e3a1;
  --warning: #f9e2af;
  
  /* 字体 */
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-sans: 'Inter', -apple-system, sans-serif;
  
  /* 间距 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  /* 动画 */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}

/* 亮色主题 */
[data-theme="light"] {
  --bg-primary: #eff1f5;
  --bg-secondary: #e6e9ef;
  --bg-surface: #ccd0da;
  --text-primary: #4c4f69;
  --text-secondary: #5c5f77;
  --text-muted: #8c8fa1;
  --accent: #1e66f5;
  --accent-hover: #7287fd;
  --border: #ccd0da;
}
```

---

## 6. 错误处理

### 6.1 错误分类

| 类别 | 示例 | 处理策略 |
|------|------|----------|
| 文件系统错误 | 权限不足、文件不存在 | 用户提示 + 重试机制 |
| 网络错误 | AI API 超时、断网 | 离线队列 + 自动重连 |
| AI 错误 | 模型不可用、Token 超限 | 降级提示 + 备选模型 |
| 渲染错误 | Markdown 解析失败 | 安全降级 + 错误边界 |
| 系统错误 | 内存不足、磁盘满 | 优雅退出 + 数据保护 |

### 6.2 错误边界设计

```typescript
// 全局错误处理
class AppErrorBoundary {
  // 捕获 Vue 组件错误
  handleComponentError(error: Error, vm: Component, info: string) {
    logError('component', error, { component: vm.$options.name, info })
    this.showErrorToast('组件渲染出错，请刷新重试')
  }
  
  // 捕获 Tauri 命令错误
  async handleCommandError<T>(promise: Promise<T>): Promise<T | null> {
    try {
      return await promise
    } catch (error) {
      logError('command', error)
      this.showErrorDialog(this.parseError(error))
      return null
    }
  }
  
  // 错误分类解析
  parseError(error: unknown): UserError {
    if (error instanceof TauriError) {
      return { type: 'system', message: error.message, recoverable: true }
    }
    if (error instanceof NetworkError) {
      return { type: 'network', message: '网络连接失败', recoverable: true }
    }
    return { type: 'unknown', message: '未知错误', recoverable: false }
  }
}
```

---

## 7. 安全设计

### 7.1 安全原则

1. **本地优先**: 所有 Markdown 文件本地存储，不上传云端
2. **最小权限**: Tauri 权限模型，仅申请必要权限
3. **数据加密**: 敏感配置（API Key）本地加密存储
4. **输入校验**: 所有用户输入严格校验，防止注入攻击
5. **安全更新**: 自动更新签名验证

### 7.2 权限模型

```rust
// Tauri 能力配置
capabilities: [
  {
    identifier: "file-manager",
    description: "文件系统读写",
    permissions: ["fs:read", "fs:write", "fs:allow-read-dir"],
    allow: [{ path: "$HOME/**" }, { path: "$DOCUMENT/**" }]
  },
  {
    identifier: "ai-communication",
    description: "AI 服务网络通信",
    permissions: ["http:allow"],
    allow: [{ url: "https://api.openai.com" }, { url: "http://localhost:*" }]
  },
  {
    identifier: "notification",
    description: "系统通知",
    permissions: ["notification:allow"]
  }
]
```

### 7.3 数据加密

```rust
// API Key 加密存储
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, NewAead};

fn encrypt_api_key(key: &str, master_password: &str) -> Vec<u8> {
  let cipher = Aes256Gcm::new(Key::from_slice(&derive_key(master_password)));
  let nonce = Nonce::from_slice(&generate_nonce());
  cipher.encrypt(nonce, key.as_bytes()).unwrap()
}
```

---

## 8. 性能指标

### 8.1 目标性能

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 启动时间 | < 2s | 点击图标到可交互 |
| 文件打开 | < 100ms | 点击文件到显示内容 |
| 编辑器输入延迟 | < 16ms | 打字无卡顿 |
| 预览渲染 | < 50ms | 输入停止到预览更新 |
| 大文件处理 | 支持 10MB+ | 10MB 文件流畅编辑 |
| 内存占用 | < 200MB | 桌面端典型使用 |
| 搜索响应 | < 200ms | 1000 文件全文搜索 |

### 8.2 优化策略

1. **虚拟滚动**: 大文件使用虚拟滚动，只渲染可视区域
2. **防抖节流**: 预览渲染、搜索输入防抖 150ms
3. **Web Worker**: Markdown 解析、AI 请求在 Worker 中执行
4. **增量更新**: 只更新变更部分，不重新渲染整个文档
5. **懒加载**: 知识图谱、版本历史按需加载
6. **缓存策略**: 文件内容、渲染结果多级缓存

---

## 9. 测试策略

### 9.1 测试金字塔

```
        ┌─────────┐
        │  E2E    │  10%  (Playwright)
        │  端到端  │
       ┌┴─────────┴┐
       │ Integration│  20%  (Vitest)
       │   集成测试  │
      ┌┴─────────────┴┐
      │    Unit        │  70%  (Vitest)
      │    单元测试     │
      └─────────────────┘
```

### 9.2 测试覆盖

| 模块 | 单元测试 | 集成测试 | E2E 测试 |
|------|----------|----------|----------|
| 编辑器 | 语法高亮、快捷键、撤销重做 | 与预览同步 | 完整编辑流程 |
| 文件管理 | 文件树构建、路径处理 | 与 Tauri 集成 | 打开/保存文件 |
| AI 服务 | Prompt 构建、响应解析 | Provider 切换 | 对话流程 |
| 知识库 | 链接解析、图谱构建 | 索引更新 | 双向链接跳转 |
| 定时任务 | Cron 解析、任务执行 | 通知触发 | 创建/执行/提醒 |

### 9.3 兼容性测试

| 平台 | 浏览器/环境 | 测试重点 |
|------|-------------|----------|
| macOS | Safari, Chrome, Tauri | 原生菜单、文件拖拽 |
| Windows | Edge, Chrome, Tauri | 路径处理、编码 |
| Linux | Firefox, Chrome, Tauri | 文件权限、字体 |
| iOS | Safari, Tauri | 触摸交互、键盘 |
| Android | Chrome, Tauri | 返回键、软键盘 |

---

## 10. 开发计划

### 10.1 里程碑

| 阶段 | 时间 | 目标 | 交付物 |
|------|------|------|--------|
| **M1** | 第 1-2 周 | 基础架构 | 项目脚手架、构建流程、主题系统 |
| **M2** | 第 3-4 周 | 编辑器核心 | CodeMirror 集成、预览、文件管理 |
| **M3** | 第 5-6 周 | AI 集成 | 对话面板、多 Provider、补全 |
| **M4** | 第 7-8 周 | 知识库 | 双向链接、图谱、标签 |
| **M5** | 第 9-10 周 | 定时任务 | 调度器、通知、自动化 |
| **M6** | 第 11-12 周 | 打磨发布 | 性能优化、测试、文档、打包 |

### 10.2 目录结构

```
ai-native-markdown/
├── src/
│   ├── components/          # Vue 组件
│   │   ├── editor/          # 编辑器相关
│   │   ├── preview/         # 预览相关
│   │   ├── file-manager/    # 文件管理
│   │   ├── ai-panel/        # AI 面板
│   │   ├── knowledge/       # 知识库
│   │   ├── task-scheduler/  # 定时任务
│   │   └── ui/              # 通用 UI 组件
│   ├── composables/         # 组合式函数
│   ├── stores/              # Pinia 状态管理
│   ├── services/            # 业务服务
│   ├── utils/               # 工具函数
│   ├── types/               # TypeScript 类型
│   ├── styles/              # 全局样式
│   └── App.vue              # 根组件
├── src-tauri/               # Tauri Rust 后端
│   ├── src/
│   │   ├── commands/        # IPC 命令
│   │   ├── services/        # 后端服务
│   │   ├── models/          # 数据模型
│   │   ├── db/              # 数据库
│   │   └── main.rs          # 入口
│   └── capabilities/        # 权限配置
├── tests/                   # 测试文件
├── docs/                    # 文档
└── scripts/                 # 构建脚本
```

---

## 11. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Tauri 2.0 移动端不稳定 | 高 | 中 | 准备 Capacitor 备选方案 |
| CodeMirror 6 移动端兼容 | 中 | 中 | 早期移动端原型验证 |
| AI 响应延迟影响体验 | 中 | 高 | 流式输出 + 本地缓存 |
| 大文件性能问题 | 高 | 中 | 虚拟滚动 + 增量解析 |
| 跨平台文件路径差异 | 中 | 高 | 统一路径抽象层 |

---

## 12. 附录

### 12.1 术语表

| 术语 | 说明 |
|------|------|
| PKM | Personal Knowledge Management，个人知识管理 |
| Tauri | Rust 编写的跨平台桌面应用框架 |
| CodeMirror | 专业级 Web 文本编辑器 |
| Markdown-it | 高性能 Markdown 解析器 |
| Pinia | Vue 官方推荐的状态管理库 |
| Cron | 定时任务表达式格式 |

### 12.2 参考资源

- [Tauri 2.0 文档](https://tauri.app/)
- [Vue 3 组合式 API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [CodeMirror 6 文档](https://codemirror.net/docs/)
- [Markdown-it 插件](https://github.com/markdown-it/markdown-it)

---

**文档状态**: 草案 v1.0
**最后更新**: 2026-05-10
**作者**: AI Assistant
