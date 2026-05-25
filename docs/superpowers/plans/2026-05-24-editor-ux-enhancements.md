# 编辑器体验增强 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现四个编辑器体验提升功能：选中文本 AI 操作菜单、字数统计状态栏、智能粘贴清理、大纲实时联动高亮

**Architecture:** 四个功能作为独立 CodeMirror 6 Extension 实现，通过 Compartment 机制集成到 Editor.vue。AI 操作复用现有 `TauriAIProvider.streamChat()`。状态栏和大纲联动通过现有 Vue 组件扩展实现，不引入新依赖。

**Tech Stack:** Vue 3 + CodeMirror 6 + TypeScript（纯前端功能，无需 Rust/Tauri 后端修改）

---

## 文件结构总览

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/extensions/ai-actions/types.ts` | AI 操作类型定义与 prompt 模板 |
| `src/extensions/ai-actions/AIActionMenuWidget.ts` | 选中文本后浮出的 AI 操作按钮 Widget |
| `src/extensions/ai-actions/aiActionPlugin.ts` | AI 操作 CodeMirror Extension + 快捷键 |
| `src/extensions/ai-actions/styles.css` | AI 操作菜单样式 |
| `src/components/editor/StatusBar.vue` | 底部状态栏组件（字数、行数、阅读时间） |
| `src/extensions/smart-paste/pasteHandler.ts` | 纯文本粘贴处理 Extension |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/components/Editor.vue` | 注册新 Extension，添加 StatusBar，暴露滚动事件 |
| `src/components/editor/OutlinePanel.vue` | 添加 activeHeading 高亮显示 |
| `src/stores/settings.ts` | 添加 aiActions/smartPaste/statusBar 开关 |
| `src/types/index.ts` | 添加 AIAction 类型定义 |

---

## 功能一：选中文本 AI 操作菜单

### Task 1: AI 操作类型定义

**Files:**
- Create: `src/extensions/ai-actions/types.ts`

- [ ] **Step 1: 定义 AI 操作类型与 prompt 模板**

```typescript
export interface AIAction {
  id: string
  label: string
  icon: string
  prompt: string
  systemRole: string
  temperature?: number
}

export const AI_ACTIONS: AIAction[] = [
  {
    id: 'explain',
    label: '解释',
    icon: '💡',
    prompt: '请用通俗易懂的语言解释以下文本的含义，直接输出解释结果：\n\n',
    systemRole: '你是一个善于用简单语言解释复杂概念的教学助手。只用中文回复。',
    temperature: 0.3
  },
  {
    id: 'translate-zh',
    label: '译中',
    icon: '🌐',
    prompt: '请将以下文本翻译为中文，直接输出翻译结果：\n\n',
    systemRole: '你是一个专业的翻译助手，翻译准确自然。只输出翻译结果。',
    temperature: 0.2
  },
  {
    id: 'translate-en',
    label: '译英',
    icon: '🔤',
    prompt: 'Please translate the following text to English. Output only the translation:\n\n',
    systemRole: 'You are a professional translator. Output only the translation.',
    temperature: 0.2
  },
  {
    id: 'polish',
    label: '润色',
    icon: '✨',
    prompt: '请优化以下文本的表达，使其更流畅自然，保持原意不变，直接输出润色结果：\n\n',
    systemRole: '你是一个专业的文字编辑。只输出润色后的文本。',
    temperature: 0.5
  },
  {
    id: 'expand',
    label: '扩写',
    icon: '📝',
    prompt: '请扩写以下内容，添加更多细节和深度，保持风格一致，直接输出扩写结果：\n\n',
    systemRole: '你是一个专业的内容创作者。只输出扩写后的文本。',
    temperature: 0.7
  },
  {
    id: 'summarize',
    label: '摘要',
    icon: '📋',
    prompt: '请用一段话概括以下文本的核心要点，直接输出摘要：\n\n',
    systemRole: '你是一个擅长提炼要点的总结助手。只输出摘要。',
    temperature: 0.3
  },
  {
    id: 'fix-grammar',
    label: '纠错',
    icon: '🔧',
    prompt: '请修正以下文本中的语法错误、错别字和表达不当之处，保持原意不变，直接输出修正结果：\n\n',
    systemRole: '你是一个专业的校对助手。只输出修正后的文本。',
    temperature: 0.1
  },
  {
    id: 'continue',
    label: '续写',
    icon: '➡️',
    prompt: '请根据以下前文内容，自然流畅地续写一段，保持风格一致，直接输出续写内容：\n\n',
    systemRole: '你是一个专业的写作助手。只输出续写内容，不重复前文。',
    temperature: 0.6
  }
]

export interface AIActionConfig {
  enabled: boolean
  position: 'top' | 'bottom'
  showIcons: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/ai-actions/types.ts
git commit -m "feat: add AI action types with 8 built-in action templates"
```

