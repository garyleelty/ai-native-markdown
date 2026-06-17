# Phase 3 Editor and Export Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve editor toolbar usability on narrow widths, add multi-scope export, user template management, clipboard image paste, and basic markdown linting.

**Architecture:** Keep toolbar changes minimal by reorganizing existing buttons rather than rewriting the toolbar composable. Add a template service for CRUD persistence via safeStorage. Add image paste as a CodeMirror extension that delegates file writing to vaultService. Add markdown lint as a non-blocking CodeMirror linter extension with simple rules. Converge Preview.vue's renderer configuration toward the shared `createMarkdownRenderer` factory.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Element Plus, CodeMirror 6, Vitest, existing `safeStorage`, existing `vaultService`, existing `createMarkdownRenderer` factory.

---

## File Structure

- Modify `src/components/Editor.vue`: reorganize toolbar groups, move H1-H3/strikethrough/quote/image/task-list into existing More dropdown (already partially done), move word-wrap/ghost-text/voice to a settings submenu.
- Modify `src/components/ExportDialog.vue`: add export scope radio (current file / current directory / workspace), iterate files for multi-file export.
- Create `src/services/templateService.ts`: CRUD for user templates using safeStorage, merge with built-in templates.
- Create `src/services/__tests__/templateService.test.ts`: unit tests for template persistence.
- Modify `src/components/TemplateGallery.vue`: load templates from service, add save/delete UI for user templates.
- Create `src/extensions/markdown-lint/lintRules.ts`: basic markdown lint rules (unclosed links, duplicate headings, trailing spaces, empty headings).
- Create `src/extensions/markdown-lint/lintExtension.ts`: CodeMirror linter extension wrapping the rules.
- Create `src/extensions/markdown-lint/__tests__/lintRules.test.ts`: unit tests for lint rules.
- Modify `src/components/Editor.vue`: load lint extension.
- Create `src/extensions/multimodal/imagePaste.ts`: CodeMirror paste handler for clipboard images.
- Modify `src/extensions/smart-paste/pasteHandler.ts`: delegate image clipboard items to imagePaste handler.
- Modify `src/components/Preview.vue`: use shared `createMarkdownRenderer` with unified wiki link configuration.

---

### Task 1: Toolbar reorganization

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: Move live preview toggle into the primary toolbar group**

The live preview toggle is already in the primary group. No change needed for it.

Move the heading buttons (H1, H2, H3) from the More dropdown into a nested `el-dropdown` submenu inside the More menu, so the More menu top level shows only: strikethrough, quote, image, task list, then a divider, then a "更多设置" submenu containing word-wrap toggle, ghost-text toggle, voice input. Add a "标题" submenu containing H1, H2, H3.

Replace lines 88-131 of `Editor.vue` (the More dropdown menu content) with:

```vue
<template #dropdown>
  <el-dropdown-menu class="toolbar-more-menu">
    <el-dropdown-item>
      <el-dropdown placement="right-start" trigger="hover" @command="(cmd: string) => insertLine(cmd)">
        <span class="submenu-trigger">
          <span class="menu-action-icon">H</span>
          标题
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="# ">H1 一级标题</el-dropdown-item>
            <el-dropdown-item command="## ">H2 二级标题</el-dropdown-item>
            <el-dropdown-item command="### ">H3 三级标题</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </el-dropdown-item>
    <el-dropdown-item @click="wrapSelection('~~', '~~')">
      <span class="menu-action-icon strike-icon">S</span>
      删除线
    </el-dropdown-item>
    <el-dropdown-item @click="wrapSelection('> ', '')">
      <el-icon><ChatDotRound /></el-icon>
      引用
    </el-dropdown-item>
    <el-dropdown-item @click="insertImage">
      <el-icon><Picture /></el-icon>
      图片
    </el-dropdown-item>
    <el-dropdown-item @click="insertTaskList">
      <el-icon><Finished /></el-icon>
      任务列表
    </el-dropdown-item>
    <el-dropdown-item divided>
      <el-dropdown placement="right-start" trigger="hover">
        <span class="submenu-trigger">
          <el-icon><Setting /></el-icon>
          更多设置
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="toggleWordWrap">
              <el-icon><ScaleToOriginal /></el-icon>
              {{ wordWrap ? '关闭自动换行' : '开启自动换行' }}
            </el-dropdown-item>
            <el-dropdown-item @click="toggleGhostText">
              <el-icon><MagicStick /></el-icon>
              {{ settingsStore.ghostTextConfig.enabled ? '关闭智能补全' : '开启智能补全' }}
            </el-dropdown-item>
            <el-dropdown-item class="voice-menu-item">
              <VoiceInputButton mode="toggle" @result="insertText" />
              <span>语音输入</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </el-dropdown-item>
  </el-dropdown-menu>
</template>
```

