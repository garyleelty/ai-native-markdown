# Dogfood Report: AI Native Markdown (二次审视)

| Field | Value |
|-------|-------|
| **Date** | 2026-06-08 |
| **App URL** | http://localhost:1430/ |
| **Session** | ai-native-test |
| **Scope** | 验证已修复的 bug |

## 修复验证摘要

### ISSUE-001: 知识图谱 Wiki Link 索引 ✅ 已修复

**验证方法：** 代码审查 + 单元测试通过

**修复内容：**
- `fileSystem.ts`: 在 `init()` 中添加了示例文件的知识索引调用
- `knowledgeIndex.ts`: 增强了 `buildGraphData()` 和 `getBacklinks()` 方法，支持多种路径匹配：
  - 文件名匹配（不含扩展名）
  - 完整路径匹配
  - 相对于 workspace 的路径匹配

**测试结果：** ✅ 403 个单元测试全部通过

---

### ISSUE-004: 正则内容搜索 ✅ 已修复

**验证方法：** 代码审查

**问题根因：** 使用带 `g` 标志的全局正则表达式时，`test()` 方法会维护 `lastIndex` 状态，导致同一正则实例多次使用时匹配失败。

**修复内容：**
```typescript
// FileExplorer.vue 第 471-477 行
for (let i = 0; i < lines.length; i++) {
  if (matches.length >= 5) break
  // 每次都创建新的正则实例，避免 lastIndex 状态问题
  const lineRegex = new RegExp(pattern, 'gi')
  if (lineRegex.test(lines[i])) {
    matches.push({ lineNumber: i + 1, lineContent: lines[i].trim().slice(0, 200) })
  }
}
```

**状态：** ✅ 已修复

---

### ISSUE-005: 阅读模式标题锚点 ✅ 已修复

**验证方法：** 代码审查

**修复内容：** `Preview.vue` 已实现正确的 CSS 隐藏逻辑：
```css
.markdown-body .header-anchor {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.markdown-body h1:hover .header-anchor,
.markdown-body h2:hover .header-anchor,
/* ... 其他标题级别 ... */
{
  opacity: 1;
}
```

**状态：** ✅ 已修复 - 锚点默认隐藏，hover 时显示

---

### ISSUE-006: 任务列表复选框 aria-label ✅ 已修复

**验证方法：** 代码审查

**问题根因：** `aria-label` 的逻辑与实际状态相反。

**修复内容：**
```typescript
// livePreviewPlugin.ts 第 35 行
// 修复前：this.checked ? '标记任务为未完成' : '标记任务为已完成'
// 修复后：
input.setAttribute('aria-label', this.checked ? '标记任务为已完成' : '标记任务为未完成')
```

**状态：** ✅ 已修复

---

### ISSUE-007: 知识图谱节点名称截断 ✅ 已修复

**验证方法：** 代码审查

**修复内容：** `useKnowledgeGraph.ts` 第 112-117 行：
```typescript
.text(d => {
  // 优先使用文件名（不含路径和扩展名）
  const fileName = d.path.split('/').pop()?.replace(/\.(md|markdown)$/i, '') || d.label
  // 增加长度限制到 20 字符
  return fileName.length > 20 ? fileName.slice(0, 19) + '…' : fileName
})
```

**改进点：**
- 优先显示文件名而非标题
- 长度限制从 12 字符提升到 20 字符

**状态：** ✅ 已修复

---

### ISSUE-002/003: 侧边栏面板问题 ⚠️ 待验证

**状态：** 之前的会话中已修复侧边栏切换逻辑，建议手动验证

---

## 测试结果

```
✓ src/services/__tests__/fileSystem.test.ts (44 tests)
✓ src/services/__tests__/knowledgeIndex.test.ts (28 tests)
✓ src/composables/__tests__/useGlobalSearch.test.ts (7 tests)
✓ src/utils/__tests__/livePreview.test.ts (13 tests)

Test Files  19 passed (19)
     Tests  403 passed (403)
```

---

## 待手动验证项

由于浏览器自动化会话遇到问题，建议手动验证以下场景：

1. **知识图谱链接**：加载示例工作区 → 打开 README.md → 切换到知识图谱面板 → 确认显示 "2 笔记 · X 链接" 而非 "0 链接"

2. **正则搜索**：在文件搜索框输入 `/知识|工作流/` → 切换到内容搜索 → 确认能找到匹配结果

3. **任务列表 aria-label**：切换到实时预览模式 → 检查任务列表复选框的 aria-label 是否正确

4. **标题锚点**：切换到阅读模式 → 检查标题旁的 `#` 链接是否默认隐藏

5. **知识图谱节点名称**：切换到图谱标签 → 检查节点是否显示 "README" 或 "Research Map" 而非 "AI Markdown…"