---

### Task 2: AI Action Menu Widget

**Files:**
- Create: `src/extensions/ai-actions/AIActionMenuWidget.ts`
- Create: `src/extensions/ai-actions/styles.css`

- [ ] **Step 1: 实现浮动菜单 Widget**

```typescript
import { WidgetType, EditorView } from '@codemirror/view'
import { AI_ACTIONS, type AIAction } from './types'
import { aiService } from '@/services/ai'

export class AIActionMenuWidget extends WidgetType {
  private selectedText: string
  private from: number
  private to: number
  private view: EditorView

  constructor(selectedText: string, from: number, to: number, view: EditorView) {
    super()
    this.selectedText = selectedText
    this.from = from
    this.to = to
    this.view = view
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'cm-ai-action-menu'

    const actionsRow = document.createElement('div')
    actionsRow.className = 'cm-ai-action-row'

    for (const action of AI_ACTIONS) {
      const btn = document.createElement('button')
      btn.className = 'cm-ai-action-btn'
      btn.title = action.label
      btn.innerHTML = `<span class="cm-ai-action-icon">${action.icon}</span><span class="cm-ai-action-label">${action.label}</span>`
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.executeAction(action)
      })
      actionsRow.appendChild(btn)
    }

    container.appendChild(actionsRow)

    const resultContainer = document.createElement('div')
    resultContainer.className = 'cm-ai-action-result'
    resultContainer.style.display = 'none'
    container.appendChild(resultContainer)

    return container
  }

  private async executeAction(action: AIAction) {
    const provider = aiService.getActiveProvider()
    if (!provider) {
      this.showResult('请先在设置中配置 AI 服务', 'error')
      return
    }

    this.showLoading()

    try {
      let result = ''
      for await (const chunk of provider.streamChat([
        { role: 'system', content: action.systemRole },
        { role: 'user', content: action.prompt + this.selectedText }
      ], { temperature: action.temperature ?? 0.3 })) {
        result += chunk
        this.showStreamingResult(result)
      }
      this.showResult(result.trim(), 'success')
    } catch (e: any) {
      this.showResult(`处理失败: ${e?.message || String(e)}`, 'error')
    }
  }

  private showLoading() {
    const resultEl = this.getResultContainer()
    if (!resultEl) return
    resultEl.style.display = 'block'
    resultEl.className = 'cm-ai-action-result loading'
    resultEl.innerHTML = `
      <div class="cm-ai-result-header">
        <span class="cm-ai-result-status">AI 处理中...</span>
        <button class="cm-ai-result-close" title="关闭">&times;</button>
      </div>
      <div class="cm-ai-result-body">
        <div class="cm-ai-typing-indicator"><span></span><span></span><span></span></div>
      </div>
    `
    resultEl.querySelector('.cm-ai-result-close')?.addEventListener('click', () => {
      this.destroyResult()
    })
  }

  private showStreamingResult(text: string) {
    const body = this.getResultBody()
    if (!body) return
    body.textContent = text
  }

  private showResult(text: string, type: 'success' | 'error') {
    const resultEl = this.getResultContainer()
    if (!resultEl) return
    resultEl.style.display = 'block'
    resultEl.className = `cm-ai-action-result ${type}`

    resultEl.innerHTML = `
      <div class="cm-ai-result-header">
        <span class="cm-ai-result-status">${type === 'success' ? '处理完成' : '处理失败'}</span>
        <div class="cm-ai-result-actions">
          <button class="cm-ai-result-btn accept" title="替换原文">替换</button>
          <button class="cm-ai-result-btn insert" title="插入到原文之后">插入</button>
          <button class="cm-ai-result-close" title="关闭">&times;</button>
        </div>
      </div>
      <div class="cm-ai-result-body">${this.escapeHtml(text)}</div>
    `

    if (type === 'success') {
      resultEl.querySelector('.cm-ai-result-btn.accept')?.addEventListener('click', () => {
        this.view.dispatch({
          changes: { from: this.from, to: this.to, insert: text }
        })
        this.destroyWidget()
      })
      resultEl.querySelector('.cm-ai-result-btn.insert')?.addEventListener('click', () => {
        this.view.dispatch({
          changes: { from: this.to, insert: '\n\n' + text }
        })
        this.destroyWidget()
      })
    }
    resultEl.querySelector('.cm-ai-result-close')?.addEventListener('click', () => {
      this.destroyResult()
    })
  }

  private getResultContainer(): HTMLElement | null {
    const widget = this.view.dom.querySelector('.cm-ai-action-menu')
    return widget?.querySelector('.cm-ai-action-result') as HTMLElement | null
  }

  private getResultBody(): HTMLElement | null {
    const resultEl = this.getResultContainer()
    return resultEl?.querySelector('.cm-ai-result-body') as HTMLElement | null
  }

  private destroyResult() {
    const resultEl = this.getResultContainer()
    if (resultEl) resultEl.style.display = 'none'
  }

  private destroyWidget() {
    this.view.dispatch({ selection: { anchor: this.to } })
    this.view.focus()
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  ignoreEvent(): boolean { return false }

  eq(other: AIActionMenuWidget): boolean {
    return this.from === other.from && this.to === other.to && this.selectedText === other.selectedText
  }
}
```

