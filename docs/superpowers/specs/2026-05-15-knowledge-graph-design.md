# 知识图谱可视化功能设计文档

**日期**: 2026-05-15
**版本**: v1.0
**状态**: 待审批
**作者**: AI Assistant

---

## 1. 功能概述

### 1.1 功能定位

为 AI Native Markdown Editor 增加交互式知识图谱可视化功能，帮助用户直观地探索笔记之间的关联关系，发现知识结构和孤立内容。

### 1.2 核心价值

> "一图胜千言。让你的知识网络可视化，发现隐藏的连接。"

### 1.3 目标用户场景

- **知识探索者**: 想了解自己知识库的整体结构
- **深度思考者**: 寻找主题之间的跨领域连接
- **内容整理者**: 发现孤立笔记，建立更多链接
- **新用户引导**: 快速理解知识库的组织方式

---

## 2. 功能需求

### 2.1 必须功能 (MVP)

| 功能 | 说明 |
|------|------|
| 力导向图渲染 | 使用 D3.js 实现节点和边的力学布局 |
| 节点交互 | 点击打开文件、悬停显示信息、拖拽移动 |
| 缩放与平移 | 鼠标滚轮缩放、拖拽画布平移 |
| 节点视觉编码 | 大小表示链接数量，颜色表示标签分类 |
| 孤立节点识别 | 突出显示没有链接的笔记 |
| 搜索定位 | 在图谱中搜索并高亮特定笔记 |

### 2.2 增强功能 (P1)

| 功能 | 说明 |
|------|------|
| 标签筛选 | 按标签过滤显示的节点 |
| 链接数量筛选 | 过滤链接数量在范围内的节点 |
| 布局切换 | 力导向 / 圆形 / 层次布局 |
| 导出图片 | 将图谱导出为 PNG/SVG |
| 统计面板 | 显示节点数、边数、平均链接数等 |

### 2.3 AI 增强功能 (P2)

| 功能 | 说明 |
|------|------|
| 孤立节点推荐 | AI 分析孤立笔记内容，推荐相关笔记 |
| 主题聚类 | 自动识别知识簇并用颜色区分 |
| 知识路径推荐 | 推荐连接两个笔记的最短路径 |

---

## 3. 数据模型

### 3.1 图谱数据结构

```typescript
interface GraphNode {
  id: string              // 文件路径
  label: string           // 文件名（不含扩展名）
  path: string            // 完整路径
  linkCount: number       // 链接数量（出度 + 入度）
  tags: string[]          // 关联的标签
  isOrphan: boolean       // 是否孤立节点
  x?: number              // D3 布局计算的 x 坐标
  y?: number              // D3 布局计算的 y 坐标
}

interface GraphEdge {
  source: string          // 源节点 ID
  target: string          // 目标节点 ID
  weight: number          // 边权重（默认 1）
}

interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    totalNodes: number
    totalEdges: number
    orphanCount: number
    avgLinkCount: number
  }
}
```

### 3.2 数据流

```
文件列表 + 文件内容
    │
    ▼
extractWikiLinks() 解析 [[链接]]
    │
    ▼
buildLinkGraph() 构建邻接表
    │
    ▼
构建 GraphNode[] 和 GraphEdge[]
    │
    ▼
D3 force simulation 计算布局
    │
    ▼
SVG/Canvas 渲染
```

---

## 4. 技术实现

### 4.1 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| 图谱渲染 | D3.js v7 | 灵活、可控、社区成熟 |
| 力导向布局 | d3-force | D3 内置，支持自定义力 |
| 状态管理 | Pinia | 复用现有 store 模式 |
| 样式主题 | CSS Variables | 适配现有主题系统 |

### 4.2 依赖安装

```bash
npm install d3
npm install --save-dev @types/d3
```

### 4.3 核心组件

#### 4.3.1 KnowledgeGraph.vue

位置: `src/components/knowledge/KnowledgeGraph.vue`

职责:
- 接收图谱数据
- 初始化 D3 force simulation
- 渲染 SVG 节点和边
- 处理用户交互事件

```vue
<template>
  <div class="knowledge-graph">
    <div class="graph-controls">
      <!-- 搜索、筛选、布局切换控件 -->
    </div>
    <div ref="graphContainer" class="graph-container"></div>
    <div class="graph-stats">
      <!-- 统计信息面板 -->
    </div>
  </div>
</template>
```

#### 4.3.2 useKnowledgeGraph.ts

位置: `src/composables/useKnowledgeGraph.ts`

职责:
- 封装 D3 力导向图逻辑
- 提供节点/边操作方法
- 处理布局计算

```typescript
export function useKnowledgeGraph(container: Ref<HTMLElement>) {
  const simulation = ref<d3.Simulation<GraphNode, GraphEdge>>()
  const zoom = ref<d3.ZoomBehavior<SVGSVGElement, unknown>>()

  function initGraph(data: KnowledgeGraph) { /* ... */ }
  function updateLayout() { /* ... */ }
  function highlightNode(nodeId: string) { /* ... */ }
  function filterNodes(predicate: (node: GraphNode) => boolean) { /* ... */ }

  return { initGraph, updateLayout, highlightNode, filterNodes }
}
```

