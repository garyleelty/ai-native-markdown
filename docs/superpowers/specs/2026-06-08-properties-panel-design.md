# Properties/Bases-lite 设计文档

**日期：** 2026-06-08

## 概述

实现类似 Obsidian 的属性面板（Properties Panel），支持 YAML frontmatter 的可视化编辑。这是 Properties/Bases-lite 的第一阶段，包含：

- 属性类型自动推断
- 用户可覆盖类型偏好
- 侧边栏面板 UI
- Frontmatter 读写同步
- 知识索引集成

## 范围

### MVP 功能范围

| 功能 | 状态 |
|------|------|
| 侧边栏属性面板 | ✅ |
| 自动类型推断 | ✅ |
| 用户可覆盖类型 | ✅ |
| 8 种属性类型支持 | ✅ |
| Frontmatter 回写 | ✅ |
| 知识索引集成 | ✅ |

### 暂不包含

| 功能 | 说明 |
|------|------|
| 数据库视图查询 | 后续阶段 |
| Bases 模板库 | 后续阶段 |
| 日历/时间线视图 | 后续阶段 |

## 架构设计

### 数据流

```
读取:
编辑器内容 → parseFrontmatter() → frontmatter 对象
→ frontmatterService.inferTypes() → 类型推断
→ knowledgeIndex 读取历史偏好 → 合并类型
→ UI 渲染对应编辑器

编辑:
用户在面板编辑属性 → frontmatterService.update()
→ 序列化回 YAML → editor.replaceRange() 更新文档
→ 知识索引重新索引 → 保存类型偏好
```

### 文件结构

**新增文件：**
```
src/
├── components/
│   ├── sidebar/
│   │   └── PropertiesPanel.vue       # 属性面板
│   └── properties/
│       └── PropertyEditor.vue       # 单个属性编辑器
├── composables/
│   └── useProperties.ts             # 属性业务逻辑
├── services/
│   └── frontmatterService.ts        # 读写服务
└── types/
    └── properties.ts                # 类型定义
```

**修改文件：**
```
src/
├── utils/
│   └── metadata.ts                  # 增强类型推断
├── services/
│   └── knowledgeIndex.ts            # 存储类型偏好
└── components/
    └── Sidebar.vue                  # 添加属性标签页
```

## 数据模型

### 类型定义

```typescript
// src/types/properties.ts

export type PropertyType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'tag'
  | 'select'
  | 'url'
  | 'email'

export interface PropertyTypePref {
  [key: string]: PropertyType // key: property name
}

export interface PropertySchema {
  type: PropertyType
  options?: string[] // for select type
  default?: any
}

export interface PropertyEditorProps {
  key: string
  value: any
  type: PropertyType
  options?: string[]
}
```

### 知识索引扩展

```typescript
// src/services/knowledgeIndex.ts

export interface KnowledgeIndexRecord {
  // ... 现有字段
  propertyTypes: PropertyTypePref // 新增: 按文件存储类型偏好
}
```

### metadata.ts 增强

```typescript
// src/utils/metadata.ts

export interface ParsedMarkdownMetadata {
  // ... 现有字段
  propertyTypes: PropertyTypePref // 新增: 推断或用户设置的类型
}
```

## 详细设计

### 1. 属性类型推断引擎

```typescript
// src/services/frontmatterService.ts

export function inferPropertyType(key: string, value: any): PropertyType {
  // 1. 检查布尔值
  if (value === true || value === false ||
      value === 'true' || value === 'false') {
    return 'boolean'
  }

  // 2. 检查日期 (YYYY-MM-DD 或 ISO 格式)
  if (typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(value)) {
    return 'date'
  }

  // 3. 检查 URL
  if (typeof value === 'string' &&
      /^https?:\/\//.test(value)) {
    return 'url'
  }

  // 4. 检查邮箱
  if (typeof value === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'email'
  }

  // 5. 检查数字
  if (typeof value === 'number' ||
      (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
    return 'number'
  }

  // 6. 检查标签 (开头为 # 或包含 # 元素的数组)
  if (Array.isArray(value) &&
      value.every(item => item.startsWith('#'))) {
    return 'tag'
  }
  if (typeof value === 'string' &&
      value.startsWith('#')) {
    return 'tag'
  }

  // 7. 基于 key 名称的启发式
  if (key.toLowerCase().includes('date') ||
      key.toLowerCase().includes('created') ||
      key.toLowerCase().includes('updated')) {
    return 'date'
  }
  if (key.toLowerCase().includes('tag') ||
      key.toLowerCase().includes('tags')) {
    return 'tag'
  }
  if (key.toLowerCase().includes('link') ||
      key.toLowerCase().includes('url')) {
    return 'url'
  }
  if (key.toLowerCase().includes('email')) {
    return 'email'
  }

  // 默认
  return 'text'
}
```