- [ ] **Step 2: 创建样式文件**

```css
.cm-ai-action-menu {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin: 8px 0;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(12px);
  animation: aiMenuIn 0.15s ease-out;
}

@keyframes aiMenuIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.cm-ai-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px;
}

.cm-ai-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
  font-family: var(--font-sans);
}

.cm-ai-action-btn:hover {
  background: var(--accent-soft);
  color: var(--accent-primary);
}

.cm-ai-action-icon {
  font-size: 13px;
  line-height: 1;
}

.cm-ai-action-label {
  font-size: 11px;
}

.cm-ai-action-result {
  border-top: 1px solid var(--border-subtle);
  animation: resultIn 0.12s ease-out;
}

@keyframes resultIn {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 400px; }
}

.cm-ai-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
}

.cm-ai-result-status {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
}

.cm-ai-result-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cm-ai-result-btn {
  padding: 3px 10px;
  border: none;
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
}

.cm-ai-result-btn.accept {
  background: var(--accent-primary);
  color: #fff;
}

.cm-ai-result-btn.accept:hover {
  opacity: 0.85;
}

.cm-ai-result-btn.insert {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.cm-ai-result-btn.insert:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

.cm-ai-result-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.cm-ai-result-close:hover {
  color: var(--text-primary);
}

.cm-ai-result-body {
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-sans);
}

.cm-ai-result.loading .cm-ai-result-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
}

.cm-ai-typing-indicator {
  display: flex;
  gap: 4px;
}

.cm-ai-typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary);
  animation: aiTyping 1.4s infinite ease-in-out both;
}

.cm-ai-typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.cm-ai-typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes aiTyping {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.cm-ai-action-result.error .cm-ai-result-body {
  color: var(--accent-red);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/extensions/ai-actions/AIActionMenuWidget.ts src/extensions/ai-actions/styles.css
git commit -m "feat: add AI action menu widget with streaming result display"
```

