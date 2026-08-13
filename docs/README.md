# AeroMind 能力文档

> AI Native 笔记应用 — Sliding Panes + 实体识别 + 语义上下文 + 插件系统
> 本文档描述代码库**当前**的实际能力（基于 `lib/` 源码与测试）。

## 文档索引

| 文档 | 内容 |
|---|---|
| [architecture.md](architecture.md) | 三层 feature-based 架构、目录结构、设计模式 |
| [features.md](features.md) | 功能能力清单（编辑器、AI、图谱、侧边栏等） |
| [plugin-system.md](plugin-system.md) | 插件系统（扩展点、生命周期、API、内置插件） |
| [providers.md](providers.md) | Riverpod 状态管理层 |
| [storage.md](storage.md) | Local-First 存储策略 |
| [shortcuts.md](shortcuts.md) | 全局快捷键与命令面板命令 |
| [development.md](development.md) | 开发命令、测试覆盖、代码规范 |

## 能力总览

| 能力 | 状态 | 说明 |
|---|---|---|
| Sliding Panes | ✅ 已实现 | Andy Matuschak 风格横向滑动面板，最多 2 个可见面板 |
| 双模式编辑器 | ✅ 已实现 | source / livePreview / preview 三模式 + Markdown 语法高亮 |
| Wiki 链接补全与预览 | ✅ 已实现 | `[[` 输入触发补全，悬停显示预览卡片 |
| 实体识别 | ✅ 已实现 | 本地规则 / 远程 LLM / 混合三策略，500ms 防抖 |
| 预测链接推荐 | ✅ 已实现 | TF-IDF 简化版相似度评分，最多 5 条 |
| 知识图谱 | ✅ 已实现 | 力导向布局，最多 50 节点，圆形展开动画 |
| 命令面板 | ✅ 已实现 | VS Code 风格，约 60 条内置命令 + 插件命令 |
| Quick Switcher | ✅ 已实现 | Obsidian 风格模糊跳转 |
| 模板系统 | ✅ 已实现 | 6 内置模板 + `{{variable}}` 语法 |
| 日记系统 | ✅ 已实现 | 按日创建 + 日历视图 + 自动链前一天/后一天 |
| 侧边栏 | ✅ 已实现 | 10 个视图（树/搜索/标签/最近/插件/大纲/反向链接/任务/回收站/日历） |
| 反向链接 | ✅ 已实现 | linked + unlinked mentions |
| 回收站 | ✅ 已实现 | 30 天自动清理 |
| Mermaid 渲染 | ✅ 已实现 | mermaid.ink 在线渲染，8 种图表 |
| AI 对话面板 | ✅ 已实现 | 基于 AiChatPlugin + LLM，多轮对话 |
| Git 远程备份 | ✅ 已实现 | init/backup/restore/history，参数校验 |
| 导入导出 | ✅ 已实现 | TXT/HTML/JSON 单篇与全库，JSON 导入 |
| 版本历史 | ✅ 已实现 | 每笔记 20 个快照 |
| 插件系统 | ✅ 已实现 | 10 种扩展点，5 个内置插件，隔离存储 |
| 语义搜索（Isar 向量索引） | ⚠️ 待完善 | Isar 依赖已声明但未接通，`searchBySemantic` 为 Hive 全量遍历 |
| Web 端远程 LLM | ⚠️ 部分受限 | Web 平台 LLM 客户端为回退实现，远程识别与 AI 对话不可用 |
| 国际化 (i18n) | ⬜ 未实现 | 界面文案为中文硬编码 |

## 关键说明

- 实体类型为 **5 种**（`concept / person / task / quote / reference`），本地识别规则 **7 条**（其中 3 条映射到 concept）。
- AI 对话的 LLM 配置位于插件存储（`plugin_com.aeromind.ai-chat`），与设置页 AI 区的全局 LLM 配置（用于远程实体识别）相互独立。
- Git 远程恢复（`restore`）仅将远端代码 pull 到 vault 目录，未反向同步回 Hive 本地库。
- 界面文案与代码注释均使用中文。