#### 4.3.3 扩展现有工具函数

在 `src/utils/knowledge.ts` 中添加：

```typescript
export function buildKnowledgeGraph(
  files: { path: string; content: string; tags?: string[] }[]
): KnowledgeGraph {
  const graph = buildLinkGraph(files)
  const tagMap = getAllTags(files)

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  // 构建节点
  for (const file of files) {
    const name = file.path.split('/').pop()?.replace(/\.md$/, '') || ''
    const linkCount = (graph.get(file.path)?.size || 0) +
                      Array.from(graph.values()).filter(s => s.has(file.path)).length

    nodes.push({
      id: file.path,
      label: name,
      path: file.path,
      linkCount,
      tags: tagMap.get(name) || [],
      isOrphan: linkCount === 0
    })
  }

  // 构建边
  for (const [source, targets] of graph) {
    for (const target of targets) {
      edges.push({ source, target, weight: 1 })
    }
  }

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      orphanCount: nodes.filter(n => n.isOrphan).length,
      avgLinkCount: nodes.reduce((sum, n) => sum + n.linkCount, 0) / nodes.length
    }
  }
}
```

### 4.4 D3 布局配置

```typescript
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
  .force('charge', d3.forceManyBody().strength(-300))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide().radius(30))
```

### 4.5 视觉编码规则

| 元素 | 属性 | 映射 |
|------|------|------|
| 节点 | 半径 | `Math.sqrt(linkCount) * 5 + 10` |
| 节点 | 填充色 | 基于主标签的色板映射 |
| 节点 | 描边 | 孤立节点用虚线描边 |
| 边 | 粗细 | `weight * 2` |
| 边 | 透明度 | 0.6（悬停时 1.0） |

---

## 5. UI/UX 设计

### 5.1 侧边栏集成

在 `Sidebar.vue` 中添加"图谱"Tab：

```vue
<div class="sidebar-tabs">
  <button :class="{ active: activeTab === 'files' }">文件</button>
  <button :class="{ active: activeTab === 'search' }">搜索</button>
  <button :class="{ active: activeTab === 'graph' }">图谱</button>
  <button :class="{ active: activeTab === 'tasks' }">任务</button>
</div>
```

### 5.2 图谱面板布局

```
┌─────────────────────────────────────┐
│  [搜索框] [筛选▼] [布局▼] [导出]     │  ← 工具栏
├─────────────────────────────────────┤
│                                     │
│         ┌──────────┐               │
│         │   节点    │───▶          │
│    ◇────┤          │               │
│         └──────────┘               │
│              │                     │
│              ▼                     │  ← 图谱画布 (SVG)
│         ┌──────────┐               │
│         │   节点    │               │
│         └──────────┘               │
│                                     │
├─────────────────────────────────────┤
│ 节点: 142  链接: 89  孤立: 23      │  ← 统计栏
└─────────────────────────────────────┘
```

### 5.3 交互细节

- **点击节点**: 触发 `emit('nodeClick', node)`，父组件打开对应文件
- **双击节点**: 聚焦该节点，放大并居中
- **悬停节点**: 显示 tooltip（文件名、链接数、标签）
- **右键节点**: 弹出菜单（打开、复制路径、AI 分析）
- **ESC 键**: 清除高亮和筛选

### 5.4 响应式

- 侧边栏宽度 < 300px 时，隐藏统计栏
- 移动端支持触摸缩放和平移

---

## 6. 主题适配

复用现有 CSS Variables：

```css
.knowledge-graph {
  --node-fill: var(--accent);
  --node-stroke: var(--border);
  --edge-stroke: var(--text-muted);
  --bg-canvas: var(--bg-primary);
}

[data-theme="light"] {
  .knowledge-graph {
    --node-fill: var(--accent);
    --edge-stroke: #a0a0a0;
  }
}
```

---

## 7. 性能考虑

| 场景 | 策略 |
|------|------|
| 1000+ 节点 | 使用 Canvas 而非 SVG，或启用虚拟化 |
| 布局计算 | 限制 simulation tick 次数（默认 300） |
| 交互响应 | 防抖搜索输入，节流布局更新 |
| 内存占用 | 组件卸载时停止 simulation |

---

## 8. 测试策略

| 测试类型 | 覆盖内容 |
|----------|----------|
| 单元测试 | `buildKnowledgeGraph`、`extractWikiLinks` |
| 集成测试 | D3 simulation 初始化、节点点击事件 |
| E2E 测试 | 打开图谱、搜索定位、点击跳转 |
| 性能测试 | 500 节点渲染时间 < 2s |

---

## 9. 里程碑

| 阶段 | 交付物 |
|------|--------|
| M1 | 基础图谱渲染 + 节点交互 |
| M2 | 筛选、搜索、统计面板 |
| M3 | 布局切换、导出功能 |
| M4 | AI 增强（孤立节点推荐、聚类） |

---

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| D3 学习曲线 | 提供详细代码注释和示例 |
| 大型知识库性能 | 提前测试 1000+ 节点场景 |
| 移动端兼容 | 优先桌面端，移动端降级提示 |

---

**文档状态**: 草案 v1.0
**最后更新**: 2026-05-15
