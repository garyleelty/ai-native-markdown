# 存储策略（Local-First）

## 分层

| 层 | 技术 | 用途 |
|---|---|---|
| 文件系统 | `.md` 文件 | 原始 Markdown 内容（vault 默认 `~/Aeromind`，web 为 `/aeromind`） |
| Hive | KV 存储 | 笔记元数据 + 设置 + 插件存储（**当前实际存储**） |
| Isar | 本地 DB | 向量索引，语义搜索 —— **依赖已声明但未接通** |

## Hive Box 清单（`core/services/hive_service.dart`）

| Box | 用途 |
|---|---|
| `notes` | 笔记（LazyBox\<NoteModel\>，adapter typeId 0） |
| `meta` | 设置、Git 配置、`welcome_shown` 标记 |
| `versions` | 版本历史 |
| `trash` | 回收站 |
| `plugin_states` | 插件启用状态 |
| `plugin_<id>` | 每插件隔离的 KV 存储 |

## 文件系统同步（`core/services/file_service.dart`）

- `syncToFile` 将笔记同步为磁盘上的 `.md` 文件（仅非 Web 且有 filePath 时）。
- `_safePath` 路径穿越防护：`p.isWithin` 校验，非法路径抛 `SecurityException`。
- ID 生成：相对路径 hashCode base36（`generateId`）/ UUID v4（`generateNewId`）。

## 数据模型（`core/models/note_model.dart`）

`NoteModel` 字段：`id`（UUID v4）、`title`（H1 或文件名）、`rawMarkdown`、`filePath`、`createdAt`、`updatedAt`、`tags`、`backlinks`（指向本笔记的 `[[链接]]`）、`outgoingLinks`、`entities`（List\<EntityHighlight\>）、`folderPath`。

`EntityHighlight`：`startOffset / endOffset / type / label / confidence / linkedNoteId?`。

## 其它服务

| 服务 | 说明 |
|---|---|
| `SearchService` | `title:`/`content:`/`tag:`/`path:`/`p:` 前缀 + `/regex/` 正则，非法正则降级字面量 |
| `TaskService` | 全库聚合 `- [ ]` 任务 + 勾选切换 |
| `TrashService` | 回收站，30 天自动清理 |
| `VersionService` | 每笔记 20 个快照 |
| `GitBackupService` | init/commit/push/pull/clone/log/resetHard 等完整 git 操作 + 参数校验，Web 端全部禁用 |

## 已知限制

- `NoteRepository.searchBySemantic` 为 Hive 全量遍历 + 子串匹配，非向量检索。
- Git `restore` 仅 pull 到 vault 目录，不反向同步回 Hive。