---

### Task 3: AI Action Plugin

**Files:**
- Create: `src/extensions/ai-actions/aiActionPlugin.ts`

- [ ] **Step 1: 实现 CodeMirror Extension**

```typescript
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, keymap } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { AIActionMenuWidget } from './AIActionMenuWidget'

let activeWidget: AIActionMenuWidget | null = null

export const aiActionPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.selectionSet || update.docChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const { from, to } = view.state.selection.main
    const selectedText = view.state.sliceDoc(from, to)

    // 只在有选中文本且不是空选时显示菜单
    if (!selectedText || from === to) {
      activeWidget = null
      return Decoration.none
    }

    const widget = new AIActionMenuWidget(selectedText, from, to, view)
    activeWidget = widget

    const builder = new RangeSetBuilder<Decoration>()
    builder.add(to, to, Decoration.widget({ widget, side: 1 }))
    return builder.finish()
  }

  destroy() {
    activeWidget = null
  }
}, {
  decorations: v => v.decorations
})

export const aiActionKeymap = keymap.of([
  {
    key: 'Mod-k',
    run(view) {
      const { from, to } = view.state.selection.main
      if (from === to) return false
      // 触发选区更新以显示菜单
      view.dispatch({ selection: { anchor: from, head: to } })
      return true
    }
  }
])
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/ai-actions/aiActionPlugin.ts
git commit -m "feat: add AI action CodeMirror plugin with Cmd+K shortcut"
```

---

### Task 4: 类型定义更新与设置开关

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/stores/settings.ts`

- [ ] **Step 1: 在 types/index.ts 添加 AIActionConfig 类型**

在 `src/types/index.ts` 文件末尾添加：

```typescript
export interface AIActionConfig {
  enabled: boolean
  position: 'top' | 'bottom'
  showIcons: boolean
}
```

- [ ] **Step 2: 在 settings.ts 添加开关与持久化**

在 `useSettingsStore` 函数内，`voiceInputLanguage` 之后添加：

```typescript
const enableAIActions = ref(true)
const enableSmartPaste = ref(true)
const enableStatusBar = ref(true)
```

在 `initSettings` 中添加持久化读取：

```typescript
enableAIActions.value = await persistGet<boolean>('enable_ai_actions', true)
enableSmartPaste.value = await persistGet<boolean>('enable_smart_paste', true)
enableStatusBar.value = await persistGet<boolean>('enable_status_bar', true)
```

添加 watch 持久化：

```typescript
watch(enableAIActions, (val) => { persistSet('enable_ai_actions', val) })
watch(enableSmartPaste, (val) => { persistSet('enable_smart_paste', val) })
watch(enableStatusBar, (val) => { persistSet('enable_status_bar', val) })
```

在 return 中添加导出：

```typescript
enableAIActions, enableSmartPaste, enableStatusBar,
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/stores/settings.ts
git commit -m "feat: add AI action, smart paste, status bar settings with persistence"
```

---

### Task 5: 集成 AI Action 到编辑器

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: 注册 AI Action Extension**

在 `<script setup>` 的 import 区域添加：

```typescript
import { aiActionPlugin, aiActionKeymap } from '@/extensions/ai-actions/aiActionPlugin'
import '@/extensions/ai-actions/styles.css'
```

在 `createEditor` 函数内，`livePreviewCompartment` 声明后添加：

```typescript
const aiActionCompartment = new Compartment()
```

在 `extensions` 数组中，`livePreviewCompartment` 之后添加：

```typescript
aiActionCompartment.of(settingsStore.enableAIActions ? [aiActionPlugin, aiActionKeymap] : []),
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Editor.vue
git commit -m "feat: integrate AI action menu into editor"
```

---

## 功能二：字数统计状态栏

### Task 6: 状态栏组件

**Files:**
- Create: `src/components/editor/StatusBar.vue`

- [ ] **Step 1: 实现状态栏 Vue 组件**

```vue
<template>
  <div class="status-bar" v-if="visible">
    <div class="status-left">
      <span class="status-item" title="总字符数">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        {{ formattedCharCount }} 字
      </span>
      <span class="status-divider"></span>
      <span class="status-item" title="行数">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        {{ formattedLineCount }} 行
      </span>
      <span class="status-divider"></span>
      <span class="status-item" title="预计阅读时间">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {{ readingTime }}
      </span>
      <span class="status-divider"></span>
      <span class="status-item" title="光标位置">
        Ln {{ cursorLine }}, Col {{ cursorCol }}
      </span>
    </div>
    <div class="status-right">
      <span class="status-item status-selection" v-if="selectedText">
        已选 {{ selectedCharCount }} 字
      </span>
      <span class="status-item" :class="{ connected: aiConnected }" title="AI 连接状态">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
        {{ aiConnected ? 'AI 在线' : 'AI 离线' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  visible?: boolean
  charCount: number
  lineCount: number
  cursorLine: number
  cursorCol: number
  selectedText: string
  aiConnected: boolean
}>()

const formattedCharCount = computed(() => {
  if (props.charCount >= 10000) {
    return (props.charCount / 10000).toFixed(1) + '万'
  }
  return props.charCount.toLocaleString()
})

const formattedLineCount = computed(() => {
  if (props.lineCount >= 1000) {
    return (props.lineCount / 1000).toFixed(1) + 'k'
  }
  return props.lineCount.toLocaleString()
})

const readingTime = computed(() => {
  // 中文字均阅读速度 ~400字/分钟
  const minutes = Math.ceil(props.charCount / 400)
  if (minutes < 1) return '< 1 分钟'
  if (minutes === 1) return '1 分钟'
  return `${minutes} 分钟`
})

const selectedCharCount = computed(() => props.selectedText.length)
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  min-height: 24px;
  padding: 0 var(--space-3);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  font-size: 10.5px;
  color: var(--text-muted);
  user-select: none;
  overflow: hidden;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.status-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  cursor: default;
  white-space: nowrap;
}