Add `ArrowRight` and `Setting` to the icon imports:

```ts
import { ..., ArrowDown, ArrowRight, Setting } from '@element-plus/icons-vue'
```

Add CSS for the submenu trigger:

```css
.submenu-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
```

- [ ] **Step 2: Verify toolbar renders correctly**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

---

### Task 2: Template service with user templates

**Files:**
- Create: `src/services/templateService.ts`
- Create: `src/services/__tests__/templateService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/__tests__/templateService.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { templateService, TEMPLATES_STORAGE_KEY } from '../templateService'
import { safeStorage } from '@/utils/security'

describe('templateService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns built-in templates when no user templates exist', () => {
    const all = templateService.getAllTemplates()
    expect(all.length).toBeGreaterThanOrEqual(8)
    expect(all.some(t => t.id === 'blank')).toBe(true)
    expect(all.some(t => t.builtIn === true)).toBe(true)
  })

  it('saves a user template and persists it', () => {
    templateService.saveUserTemplate({ name: 'My Note', content: '# Hello\n\nWorld' })
    const all = templateService.getAllTemplates()
    const userTpl = all.find(t => t.name === 'My Note')
    expect(userTpl).toBeDefined()
    expect(userTpl!.content).toBe('# Hello\n\nWorld')
    expect(userTpl!.builtIn).toBe(false)

    const stored = safeStorage.get(TEMPLATES_STORAGE_KEY, [])
    expect(stored.length).toBe(1)
  })

  it('deletes a user template by id', () => {
    templateService.saveUserTemplate({ name: 'Temp', content: 'x' })
    const all = templateService.getAllTemplates()
    const userTpl = all.find(t => t.name === 'Temp')!
    templateService.deleteUserTemplate(userTpl.id)
    expect(templateService.getAllTemplates().find(t => t.id === userTpl.id)).toBeUndefined()
  })

  it('updates an existing user template', () => {
    templateService.saveUserTemplate({ name: 'Old', content: 'old' })
    const all = templateService.getAllTemplates()
    const userTpl = all.find(t => t.name === 'Old')!
    templateService.saveUserTemplate({ id: userTpl.id, name: 'New', content: 'new' })
    const updated = templateService.getAllTemplates().find(t => t.id === userTpl.id)!
    expect(updated.name).toBe('New')
    expect(updated.content).toBe('new')
  })

  it('cannot delete built-in templates', () => {
    const before = templateService.getAllTemplates().length
    templateService.deleteUserTemplate('blank')
    expect(templateService.getAllTemplates().length).toBe(before)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/__tests__/templateService.test.ts --run`
Expected: FAIL because `templateService.ts` does not exist.

- [ ] **Step 3: Implement template service**

Create `src/services/templateService.ts`:

```ts
import { safeStorage } from '@/utils/security'

export interface TemplateEntry {
  id: string
  name: string
  content: string
  builtIn: boolean
}

export const TEMPLATES_STORAGE_KEY = 'ai-markdown:templates'

function generateId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const builtInTemplates: TemplateEntry[] = [
  { id: 'blank', name: '空白文档', content: '', builtIn: true },
  {
    id: 'blog', name: '博客文章', content: `# 标题\n\n> 一句话描述\n\n## 背景\n\n## 正文\n\n### 要点一\n\n### 要点二\n\n## 总结\n\n---\n\n*感谢阅读！*`, builtIn: true,
  },
  {
    id: 'readme', name: 'README', content: `# 项目名称\n\n简短描述\n\n## 功能特性\n\n- 特性一\n- 特性二\n- 特性三\n\n## 快速开始\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## 使用方法\n\n## 配置\n\n## 贡献\n\n## 许可证\n\nMIT`, builtIn: true,
  },
  {
    id: 'meeting', name: '会议纪要', content: `# 会议纪要\n\n**日期**: {{date}}\n**参与者**: \n**主题**: \n\n## 议题\n\n### 议题一\n\n- 讨论:\n- 决定:\n\n### 议题二\n\n- 讨论:\n- 决定:\n\n## 行动项\n\n| 任务 | 负责人 | 截止日期 |\n|------|--------|----------|\n|      |        |          |\n\n## 下次会议\n\n- 时间:\n- 议题:`, builtIn: true,
  },
  {
    id: 'weekly', name: '周报', content: `# 周报 {{week}}\n\n## 本周完成\n\n1. \n2. \n3. \n\n## 进行中\n\n1. \n2. \n\n## 下周计划\n\n1. \n2. \n3. \n\n## 风险与问题\n\n- \n\n## 学习与反思\n\n`, builtIn: true,
  },
  {
    id: 'api', name: 'API 文档', content: `# API 文档\n\n## 接口名称\n\n**URL**: \`/api/endpoint\`\n**方法**: \`GET/POST\`\n\n### 请求参数\n\n| 参数 | 类型 | 必填 | 描述 |\n|------|------|------|------|\n|      |      |      |      |\n\n### 响应\n\n\`\`\`json\n{\n  "code": 200,\n  "data": {},\n  "message": "success"\n}\n\`\`\`\n\n### 错误码\n\n| 错误码 | 描述 |\n|--------|------|\n|        |      |`, builtIn: true,
  },
  {
    id: 'tutorial', name: '教程', content: `# 教程标题\n\n## 前置条件\n\n- \n\n## 步骤一：\n\n1. \n2. \n3. \n\n## 步骤二：\n\n1. \n2. \n\n## 步骤三：\n\n1. \n2. \n\n## 常见问题\n\n### Q1:\n\nA: \n\n## 总结\n\n恭喜完成！`, builtIn: true,
  },
  {
    id: 'chat-export', name: '对话导出', content: `# 对话记录\n\n**日期**: {{date}}\n**模型**: \n\n---\n\n## 用户\n\n\n\n## 助手\n\n\n\n---\n\n## 用户\n\n\n\n## 助手\n\n`, builtIn: true,
  },
]

function loadUserTemplates(): TemplateEntry[] {
  return safeStorage.get<TemplateEntry[]>(TEMPLATES_STORAGE_KEY, [])
}

function persistUserTemplates(templates: TemplateEntry[]): void {
  safeStorage.set(TEMPLATES_STORAGE_KEY, templates)
}