### 2. Frontmatter 序列化

```typescript
// src/services/frontmatterService.ts

export function serializeFrontmatter(
  frontmatter: Record<string, any>,
  currentContent: string
): string {
  const { frontmatter: existing, body } = parseFrontmatter(currentContent)
  const merged = { ...existing, ...frontmatter }

  const yamlLines: string[] = []
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null ||
        (typeof value === 'string' && value === '') ||
        (Array.isArray(value) && value.length === 0)) {
      continue
    }

    if (Array.isArray(value)) {
      yamlLines.push(`${key}:`)
      for (const item of value) {
        yamlLines.push(`  - ${JSON.stringify(item)}`)
      }
    } else if (typeof value === 'string') {
      yamlLines.push(`${key}: ${JSON.stringify(value)}`)
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      yamlLines.push(`${key}: ${value}`)
    }
  }

  const newFrontmatter = yamlLines.length > 0
    ? `---\n${yamlLines.join('\n')}\n---\n`
    : ''

  return newFrontmatter + body
}
```

### 3. useProperties Composable

```typescript
// src/composables/useProperties.ts

import { ref, computed, watch, onUnmounted } from 'vue'
import { parseFrontmatter } from '@/utils/metadata'
import {
  inferPropertyType,
  serializeFrontmatter,
  type PropertyType,
  type PropertyTypePref
} from '@/services/frontmatterService'

interface Props {
  getContent: () => string
  onContentChange: (newContent: string) => void
  filePath: string
}

export function useProperties(props: Props) {
  const frontmatter = ref<Record<string, any>>({})
  const propertyTypes = ref<PropertyTypePref>({})
  const loading = ref(false)

  function load() {
    loading.value = true
    try {
      const content = props.getContent()
      const { frontmatter: parsed } = parseFrontmatter(content)
      frontmatter.value = parsed

      // 1. 推断类型
      const inferredTypes: PropertyTypePref = {}
      for (const [key, value] of Object.entries(parsed)) {
        inferredTypes[key] = inferPropertyType(key, value)
      }

      // 2. 从 knowledgeIndex 读取用户偏好
      const record = await knowledgeIndex.getByPath(props.filePath)
      const userPrefs = record?.propertyTypes || {}
      
      // 3. 合并类型：用户偏好优先于推断
      for (const [key, value] of Object.entries(parsed)) {
        propertyTypes.value[key] = userPrefs[key] || inferredTypes[key]
      }
    } finally {
      loading.value = false
    }
  }

  function updateProperty(key: string, value: any) {
    frontmatter.value[key] = value
    save()
  }

  function deleteProperty(key: string) {
    delete frontmatter.value[key]
    delete propertyTypes.value[key]
    save()
  }

  function setPropertyType(key: string, type: PropertyType) {
    propertyTypes.value[key] = type
    knowledgeIndex.savePropertyTypePref(props.filePath, key, type)
  }

  function save() {
    const currentContent = props.getContent()
    const newContent = serializeFrontmatter(frontmatter.value, currentContent)
    props.onContentChange(newContent)
  }

  return {
    frontmatter,
    propertyTypes,
    loading,
    load,
    updateProperty,
    deleteProperty,
    setPropertyType,
  }
}
```

### 4. PropertiesPanel.vue 组件

```vue
<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>📋 属性</h3>
      <el-button size="small" link @click="showAddProperty = true">
        + 添加属性
      </el-button>
    </div>

    <div v-if="loading" class="panel-loading">加载中...</div>

    <div v-else-if="Object.keys(frontmatter).length === 0" class="panel-empty">
      暂无属性，点击上方按钮添加
    </div>

    <div v-else class="property-list">
      <div v-for="(value, key) in frontmatter"
           :key="key"
           class="property-item">
        <PropertyEditor
          :key-name="key"
          :value="value"
          :type="propertyTypes[key] || 'text'"
          @update="updateProperty"
          @change-type="setPropertyType"
          @delete="deleteProperty" />
      </div>
    </div>
  </div>
</template>
```

