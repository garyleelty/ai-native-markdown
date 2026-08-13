# 功能能力清单

## 编辑器

| 能力 | 位置 | 说明 |
|---|---|---|
| 三模式编辑 | `features/editor/widgets/note_panel.dart` | `source`（源码）/ `livePreview`（实时预览）/ `preview`（只读） |
| Markdown 语法高亮 | `features/editor/services/syntax_highlighter.dart` | 源码模式 + 搜索关键词高亮 |
| 快捷操作 | `features/editor/services/editor_service.dart` | 10 种：加粗/斜体/行内代码/代码块/wiki 链接/外链/引用/任务/标题 |
| 统计 | 同上 | 中英文混合字数、阅读时长 |
| 自动保存 | 同上（`AutoSaveManager`） | 停止输入 2s 后触发 |
| Wiki 链接补全 | `features/editor/widgets/wiki_link_completer.dart` | 输入 `[[` 弹候选 |
| Wiki 链接悬停预览 | `features/editor/widgets/wiki_link_preview.dart` | 悬停显示目标笔记卡片 |
| 版本历史 | `features/editor/widgets/version_history_panel.dart` | 每笔记 20 个快照（`VersionService`） |

## AI

| 能力 | 位置 | 说明 |
|---|---|---|
| 实体识别 | `features/ai_engine/services/entity_recognizer.dart` | local / remote / hybrid，500ms 防抖 |
| 预测链接 | `core/models/predictive_link.dart` | 相似度评分，最多 5 条 |
| AI 对话面板 | `features/ai_chat/widgets/ai_chat_panel.dart` | 多轮对话、打字动画、输入草稿持久化 |

### 实体识别规则（7 条 → 5 种实体类型）

| 规则 | 实体类型 | 置信度 |
|---|---|---|
| `[[wiki links]]` | reference | 1.0 |
| `> blockquotes` | quote | 0.9 |
| `@人名` | person | 0.8 |
| `#tags` | concept | 0.85 |
| `- [ ] tasks` | task | 1.0 |
| `$math$` | concept | 0.7 |
| `日期时间戳` | concept | 0.6 |

远程策略：OpenAI 兼容 API，4000 字符截断，JSON 解析失败回退本地。混合模式远程优先 + 偏移去重。
注意：Web 平台 LLM 客户端为回退实现，远程识别与 AI 对话在 Web 不可用。

## 知识图谱

- 力导向布局（`features/knowledge_graph/services/graph_layout.dart`）：Coulomb 斥力 + Hooke 引力 + 中心重力 + 阻尼。
- 数据来源：当前面板笔记 + 链接笔记，最多 50 节点。
- 圆形展开动画（400ms `_CircleRevealClipper`），图例/统计/节点信息卡片。
- 空数据时展示 10 篇演示笔记。

## 侧边栏（10 视图）

| 视图 | 说明 |
|---|---|
| noteTree | 笔记树 |
| search | 全文搜索（支持 `title:`/`content:`/`tag:`/`path:`/`p:` 前缀 + `/regex/` 正则） |
| tags | 标签管理（增删改） |
| recent | 最近笔记 |
| plugins | 插件列表 |
| outline | 大纲 |
| backlinks | 反向链接（linked + unlinked mentions） |
| tasks | 任务视图（聚合 `- [ ]`，默认仅未完成，可点击勾选） |
| trash | 回收站（恢复/彻底删除/清空，30 天自动清理） |
| calendar | 日历视图 |

## 其他功能

| 能力 | 说明 |
|---|---|
| Sliding Panes | 最多 2 个可见面板，超出自动堆叠；面板可关闭/激活/拖动比例 |
| 命令面板 | ~60 条内置命令 + 插件命令，最近使用记录最多 10 条 |
| Quick Switcher | Obsidian 风格子序列模糊匹配，最近记录最多 10 条 |
| 模板画廊 | 6 个内置模板 + 自定义，`{{variable}}` 变量语法 |
| 日记系统 | 目录 `日记`，文件名 `{年}-{月}-{日}-{星期}`，自动链接前一天/后一天 |
| Mermaid | mermaid.ink 在线渲染，8 种图表类型，隐私需确认 |
| 导入导出 | 单篇 TXT/HTML/JSON + 全库 JSON + JSON 导入 |
| Git 备份 | init/backup/restore/history/配置，完整参数校验（拒绝 `-` 开头参数等） |
| 状态栏 | 面板数 · 活跃标题 · 激活插件数 |
| 欢迎页 | 首次启动自动创建「欢迎使用 AeroMind」示例笔记 |
| 快捷键速查表 | `?` 打开 |

## 已知限制（待完善）

- Isar 向量索引未接通：`NoteRepository.searchBySemantic` 实际为 Hive 全量遍历 + 子串匹配。
- Web 端：Git 备份全部禁用、远程 LLM 不可用。
- 国际化 (i18n) 未实现，界面文案为中文硬编码。
- Git `restore` 只 pull 到 vault 目录，不反向同步回 Hive。