.status-item:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.status-divider {
  width: 1px;
  height: 10px;
  background: var(--border-default);
  margin: 0 2px;
}

.status-selection {
  color: var(--accent-primary);
  font-weight: 600;
}

.status-item.connected svg {
  color: #22c55e;
}

.status-item:not(.connected) svg {
  color: var(--text-muted);
  opacity: 0.5;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/StatusBar.vue
git commit -m "feat: add editor status bar with word count, lines, reading time, AI status"
```

---

### Task 7: 集成 StatusBar 到 Editor.vue

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: 添加 StatusBar 到模板**

在 `Editor.vue` 的 template 中，`editor-toolbar` div 之后、`</div>` 之前，添加：

```html
<StatusBar
  v-if="settingsStore.enableStatusBar"
  :char-count="docStats.charCount"
  :line-count="docStats.lineCount"
  :cursor-line="docStats.cursorLine"
  :cursor-col="docStats.cursorCol"
  :selected-text="docStats.selectedText"
  :ai-connected="docStats.aiConnected"
/>
```

在 `<script setup>` 的 import 区域添加：

```typescript
import StatusBar from '@/components/editor/StatusBar.vue'
import { aiService } from '@/services/ai'
```

在 `createEditor` 函数之前添加响应式状态：

```typescript
const docStats = ref({
  charCount: 0,
  lineCount: 0,
  cursorLine: 1,
  cursorCol: 1,
  selectedText: '',
  aiConnected: false
})

const updateDocStats = (view: EditorView) => {
  const doc = view.state.doc
  const pos = view.state.selection.main.head
  const line = doc.lineAt(pos)
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  docStats.value = {
    charCount: doc.length,
    lineCount: doc.lines,
    cursorLine: line.number,
    cursorCol: pos - line.from + 1,
    selectedText: selected,
    aiConnected: aiService.getActiveProvider()?.status === 'connected'
  }
}
```

在 `EditorView.updateListener.of(...)` 的回调中，`emit('selection-change', selectedText)` 之后添加：

```typescript
updateDocStats(update.view)
```

在 `onMounted` 的 `createEditor()` 之后添加初始化：

```typescript
if (editorView.value) {
  updateDocStats(editorView.value)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Editor.vue
git commit -m "feat: integrate status bar into editor with live stats"
```

---

## 功能三：智能粘贴

### Task 8: Smart Paste Handler

**Files:**
- Create: `src/extensions/smart-paste/pasteHandler.ts`

- [ ] **Step 1: 实现纯文本粘贴 Extension**

```typescript
import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

function cleanPastedContent(text: string): string {
  // 1. 将常见的智能引号转为普通引号
  text = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')

  // 2. 将非换行空格转为普通空格（保留缩进用的空格）
  text = text.replace(/\u00A0/g, ' ')

  // 3. 移除零宽字符
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '')

  // 4. 规范化换行：3个以上的连续换行压缩为2个
  text = text.replace(/\n{3,}/g, '\n\n')

  // 5. 移除行尾空白
  text = text.split('\n').map(line => line.trimEnd()).join('\n')

  return text
}

function convertHTMLToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const children = Array.from(el.childNodes).map(processNode).join('')

    switch (el.tagName.toLowerCase()) {
      case 'h1': return `# ${children}\n\n`
      case 'h2': return `## ${children}\n\n`
      case 'h3': return `### ${children}\n\n`
      case 'h4': return `#### ${children}\n\n`
      case 'h5': return `##### ${children}\n\n`
      case 'h6': return `###### ${children}\n\n`
      case 'p': return `${children}\n\n`
      case 'br': return '\n'
      case 'strong': case 'b': return `**${children}**`
      case 'em': case 'i': return `*${children}*`
      case 'code': return `\`${children}\``
      case 'pre': return `\`\`\`\n${children}\n\`\`\`\n\n`
      case 'a': {
        const href = el.getAttribute('href') || ''
        return `[${children}](${href})`
      }
      case 'img': {
        const src = el.getAttribute('src') || ''
        const alt = el.getAttribute('alt') || ''
        return `![${alt}](${src})`
      }
      case 'ul': return `\n${children}\n`
      case 'ol': return `\n${children}\n`
      case 'li': {
        const parent = el.parentElement
        if (parent?.tagName.toLowerCase() === 'ol') {
          return `1. ${children}\n`
        }
        return `- ${children}\n`
      }
      case 'blockquote': {
        return children.split('\n').filter(l => l).map(l => `> ${l}`).join('\n') + '\n\n'
      }
      case 'hr': return '---\n\n'
      case 'div': case 'section': case 'article': case 'span':
        return children
      default:
        return children
    }
  }

  return processNode(doc.body).replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export const smartPasteExtension = EditorView.domEventHandlers({
  paste(event, view) {
    const clipboardData = event.clipboardData
    if (!clipboardData) return false

    // 获取 HTML 和纯文本
    const html = clipboardData.getData('text/html')
    const plainText = clipboardData.getData('text/plain')

    // 如果有 HTML 内容（来自富文本源），尝试转换为 Markdown
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
        // HTML 解析失败，降级到纯文本
      }
    }

    // 纯文本粘贴：只做基础清理
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

- [ ] **Step 2: Commit**

```bash
git add src/extensions/smart-paste/pasteHandler.ts
git commit -m "feat: add smart paste handler with HTML-to-Markdown conversion"
```

---

### Task 9: 集成 Smart Paste 到编辑器

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: 注册 Smart Paste Extension**

在 `<script setup>` 的 import 区域添加：

```typescript
import { smartPasteExtension } from '@/extensions/smart-paste/pasteHandler'
```

在 `createEditor` 的 `extensions` 数组中，`aiActionCompartment` 之后添加：

```typescript
...(settingsStore.enableSmartPaste ? [smartPasteExtension] : []),
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Editor.vue
git commit -m "feat: integrate smart paste into editor"
```

---

## 功能四：大纲实时联动高亮

### Task 10: 大纲面板 activeHeading 支持

**Files:**
- Modify: `src/components/editor/OutlinePanel.vue`

- [ ] **Step 1: 添加 activeHeading 属性和样式**

修改 `<script setup>` 部分，添加 `activeHeadingFrom` prop：

```typescript
interface Heading {
  level: number
  text: string
  from: number
  to: number
}

const props = defineProps<{
  headings: Heading[]
  activeHeadingFrom?: number
}>()

defineEmits<{
  (e: 'select', heading: Heading): void
}>()
```

修改模板中的 `.outline-item`，添加 active 类绑定：

```html
<div
  v-for="heading in headings"
  :key="heading.from"
  class="outline-item"
  :class="{
    [`level-${heading.level}`]: true,
    active: activeHeadingFrom !== undefined && heading.from === activeHeadingFrom
  }"
  @click="$emit('select', heading)"
>
  {{ heading.text }}
</div>
```

在 `<style scoped>` 中添加 active 样式，在 `.outline-item:hover` 之后：

```css
.outline-item.active {
  background: var(--accent-soft);
  color: var(--accent-primary);
  font-weight: 600;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/OutlinePanel.vue
git commit -m "feat: add active heading tracking to outline panel"
```

---

### Task 11: 编辑器暴露滚动位置并联动大纲

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: 暴露当前可视区域最近的标题位置**

在 `<script setup>` 中添加 Emit：

```typescript
const emit = defineEmits<{
  'update:modelValue': [value: string]
  update: [content: string]
  'cursor-change': [line: number]
  'selection-change': [text: string]
  'active-heading': [from: number]
}>()
```

在 `updateDocStats` 函数附近，添加滚动监听，计算当前可视区域最接近顶部的标题。在 `createEditor` 的 `extensions` 中，`EditorView.updateListener.of(...)` 之后添加：

```typescript
EditorView.domEventHandlers({
  scroll(event, view) {
    const scroller = view.scrollDOM
    const scrollTop = scroller.scrollTop

    // 找到可视区域顶部最近的标题
    const pos = view.posAtCoords({ x: 100, y: scrollTop + 50 })
    if (pos === null) return false

    // 向上搜索最近的标题行
    const doc = view.state.doc
    let currentLine = doc.lineAt(pos)
    let foundHeading = false

    for (let i = 0; i < 20; i++) {
      const lineText = currentLine.text
      const headingMatch = lineText.match(/^(#{1,6})\s+(.+)/)
      if (headingMatch) {
        emit('active-heading', currentLine.from)
        foundHeading = true
        break
      }
      if (currentLine.number <= 1) break
      currentLine = doc.line(currentLine.number - 1)
    }

    if (!foundHeading) {
      emit('active-heading', -1)
    }

    return false
  }
}),
```

- [ ] **Step 2: 在 AIPanel.vue 或父组件中连接 active-heading 事件到 OutlinePanel**

这个步骤需要查看父组件如何传递 headings 和 activeHeadingFrom 给 OutlinePanel。选择直接修改 Editor.vue 的 `defineExpose` 并在使用 Editor 的地方传递。

更简单的方案：在 Editor.vue 中添加 `activeHeadingFrom` 为暴露的状态，让父组件通过 ref 访问。

```typescript
const activeHeadingFrom = ref(-1)

// 在 EditorView.domEventHandlers 的回调中：
// emit('active-heading', currentLine.from)
// 改为：
activeHeadingFrom.value = currentLine.from
```

在 `defineExpose` 中添加：

```typescript
activeHeadingFrom
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Editor.vue
git commit -m "feat: expose active heading position for outline sync"
```

---

### Task 12: 最终集成 — 统一注册所有新 Extension

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: 最终检查 Editor.vue**

确保 `createEditor` 中的 extensions 数组包含所有新 Extension。最终结构：

```typescript
const createEditor = () => {
  if (!editorContainer.value) return

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      markdown(),
      oneDark,
      keymap.of([indentWithTab]),
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
      livePreviewCompartment.of(settingsStore.livePreview ? livePreviewPlugin : []),
      aiActionCompartment.of(settingsStore.enableAIActions ? [aiActionPlugin, aiActionKeymap] : []),
      ...(settingsStore.enableSmartPaste ? [smartPasteExtension] : []),
      placeholder('开始写作...'),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString()
          ignoreNextUpdate = true
          emit('update:modelValue', content)
          emit('update', content)
        }
        if (update.selectionSet || update.docChanged) {
          const pos = update.state.selection.main.head
          const line = update.state.doc.lineAt(pos).number
          emit('cursor-change', line)
          const { from, to } = update.state.selection.main
          const selectedText = update.state.sliceDoc(from, to)
          emit('selection-change', selectedText)
        }
        updateDocStats(update.view)
      }),
      EditorView.domEventHandlers({
        scroll(_event, view) {
          const scroller = view.scrollDOM
          const scrollTop = scroller.scrollTop
          const pos = view.posAtCoords({ x: 100, y: scrollTop + 50 })
          if (pos === null) return false
          const doc = view.state.doc
          let currentLine = doc.lineAt(pos)
          for (let i = 0; i < 20; i++) {
            const match = currentLine.text.match(/^(#{1,6})\s+(.+)/)
            if (match) {
              activeHeadingFrom.value = currentLine.from
              return false
            }
            if (currentLine.number <= 1) break
            currentLine = doc.line(currentLine.number - 1)
          }
          activeHeadingFrom.value = -1
          return false
        }
      }),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.8'
        },
        '.cm-content': {
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.8',
          padding: '16px 0'
        },
        '.cm-gutters': {
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.8'
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'var(--font-mono)'
        },
        '&.cm-focused': {
          outline: 'none'
        }
      })
    ]
  })

  editorView.value = new EditorView({
    state: startState,
    parent: editorContainer.value
  })
}
```

在 `defineExpose` 中确认包含：

```typescript
defineExpose({
  setContent,
  insertText,
  getSelectedText,
  activeHeadingFrom
})
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Editor.vue
git commit -m "feat: unified registration of AI actions, smart paste, and outline sync"
```

---

## 自检清单

### 1. 规格覆盖

| 需求 | 对应 Task |
|------|-----------|
| 选中文本 AI 操作菜单（解释、翻译、润色、扩写、摘要、纠错、续写） | Task 1-5 |
| 字数统计 + 行数 + 阅读时间状态栏 | Task 6-7 |
| 智能粘贴（富文本转 Markdown + 格式清理） | Task 8-9 |
| 大纲实时联动高亮 | Task 10-12 |

### 2. Placeholder 扫描

- 无 TBD / TODO / "implement later" 等占位符
- 所有步骤包含完整代码
- 所有步骤包含确切命令

### 3. 类型一致性

- `AIAction` / `AIActionConfig` 在 `types.ts` 定义，在 `AIActionMenuWidget.ts` 和 `aiActionPlugin.ts` 中引用
- `enableAIActions` / `enableSmartPaste` / `enableStatusBar` 在 `settings.ts` 中定义，在 `Editor.vue` 中引用
- `Heading` 接口在 `OutlinePanel.vue` 中扩展了 `activeHeadingFrom` prop
- `TauriAIProvider.streamChat()` 签名在 `ai.ts` 中定义，在 AI Action Widget 中一致使用
- 所有新 Compartment 与现有 `readOnlyCompartment` / `livePreviewCompartment` 模式保持一致

### 4. 与已有计划无冲突

- 本计划的功能独立于 `2026-05-24-ai-native-features.md` 中的 Ghost Text、Inline Edit、Multimodal、RAG 四大功能
- AI Action Menu 与 Inline Edit 互补（Inline Edit 是选中即改写弹出 Diff，AI Action 是选中弹出多功能菜单）
- 使用不同的 Compartment 注册，不会产生冲突