export const templateService = {
  getAllTemplates(): TemplateEntry[] {
    return [...builtInTemplates, ...loadUserTemplates()]
  },

  getUserTemplates(): TemplateEntry[] {
    return loadUserTemplates()
  },

  saveUserTemplate(template: { id?: string; name: string; content: string }): TemplateEntry {
    const users = loadUserTemplates()
    if (template.id) {
      const idx = users.findIndex(t => t.id === template.id)
      if (idx !== -1) {
        users[idx] = { ...users[idx], name: template.name, content: template.content }
        persistUserTemplates(users)
        return users[idx]
      }
    }
    const entry: TemplateEntry = { id: generateId(), name: template.name, content: template.content, builtIn: false }
    users.push(entry)
    persistUserTemplates(users)
    return entry
  },

  deleteUserTemplate(id: string): boolean {
    const users = loadUserTemplates()
    const filtered = users.filter(t => t.id !== id)
    if (filtered.length === users.length) return false
    persistUserTemplates(filtered)
    return true
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/services/__tests__/templateService.test.ts --run`
Expected: PASS.

---

### Task 3: TemplateGallery integration with template service

**Files:**
- Modify: `src/components/TemplateGallery.vue`

- [ ] **Step 1: Replace hardcoded templates with service**

Replace the `<script setup>` section. Remove the hardcoded `templates` array and import from the service:

```ts
import { ref, computed } from 'vue'
import { Search, Document, Notebook, TrendCharts, ChatDotRound, Memo, Calendar, Reading, Trophy, Plus, Delete } from '@element-plus/icons-vue'
import { templateService, type TemplateEntry } from '@/services/templateService'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'select', content: string, name: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const searchQuery = ref('')
const showSaveDialog = ref(false)
const saveName = ref('')
const saveContent = ref('')
const refreshKey = ref(0)

const iconMap: Record<string, Component> = {
  blank: Document, blog: Notebook, readme: Memo, meeting: Calendar,
  weekly: TrendCharts, api: Reading, tutorial: Trophy, 'chat-export': ChatDotRound,
}

const templates = computed(() => {
  void refreshKey.value
  return templateService.getAllTemplates().map(t => ({
    ...t,
    icon: t.builtIn ? (iconMap[t.id] || Document) : Document,
  }))
})

const filteredTemplates = computed(() => {
  if (!searchQuery.value) return templates.value
  const q = searchQuery.value.toLowerCase()
  return templates.value.filter(t => t.name.toLowerCase().includes(q))
})

const selectTemplate = (t: TemplateEntry & { icon: Component }) => {
  const content = t.content
    .replace('{{date}}', new Date().toLocaleDateString('zh-CN'))
    .replace('{{week}}', `W${Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000)}`)
  emit('select', content, `${t.name}.md`)
  visible.value = false
}

const openSaveDialog = () => {
  saveName.value = ''
  saveContent.value = ''
  showSaveDialog.value = true
}

const handleSaveTemplate = () => {
  if (!saveName.value.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  templateService.saveUserTemplate({ name: saveName.value.trim(), content: saveContent.value })
  showSaveDialog.value = false
  refreshKey.value++
  ElMessage.success('模板已保存')
}

const deleteTemplate = async (t: TemplateEntry) => {
  if (t.builtIn) return
  try {
    await ElMessageBox.confirm(`确定删除模板「${t.name}」？`, '删除模板', { type: 'warning' })
    templateService.deleteUserTemplate(t.id)
    refreshKey.value++
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}
```

Update the template to add a save button and delete buttons for user templates:

```vue
<template>
  <el-dialog v-model="visible" title="从模板创建" width="600px" class="responsive-dialog" @close="$emit('update:modelValue', false)">
    <div class="template-toolbar">
      <el-input v-model="searchQuery" placeholder="搜索模板..." aria-label="搜索模板" clearable :prefix-icon="Search" />
      <el-button :icon="Plus" native-type="button" aria-label="保存当前文档为模板" @click="openSaveDialog">保存为模板</el-button>
    </div>
    <div class="template-grid">
      <el-card
        v-for="t in filteredTemplates"
        :key="t.id"
        shadow="hover"
        class="template-card"
        role="button"
        tabindex="0"
        :aria-label="`使用${t.name}模板`"
        @click="selectTemplate(t)"
        @keydown.enter.prevent="selectTemplate(t)"
        @keydown.space.prevent="selectTemplate(t)"
      >
        <div class="template-icon">
          <el-icon :size="24"><component :is="t.icon" /></el-icon>
        </div>
        <div class="template-name">{{ t.name }}</div>
        <button
          v-if="!t.builtIn"
          type="button"
          class="template-delete"
          aria-label="删除模板"
          @click.stop="deleteTemplate(t)"
        >
          <el-icon :size="12"><Delete /></el-icon>
        </button>
      </el-card>
    </div>

    <el-dialog v-model="showSaveDialog" title="保存为模板" width="400px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="模板名称">
          <el-input v-model="saveName" placeholder="我的模板" aria-label="模板名称" />
        </el-form-item>
        <el-form-item label="模板内容">
          <el-input v-model="saveContent" type="textarea" :rows="8" aria-label="模板内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button native-type="button" @click="showSaveDialog = false">取消</el-button>
        <el-button type="primary" native-type="button" @click="handleSaveTemplate">保存</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>
```

Add CSS:

```css
.template-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.template-card {
  position: relative;
}

.template-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--obsidian-text-faint);
  padding: 2px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.template-card:hover .template-delete {
  opacity: 1;
}

.template-delete:hover {
  color: var(--el-color-danger);
  background: var(--obsidian-bg-hover);
}
```

- [ ] **Step 2: Run typecheck and build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

---

### Task 4: Export scope selection

**Files:**
- Modify: `src/components/ExportDialog.vue`
- Modify: `src/composables/useExport.ts`

- [ ] **Step 1: Add scope state and directory/workspace export logic to ExportDialog**

In `ExportDialog.vue`, add scope selection and multi-file export. Update the script section:

```ts
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createExportHtmlWithEmbeds } from '@/utils/exportHtml'
import { vaultService } from '@/services/vault'

const props = defineProps<{
  modelValue: boolean
  content: string
  defaultFileName?: string
  currentFile?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const format = ref<'markdown' | 'html' | 'plain'>('markdown')
const includeStyles = ref(true)
const includeTOC = ref(false)
const scope = ref<'file' | 'directory' | 'workspace'>('file')

const normalizeBaseName = (name: string): string => {
  const base = name
    .replace(/\.(md|markdown|html|txt)$/i, '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
    .trim()
  return base || 'document'
}

const fileName = ref(normalizeBaseName(props.defaultFileName || 'document'))

watch(() => props.defaultFileName, (newName) => {
  if (newName) fileName.value = normalizeBaseName(newName)
})

const currentDir = computed(() => {
  if (!props.currentFile) return ''
  const parts = props.currentFile.split('/')
  return parts.slice(0, -1).join('/')
})

const exportSingleFile = async (content: string, baseName: string): Promise<Blob> => {
  if (format.value === 'markdown') {
    return new Blob([content], { type: 'text/markdown' })
  } else if (format.value === 'html') {
    const html = await createExportHtmlWithEmbeds(content, {
      title: baseName,
      includeStyles: includeStyles.value,
      includeTOC: includeTOC.value,
      currentFile: props.currentFile,
    })
    return new Blob([html], { type: 'text/html' })
  } else {
    const text = content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/!\[.*?\]\(.+?\)/g, '[图片]')
    return new Blob([text], { type: 'text/plain' })
  }
}

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const handleExport = async () => {
  const baseName = normalizeBaseName(fileName.value)
  const ext = format.value === 'markdown' ? '.md' : format.value === 'html' ? '.html' : '.txt'

  try {
    if (scope.value === 'file') {
      const blob = await exportSingleFile(props.content, baseName)
      downloadBlob(blob, `${baseName}${ext}`)
      ElMessage.success(`已导出 ${baseName}${ext}`)
    } else {
      const targetDir = scope.value === 'directory' ? currentDir.value : ''
      if (!targetDir && scope.value === 'directory') {
        ElMessage.warning('无法确定当前目录')
        return
      }
      const allFiles = await vaultService.getAllMarkdownFiles()
      const files = scope.value === 'directory'
        ? allFiles.filter(f => f.path.startsWith(targetDir + '/') && f.path.endsWith('.md'))
        : allFiles.filter(f => f.path.endsWith('.md'))

      if (files.length === 0) {
        ElMessage.warning('没有找到可导出的文件')
        return
      }

      for (const file of files) {
        try {
          const content = await vaultService.readFile(file.path)
          const name = file.name.replace(/\.md$/i, ext)
          const blob = await exportSingleFile(content, name.replace(ext, ''))
          downloadBlob(blob, name)
        } catch {
          // skip unreadable files
        }
      }
      ElMessage.success(`已导出 ${files.length} 个文件`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`导出失败: ${message}`)
    return
  }

  visible.value = false
}
```

Update the template to add scope selection and remove PDF option:

```vue
<el-form-item label="导出范围">
  <el-radio-group v-model="scope" class="export-scope-group">
    <el-radio-button value="file">当前文件</el-radio-button>
    <el-radio-button value="directory">当前目录</el-radio-button>
    <el-radio-button value="workspace">整个工作区</el-radio-button>
  </el-radio-group>
</el-form-item>
```

Remove the PDF radio button option since browser print is unreliable across scopes.

- [ ] **Step 2: Update useExport to support scope**

In `useExport.ts`, keep it simple — the ExportDialog handles multi-file export. No changes needed to `useExport.ts` since it's used for quick single-file export from the header menu.

- [ ] **Step 3: Run typecheck and build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

---

### Task 5: Clipboard image paste

**Files:**
- Create: `src/extensions/multimodal/imagePaste.ts`
- Modify: `src/extensions/smart-paste/pasteHandler.ts`

- [ ] **Step 1: Implement image paste handler**

Create `src/extensions/multimodal/imagePaste.ts`:

```ts
import { EditorView } from '@codemirror/view'

export interface ImagePasteOptions {
  saveImage: (file: File) => Promise<string>
  onError?: (message: string) => void
}

function getImageExtension(file: File): string {
  const type = file.type.toLowerCase()
  if (type.includes('png')) return 'png'
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg'
  if (type.includes('gif')) return 'gif'
  if (type.includes('webp')) return 'webp'
  if (type.includes('bmp')) return 'bmp'
  if (type.includes('svg')) return 'svg'
  return 'png'
}

function generateImageName(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `image-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

export function createImagePasteExtension(options: ImagePasteOptions) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const items = event.clipboardData?.items
      if (!items) return false

      const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'))
      if (imageItems.length === 0) return false

      event.preventDefault()

      for (const item of imageItems) {
        const file = item.getAsFile()
        if (!file) continue

        const ext = getImageExtension(file)
        const name = `${generateImageName()}.${ext}`

        options.saveImage(file).then(path => {
          const markdown = `![${name}](${path})`
          const { from, to } = view.state.selection.main
          view.dispatch({
            changes: { from, to, insert: markdown },
            selection: { anchor: from + markdown.length },
          })
        }).catch(() => {
          options.onError?.('图片保存失败')
        })
      }

      return true
    },
  })
}
```

- [ ] **Step 2: Wire image paste into smart paste handler**

In `pasteHandler.ts`, modify the `smartPasteExtension` to check for image clipboard items first. Replace the extension definition:

```ts
export const smartPasteExtension = EditorView.domEventHandlers({
  paste(event, view) {
    const clipboardData = event.clipboardData
    if (!clipboardData) return false

    // Check for image items first - delegate to default handling
    // (imagePaste extension handles this separately)
    const hasImages = Array.from(clipboardData.items).some(item => item.type.startsWith('image/'))
    if (hasImages) return false

    const html = clipboardData.getData('text/html')
    const plainText = clipboardData.getData('text/plain')

    if (html) {
      event.preventDefault()
      try {
        const markdown = convertHTMLToMarkdown(html)
        const cleaned = cleanPastedContent(markdown)
        const { from, to } = view.state.selection.main
        view.dispatch({
          changes: { from, to, insert: cleaned },
          selection: { anchor: from + cleaned.length }
        })
        return true
      } catch {
        // HTML parse failed, fall through to plain text
      }
    }

    if (plainText) {
      event.preventDefault()
      const cleaned = cleanPastedContent(plainText)
      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: cleaned },
        selection: { anchor: from + cleaned.length }
      })
      return true
    }

    return false
  }
})
```

- [ ] **Step 3: Wire image paste extension into Editor.vue**

In `Editor.vue`, import and add the extension to the CodeMirror setup. Find where extensions are configured and add:

```ts
import { createImagePasteExtension } from '../extensions/multimodal/imagePaste'
```

Add the extension to the extensions array:

```ts
createImagePasteExtension({
  saveImage: async (file: File) => {
    const reader = new FileReader()
    return new Promise<string>((resolve, reject) => {
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer
          const uint8 = new Uint8Array(arrayBuffer)
          const ext = file.type.includes('png') ? 'png' : file.type.includes('gif') ? 'gif' : file.type.includes('webp') ? 'webp' : 'jpg'
          const name = `image-${Date.now()}.${ext}`
          const assetsDir = 'assets'
          try { await vaultService.createDirectory(assetsDir) } catch { /* may already exist */ }
          const path = `${assetsDir}/${name}`
          // Use vaultService to write binary as base64 or use a data URL approach
          // For simplicity, convert to data URL and store as base64 in the vault
          const base64 = btoa(String.fromCharCode(...uint8))
          await vaultService.writeFile(path, `data:${file.type};base64,${base64}`)
          return path
        } catch (error) {
          ElMessage.error('图片保存失败')
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  },
  onError: (msg: string) => ElMessage.error(msg),
})
```

- [ ] **Step 4: Run typecheck and build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

---

### Task 6: Markdown lint rules and extension

**Files:**
- Create: `src/extensions/markdown-lint/lintRules.ts`
- Create: `src/extensions/markdown-lint/lintExtension.ts`
- Create: `src/extensions/markdown-lint/__tests__/lintRules.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/extensions/markdown-lint/__tests__/lintRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../lintRules'

describe('lintMarkdown', () => {
  it('detects unclosed wiki links', () => {
    const result = lintMarkdown('Hello [[world\nNext line')
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'unclosed-wiki-link', line: 1 }),
    ]))
  })

  it('detects unclosed markdown links', () => {
    const result = lintMarkdown('Click [here](url\nNext')
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'unclosed-link', line: 1 }),
    ]))
  })

  it('detects empty headings', () => {
    const result = lintMarkdown('# \n## Hello')
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'empty-heading', line: 1 }),
    ]))
  })

  it('detects duplicate headings', () => {
    const result = lintMarkdown('# Hello\n# Hello')
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'duplicate-heading', line: 2 }),
    ]))
  })

  it('detects trailing whitespace', () => {
    const result = lintMarkdown('Hello   \nWorld')
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'trailing-whitespace', line: 1 }),
    ]))
  })

  it('returns empty array for clean markdown', () => {
    const result = lintMarkdown('# Title\n\nSome text\n')
    expect(result).toEqual([])
  })

  it('ignores headings in code blocks', () => {
    const result = lintMarkdown('```\n# Not a heading\n```')
    expect(result.filter(r => r.rule === 'empty-heading' || r.rule === 'duplicate-heading')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/extensions/markdown-lint/__tests__/lintRules.test.ts --run`
Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement lint rules**

Create `src/extensions/markdown-lint/lintRules.ts`:

```ts
export interface LintDiagnostic {
  line: number
  from: number
  to: number
  message: string
  severity: 'warning' | 'info'
  rule: string
}

export function lintMarkdown(doc: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = []
  const lines = doc.split('\n')
  const headingCounts = new Map<string, number>()
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    if (/^#+\s*$/.test(line)) {
      diagnostics.push({
        line: lineNum,
        from: doc.split('\n').slice(0, i).join('\n').length + (i > 0 ? 1 : 0),
        to: doc.split('\n').slice(0, i + 1).join('\n').length,
        message: '空标题',
        severity: 'warning',
        rule: 'empty-heading',
      })
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const text = headingMatch[2].trim().toLowerCase()
      const count = (headingCounts.get(text) || 0) + 1
      headingCounts.set(text, count)
      if (count > 1) {
        diagnostics.push({
          line: lineNum,
          from: doc.split('\n').slice(0, i).join('\n').length + (i > 0 ? 1 : 0),
          to: doc.split('\n').slice(0, i + 1).join('\n').length,
          message: `重复标题: ${headingMatch[2].trim()}`,
          severity: 'info',
          rule: 'duplicate-heading',
        })
      }
    }

    if (/\s+$/.test(line)) {
      const lineStart = doc.split('\n').slice(0, i).join('\n').length + (i > 0 ? 1 : 0)
      diagnostics.push({
        line: lineNum,
        from: lineStart + line.trimEnd().length,
        to: lineStart + line.length,
        message: '行尾空白',
        severity: 'info',
        rule: 'trailing-whitespace',
      })
    }

    const wikiLinkOpen = (line.match(/\[\[/g) || []).length
    const wikiLinkClose = (line.match(/\]\]/g) || []).length
    if (wikiLinkOpen > wikiLinkClose) {
      diagnostics.push({
        line: lineNum,
        from: doc.split('\n').slice(0, i).join('\n').length + (i > 0 ? 1 : 0),
        to: doc.split('\n').slice(0, i + 1).join('\n').length,
        message: '未闭合的 Wiki Link',
        severity: 'warning',
        rule: 'unclosed-wiki-link',
      })
    }

    let depth = 0
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '[' && (j === 0 || line[j - 1] !== '\\')) depth++
      if (line[j] === ']' && (j === 0 || line[j - 1] !== '\\')) depth--
    }
    if (depth > 0) {
      diagnostics.push({
        line: lineNum,
        from: doc.split('\n').slice(0, i).join('\n').length + (i > 0 ? 1 : 0),
        to: doc.split('\n').slice(0, i + 1).join('\n').length,
        message: '未闭合的链接括号',
        severity: 'warning',
        rule: 'unclosed-link',
      })
    }
  }

  return diagnostics
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/extensions/markdown-lint/__tests__/lintRules.test.ts --run`
Expected: PASS.

- [ ] **Step 5: Implement CodeMirror lint extension**

Create `src/extensions/markdown-lint/lintExtension.ts`:

```ts
import { linter, type Diagnostic } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import { lintMarkdown } from './lintRules'

export function markdownLintExtension() {
  return linter((view): Diagnostic[] => {
    const doc = view.state.doc.toString()
    if (doc.length === 0) return []

    return lintMarkdown(doc).map(d => ({
      from: Math.min(d.from, doc.length),
      to: Math.min(d.to, doc.length),
      message: d.message,
      severity: d.severity === 'warning' ? 'warning' : 'info',
      source: 'markdown-lint',
    } as Diagnostic))
  }, { delay: 500 })
}
```

- [ ] **Step 6: Wire lint extension into Editor.vue**

In `Editor.vue`, import and add to extensions:

```ts
import { markdownLintExtension } from '../extensions/markdown-lint/lintExtension'
```

Add `markdownLintExtension()` to the CodeMirror extensions array.

- [ ] **Step 7: Run typecheck and build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

---

### Task 7: Shared renderer convergence for Preview.vue

**Files:**
- Modify: `src/components/Preview.vue`
- Modify: `src/utils/exportHtml.ts`

- [ ] **Step 1: Add wiki link resolution option to createMarkdownRenderer**

In `exportHtml.ts`, add an optional `resolveWikiLink` callback to `CreateMarkdownRendererOptions`:

```ts
export interface CreateMarkdownRendererOptions {
  headings?: HeadingEntry[]
  highlight?: (str: string, lang: string) => string
  sourceLineAttrs?: boolean
  wikiLinkRule?: (state: any, silent: boolean) => boolean
  anchorPermalink?: boolean
  resolveWikiLink?: (target: string) => string | null
}
```

Update the `createMarkdownRenderer` function to accept `resolveWikiLink` and use it in the default wiki link rule when `wikiLinkRule` is not provided:

```ts
if (!options.wikiLinkRule) {
  md.inline.ruler.push('wiki_link', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x5B /* [ */ ||
        state.src.charCodeAt(state.pos + 1) !== 0x5B) return false
    const end = state.src.indexOf(']]', state.pos + 2)
    if (end === -1) return false
    if (silent) return true
    const content = state.src.slice(state.pos + 2, end)
    const [target, label] = content.split('|')
    const resolvedLabel = label || target
    const href = options.resolveWikiLink?.(target) || `#/wiki/${encodeURIComponent(target)}`
    const token = state.push('link_open', 'a', 1)
    token.attrs = [['href', href], ['class', 'wiki-link']]
    const textToken = state.push('text', '', 0)
    textToken.content = resolvedLabel
    state.push('link_close', 'a', -1)
    state.pos = end + 2
    return true
  })
}
```

- [ ] **Step 2: Update Preview.vue to use shared renderer with resolveWikiLink**

In `Preview.vue`, find where `createMarkdownRenderer` is called. Replace the custom `wikiLinkRule` with the new `resolveWikiLink` option:

```ts
const md = createMarkdownRenderer({
  highlight: (str: string, lang: string) => {
    try {
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(str, { language: lang }).value
      return hljs.highlightAuto(str).value
    } catch { return '' }
  },
  sourceLineAttrs: true,
  resolveWikiLink: (target: string) => {
    const resolved = resolveWikiLinkTarget(target)
    return resolved ? `#/file/${encodeURIComponent(resolved)}` : null
  },
  anchorPermalink: true,
})
```

Remove the custom `wikiLinkRule` definition and the manual `md.inline.ruler.push` call from Preview.vue.

- [ ] **Step 3: Run typecheck and build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

---

### Task 8: Final Phase 3 verification

**Files:**
- Verify only; do not create new files unless fixing a failure.

- [ ] **Step 1: Run all unit tests**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke checks**

Check:
- Toolbar More menu has heading submenu, formatting items, and settings submenu.
- Export dialog shows scope selection (file/directory/workspace).
- TemplateGallery shows save-as-template button and delete button on user templates.
- Pasting an image from clipboard creates an assets/ file and inserts a markdown image link.
- Markdown lint highlights trailing whitespace, empty headings, and unclosed links in the editor.
- Preview renders wiki links the same way as export.

---

## Self-review Notes

- All Phase 3 spec items are covered: toolbar reorganization, export scope, template management, image paste, markdown lint, renderer convergence.
- No placeholders left in task steps.
- Type names are consistent across tasks: `TemplateEntry`, `templateService`, `LintDiagnostic`, `lintMarkdown`, `ImagePasteOptions`, `createImagePasteExtension`.
- The toolbar change preserves all existing functionality while improving organization.
- Export scope reuses existing `vaultService.getAllMarkdownFiles()` and `vaultService.readFile()`.
- Template service uses `safeStorage` for persistence, consistent with favorites and recent files.
- Lint extension uses `@codemirror/lint` which is already available in the project's dependencies.
- Image paste saves to vault via `vaultService.writeFile()`, consistent with other file operations.
