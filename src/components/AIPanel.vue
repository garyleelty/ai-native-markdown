<template>
  <!-- 内嵌式 AI 面板 - 纯操作面板 -->
  <div class="ai-panel-embedded">
    <div class="ai-panel-header">
      <div class="header-left">
        <span class="panel-icon">✦</span>
        <span class="panel-title">AI Assistant</span>
      </div>
      <div class="header-right">
        <button class="header-btn close-btn" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <div class="ai-body">
      <!-- 操作按钮 -->
      <div class="ai-actions-row">
        <button 
          v-for="action in actions" 
          :key="action.id"
          class="action-chip"
          :class="{ active: currentAction === action.label, disabled: loading }"
          @click="handleAction(action)"
          :disabled="loading"
        >
          <component :is="'svg'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="action.icon"></component>
          {{ action.label }}
        </button>
      </div>

      <!-- 输出区 -->
      <div class="ai-output-area" :class="{ 'has-content': output || loading }">
        <div v-if="!output && !loading" class="output-placeholder">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1"><path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/></svg>
          <p>选择操作开始使用 AI 辅助</p>
        </div>
        
        <template v-else>
          <div class="output-meta">
            <span class="output-action-tag">{{ currentAction }}</span>
            <button v-if="output" class="accept-chip" @click="acceptOutput">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              插入编辑器
            </button>
          </div>
          
          <div class="output-content" ref="outputRef">
            <div v-if="loading" class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
            <pre v-else class="output-text">{{ output }}</pre>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { aiService } from '../services/ai'

interface Props { editorContent?: string; selectedText?: string }
const props = withDefaults(defineProps<Props>(), { editorContent: '', selectedText: '' })
const emit = defineEmits<{ (e: 'insert', text: string): void; (e: 'close'): void }>()

const loading = ref(false)
const output = ref('')
const currentAction = ref('')
const outputRef = ref<HTMLElement>()

const handleAI = async (prompt: string) => {
  loading.value = true
  output.value = ''
  
  await nextTick()
  if (outputRef.value) {
    outputRef.value.scrollTop = 0
  }
  
  try {
    const provider = aiService.getActiveProvider()
    if (!provider) {
      output.value = '⚠️ 未配置 AI 服务，请在左侧 AI CONFIG 面板中配置并保存后使用'
      return
    }
    
    for await (const chunk of provider.streamComplete(prompt)) {
      output.value += chunk
      await nextTick()
      if (outputRef.value) {
        outputRef.value.scrollTop = outputRef.value.scrollHeight
      }
    }
  } catch (error: any) { 
    output.value = `⚠️ ${error?.message || error}` 
  } finally { 
    loading.value = false 
  }
}

const handleContinueWrite = () => handleAI(`请继续续写以下内容，保持风格一致，直接输出续写部分不要加任何前缀：

${props.editorContent.slice(-500)}`)

const handlePolish = () => handleAI(`请润色以下内容，保持原意和长度，直接输出润色后的结果：

${props.selectedText || props.editorContent}`)

const handleSummarize = () => handleAI(`请用简洁的语言生成以下内容的摘要：

${props.editorContent}`)

const handleFormat = () => handleAI(`请格式化以下 Markdown 内容，优化排版和结构：

${props.selectedText || props.editorContent}`)

// 操作定义（必须在 handler 函数之后）
const actions = [
  { id: 'continue', label: '续写', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>', handler: handleContinueWrite },
  { id: 'polish', label: '润色', icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', handler: handlePolish },
  { id: 'summarize', label: '摘要', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="7" x2="17" y2="7"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="17" x2="13" y2="17"/>', handler: handleSummarize },
  { id: 'format', label: '格式化', icon: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>', handler: handleFormat },
]

const handleAction = (action: any) => {
  if (loading.value) return
  currentAction.value = action.label
  action.handler()
}

const acceptOutput = () => { emit('insert', output.value); output.value = ''; currentAction.value = '' }
</script>

<style scoped>
/* 内嵌式 AI 面板 - 统一设计语言 */
.ai-panel-embedded {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-subtle);
  overflow: hidden;
}

/* 头部 */
.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: linear-gradient(180deg, var(--bg-surface0), transparent);
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.panel-icon {
  color: var(--accent-mauve);
  font-size: 16px;
  filter: drop-shadow(0 0 6px var(--accent-soft));
}
.panel-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: 0.03em;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.close-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  transition: all var(--transition-fast);
}
.close-btn:hover {
  color: var(--accent-red);
  background: var(--bg-hover);
}

/* 主体 */
.ai-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* 操作行 */
.ai-actions-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.action-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.action-chip:hover:not(.disabled) {
  color: var(--accent-mauve);
  border-color: rgba(203, 166, 247, 0.25);
  background: rgba(203, 166, 247, 0.06);
  transform: translateY(-1px);
}
.action-chip.active {
  color: #fff;
  background: linear-gradient(135deg, var(--accent-mauve), var(--accent));
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(203, 166, 247, 0.25);
}
.action-chip.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 输出区 */
.ai-output-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  min-height: 80px;
}
.ai-output-area.has-content {
  padding: 12px 16px;
}

.output-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  min-height: 120px;
  color: var(--text-muted);
}
.output-placeholder svg {
  opacity: 0.25;
}
.output-placeholder p {
  font-size: 12px;
  font-weight: 500;
}

.output-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.output-action-tag {
  font-size: 11px;
  font-weight: 800;
  color: var(--accent-mauve);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.output-action-tag::before {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--accent-mauve);
  border-radius: 50%;
  animation: pulse-dot 2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.4); }
}

.accept-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--accent);
  color: var(--bg-crust);
  border: none;
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.accept-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--shadow-glow);
}

.output-content {
  overflow-y: auto;
  max-height: calc(100% - 36px);
}
.output-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  margin: 0;
  animation: fade-in 0.25s ease-out;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 打字指示器 */
.typing-indicator {
  display: flex;
  gap: 6px;
  padding: 8px 0;
}
.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-mauve);
  animation: typing-bounce 1.4s infinite ease-in-out both;
  box-shadow: 0 0 8px var(--accent-soft);
}
.typing-indicator span:nth-child(1) { animation-delay: 0s; }
.typing-indicator span:nth-child(2) { animation-delay: 0.16s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.32s; }
@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.45); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}
</style>