### 5. PropertyEditor.vue 组件

```vue
<template>
  <div class="property-editor">
    <div class="property-key">
      <span>{{ keyName }}</span>
      <el-dropdown @command="onTypeChange">
        <el-button size="small" link>
          {{ typeLabel }}
        </el-button>
      </el-dropdown>
    </div>
    <div class="property-value">
      <input v-if="type === 'text'" type="text" :value="value" />
      <input v-else-if="type === 'number'" type="number" :value="value" />
      <el-checkbox v-else-if="type === 'boolean'" :model-value="value" />
      <el-date-picker v-else-if="type === 'date'" type="date" />
      <el-input v-else-if="type === 'tag'" type="textarea" />
      <!-- ... 其他类型 -->
    </div>
  </div>
</template>
```

## 知识索引集成

### 数据库迁移

```typescript
// src/services/knowledgeIndex.ts

this.version(3).stores({
  records: '++id, &filePath, normalizedTitle, *normalizedAliases, *tags, *normalizedLinks, updatedAt'
}).upgrade((trans) => {
  // 为现有记录添加默认 propertyTypes
  trans.records.toCollection().modify((record) => {
    record.propertyTypes = {}
  })
})
```

### knowledgeIndex API 扩展

```typescript
// src/services/knowledgeIndex.ts

// 新增: 根据文件路径获取记录
export async function getByPath(filePath: string): Promise<KnowledgeIndexRecord | undefined> {
  return db.records.where('filePath').equals(filePath).first()
}

// 新增: 保存属性类型偏好
export async function savePropertyTypePref(
  filePath: string,
  propertyName: string,
  type: PropertyType
): Promise<void> {
  await db.records
    .where('filePath')
    .equals(filePath)
    .modify((record) => {
      record.propertyTypes = record.propertyTypes || {}
      record.propertyTypes[propertyName] = type
    })
}
```

## 验收标准

### 1. 类型推断正确

- [x] `2026-06-08` → date picker
- [x] `true` / `false` → checkbox
- [x] `#a #b` → 标签多选
- [x] `https://example.com` → URL 字段
- [x] `user@example.com` → email 字段

### 2. 用户可覆盖类型

- [x] 右键属性名 → 类型选择菜单
- [x] 类型选择后记住偏好
- [x] 下次打开同一笔记时使用用户选择的类型

### 3. Frontmatter 回写正确

- [x] 修改后文档内容正确更新
- [x] 不破坏原有格式
- [x] 保留注释和空行（最佳尝试）

### 4. 知识索引同步

- [x] 属性变更时重新索引
- [x] 类型偏好持久化到 IndexedDB
- [x] 偏好跨会话保留

## 测试计划

### 单元测试

| 测试文件 | 测试内容 |
|---------|---------|
| `services/__tests__/frontmatterService.test.ts` | 类型推断、序列化 |
| `composables/__tests__/useProperties.test.ts` | composable 逻辑 |
| `services/__tests__/knowledgeIndex.test.ts` | 属性偏好存储 |

### E2E 测试

| 测试场景 | 说明 |
|---------|------|
| 打开笔记显示属性面板 | 验证属性面板在侧边栏显示 |
| 编辑属性值 | 修改值后验证 frontmatter 更新 |
| 切换属性类型 | 用户覆盖类型后验证生效 |
| 添加/删除属性 | 验证 UI 和文档同步 |
| 跨会话偏好 | 重新打开笔记验证类型偏好保留 |

## 风险与考虑

### 风险

| 风险 | 缓解 |
|------|------|
| 序列化破坏 YAML 格式 | 使用渐进式更新，保留现有格式风格 |
| 大文件性能问题 | 添加防抖，避免频繁重索引 |
| 与已解析 frontmatter 冲突 | 优先使用已解析结构 |

### 兼容性

- 保持 YAML 格式与 Obsidian 100% 兼容
- 不使用非标准扩展
- 类型偏好存储在 IndexedDB，不影响文件内容

## 后续阶段

### 阶段 2: 数据库视图

- 属性查询引擎
- 表格视图
- 筛选和排序
- 保存查询

### 阶段 3: 模板系统

- 变量和占位符
- 条件逻辑
- 多模板库

### 阶段 4: 日历和时间线

- 按日期组织视图
- 时间线展示
- 日历事件

