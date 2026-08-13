# 语义引擎设计 — 本地向量模型驱动推荐与语义搜索

> 日期：2026-08-14
> 状态：已批准
> 模块：`lib/features/semantic_engine/`

## 背景

当前「AI 推荐关联」（`PredictiveLinkService`）是纯本地规则计算：TF-IDF 简化版关键词交集 + 标签 Jaccard + 标题包含性，本质是字符串匹配，换词即失效（如「水果」↔「苹果」）。本设计引入**可选的本地小模型**，用 embedding 向量做真语义推荐，并顺带接通语义搜索。

## 决策记录

| 决策 | 结论 |
|---|---|
| 目标平台 | 桌面 + 移动（macOS/Windows/Linux + iOS/Android），**无 Web** |
| 推理运行时 | `onnxruntime_v2`（活跃 fork，ORT 1.23.2，dart:ffi 全平台） |
| 模型档位 | 两档可选（默认轻量）：**轻量** `bge-small-zh-v1.5`（512 维，int8 ~25MB）/ **高质量** `bge-base-zh-v1.5`（768 维，int8 ~60MB） |
| 模型切换 | 换档 → 检测维度/版本不一致 → 自动全量重嵌入（后台任务 + 进度） |
| 部署方式 | 懒加载：首次在设置页手动触发下载，缓存应用目录，支持断点续传 + SHA-256 校验 |
| 是否可选 | 是，`semanticEngineEnabled` 默认关闭，用户开启后才下载 |
| 总结功能 | **走远程 LLM（维持现状，不改）**，本地模型只做推荐 + 语义搜索 |
| 降级策略 | 任何失败回退现有 TF-IDF 推荐 / 关键词搜索，接口不变 |

## 架构

新增模块（与 `features/ai_engine` 平级）：

```
lib/features/semantic_engine/
├── models/
│   └── note_vector.dart            # Isar 模型: noteId + modelId + List<double> vector + updatedAt
├── services/
│   ├── bert_tokenizer.dart         # 纯 Dart WordPiece (vocab.json + [CLS]/[SEP]/截断512)
│   ├── embedding_service.dart      # onnxruntime_v2 封装: embed(text) → 档位对应维度向量 (mean-pool + L2归一化)
│   ├── model_download_service.dart # 懒加载下载 int8 ONNX + vocab.json, 断点续传 + hash 校验
│   └── semantic_scoring.dart       # 评分混合: 余弦0.7 + 标签0.2 + 标题/关键词0.1 (复用现有 reason 逻辑)
└── providers/
    ├── model_status_provider.dart  # 下载/加载状态 + 进度 (Notifier)
    ├── vector_index_provider.dart  # 笔记向量索引 (保存时 upsert, 内存缓存)
    └── semantic_search_provider.dart # 语义搜索查询
```

## 数据流

1. **启动**：`model_status_provider` 检查模型是否已缓存；未下载则设置页提示，用户手动触发下载（带进度、可取消、断点续传）。
2. **保存**：笔记保存（EditorService 自动保存/手动保存）→ 防抖嵌入 → Isar `note_vector` 按 noteId 幂等 upsert。
3. **推荐**：打开笔记 → `predictiveLinksProvider`：模型就绪 → 语义打分；否则回退现有 TF-IDF（UI 无感知）。
4. **搜索**：侧边栏搜索 → 查询词嵌入 → 余弦 Top-K，与现有搜索结果合并展示。
5. **换档**：设置页切换模型档位 → 全量重嵌入（旧向量标注过期，按 noteId 逐条覆盖），期间推荐/搜索回退 TF-IDF/关键词，完成后自动恢复。

## 关键决策

- **推理隔离**：推理放独立 isolate，避免 UI 卡顿。
- **无 ANN 索引**：笔记量级（几百~几千）内存缓存 + 余弦全量扫描毫秒级，不需要 HNSW/IVF。
- **向量存储**：Isar `List<double>`（项目已用 Isar 3.1），每条向量记录 `modelId` 用于档位切换检测。
- **评分混合**：语义 cosine(0.7) + 标签(0.2) + 标题/关键词(0.1)，保留现有 `reason` 文案逻辑。
- **模型加载时机**：启动不加载模型，首次嵌入时 warm-up（懒加载），减少启动开销。

## 性能考量

| 项 | 预期 |
|---|---|
| 推理延迟 | 桌面 CPU：bge-small ~40ms / bge-base ~100ms；移动端约 2-3x |
| 加速 | `appendDefaultProviders()` 自动启用 CoreML(iOS/macOS)、NNAPI(Android)、XNNPACK(CPU) |
| 模型内存 | 加载后 ~25-60MB RAM（int8 权重） |
| 向量内存 | ~2KB/条（512 维 float32），5000 笔记 ≈ 10MB，全量余弦扫描毫秒级 |
| 保存嵌入 | 沿用 2s 自动保存防抖节奏，避免连续输入触发高频推理 |
| 批量策略 | 初始化/重嵌入时批量合并推理，降低往返与调度开销 |
| 移动端 | 独立 isolate + 批量，避免热/电耗；失败静默回退 |

## 设置集成

- `AppSettings` 新增 `semanticEngineEnabled`（默认 `false`）+ `semanticModelTier`（`light`/`base`，默认 `light`），持久化到 Hive meta。
- AI 分区新增「本地语义引擎」分组，状态驱动 UI：
  - 开关：启用语义推荐（提示需下载模型：轻量 ~25MB / 高质量 ~60MB）
  - 档位下拉：轻量 / 高质量，标注体积与延迟（切换触发全量重嵌入，带进度）
  - 开启未下载 → 「下载模型」按钮 + 进度条 + 可取消
  - 已就绪 → 当前档位/体积 + 「删除模型」按钮
  - 重嵌入中 → 进度显示，期间推荐/搜索走回退路径
  - 下载失败 → 错误提示 + 重试；模型损坏 → 自动删除重下
  - 关闭开关 → 推荐回退 TF-IDF、搜索回退关键词

## 状态模型

`model_status_provider` 状态机：
`notEnabled → idle → downloading(progress) → ready`，`error` 可回退；换档时进入 `reindexing(progress)`。

## 错误处理与降级

- 任何环节失败都不影响笔记功能：推荐/搜索走现有路径（接口不变）。
- 下载：`.part` 临时文件断点续传；下载完成 SHA-256 对比校验。
- 推理：独立 isolate 捕获异常，回退不抛到 UI。

## 测试

- `bert_tokenizer_test`：中英文分词、OOV、`[CLS]/[SEP]`、超长截断
- `semantic_scoring_test`：余弦/标签/标题权重、回退模式、空内容
- `model_download_service_test`：fake downloader 测断点续传、hash 校验、损坏重下
- `reindex_test`：档位切换检测（维度/版本不一致）→ 触发重嵌入、进度、期间回退
- 现有 `predictive_link_test` 保持通过（回退路径不破坏原逻辑）

## 范围外（不做）

- 本地生成式总结（Qwen 等）— 总结维持远程 LLM
- Web 端适配
- ANN/HNSW 向量索引
