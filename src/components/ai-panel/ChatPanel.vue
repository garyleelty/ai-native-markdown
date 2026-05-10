<template>
  <div class="chat-panel">
    <div class="chat-header">
      <div class="chat-header-left">
        <span class="chat-title">AI 助手</span>
        <span class="chat-model" v-if="activeModel">{{ activeModel }}</span>
      </div>
      <button class="chat-clear" @click="clearMessages" title="清空对话">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </div>

    <div class="chat-messages" ref="messagesRef">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="chat-message"
        :class="msg.role"
      >
        <div class="message-avatar">
          <svg v-if="msg.role === 'assistant'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div class="message-content">
          <div class="message-text" v-html="renderMarkdown(msg.content)"></div>
          <div class="message-actions" v-if="msg.role === 'assistant'">
            <button @click="copyMessage(msg.content)" title="复制">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </button>
            <button @click="$emit('insert', msg.content)" title="插入到编辑器">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button @click="regenerate(msg)" title="重新生成" :disabled="streaming">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="streaming" class="chat-message assistant streaming">
        <div class="message-avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z"/></svg>
        </div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <div class="input-wrapper">
        <textarea
          v-model="inputText"
          class="chat-input"
          placeholder="输入问题..."
          rows="2"
          @keydown.enter.prevent="sendMessage"
        ></textarea>
        <VoiceInputButton
          :mode="settingsStore.voiceInputMode"
          :language="settingsStore.voiceInputLanguage"
          @result="handleVoiceResult"
          @error="handleVoiceError"
        />
        <button class="chat-send" @click="sendMessage" :disabled="!inputText.trim() || streaming">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { aiService } from '../../services/ai'
import type { AIMessage } from '@/types'
import VoiceInputButton from '../ui/VoiceInputButton.vue'
import { useSettingsStore } from '@/stores'

const props = defineProps<{
  context?: string
}>()

const emit = defineEmits<{
  (e: 'insert', content: string): void
}>()

const messages = ref<AIMessage[]>([])
const inputText = ref('')
const streaming = ref(false)
const messagesRef = ref<HTMLDivElement>()

const activeModel = computed(() => {
  const provider = aiService.getActiveProvider()
  return provider ? provider.getConfig().model : null
})

const scrollToBottom = async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

const renderMarkdown = (text: string) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || streaming.value) return

  const userMsg: AIMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: text,
    timestamp: Date.now()
  }
  messages.value.push(userMsg)
  inputText.value = ''
  await scrollToBottom()

  const assistantMsg: AIMessage = {
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  }
  messages.value.push(assistantMsg)
  streaming.value = true

  try {
    const provider = aiService.getActiveProvider()
    if (!provider) {
      assistantMsg.content = '请先配置 AI Provider'
      streaming.value = false
      return
    }

    const chatMessages = messages.value
      .filter(m => m.role !== 'system')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }))

    if (props.context) {
      chatMessages.unshift({ role: 'system', content: `当前文档内容：\n${props.context}` })
    }

    for await (const chunk of provider.chat(chatMessages)) {
      assistantMsg.content += chunk
      await scrollToBottom()
    }
  } catch (error: any) {
    assistantMsg.content = `错误: ${error.message || String(error)}`
  } finally {
    streaming.value = false
  }
}

const regenerate = async (msg: AIMessage) => {
  const index = messages.value.findIndex(m => m.id === msg.id)
  if (index === -1) return
  messages.value = messages.value.slice(0, index)
  inputText.value = messages.value[index - 1]?.content || ''
  await sendMessage()
}

const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

const clearMessages = () => {
  messages.value = []
}

// 语音输入相关
const settingsStore = useSettingsStore()

const handleVoiceResult = (text: string) => {
  inputText.value += text
}

const handleVoiceError = (message: string) => {
  console.warn('语音输入错误:', message)
}

watch(messages, scrollToBottom, { deep: true })
</script>

<style scoped>
.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-base);
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.chat-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.chat-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}
.chat-model {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
}
.chat-clear {
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.chat-clear:hover {
  color: var(--error);
  background: rgba(248, 113, 113, 0.1);
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.chat-message {
  display: flex;
  gap: var(--space-2);
  max-width: 100%;
  animation: messageIn 0.2s ease-out;
}
@keyframes messageIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.chat-message.user {
  flex-direction: row-reverse;
}
.message-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-surface);
  color: var(--text-muted);
  margin-top: 2px;
}
.chat-message.assistant .message-avatar {
  background: var(--accent-soft);
  color: var(--accent);
}
.message-content {
  max-width: calc(100% - 36px);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
}
.chat-message.user .message-content {
  background: var(--accent-soft);
  color: var(--text-primary);
}
.message-text :deep(pre) {
  background: var(--bg-mantle);
  padding: var(--space-3);
  border-radius: var(--radius-xs);
  overflow-x: auto;
  font-size: 12px;
  margin: var(--space-2) 0;
  border: 1px solid var(--border-subtle);
}
.message-text :deep(code) {
  background: var(--bg-mantle);
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--accent);
}
.message-actions {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-subtle);
}
.message-actions button {
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.message-actions button:hover {
  color: var(--accent);
  background: var(--bg-hover);
}
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}
.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: typing 1.4s infinite ease-in-out both;
}
.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.chat-input-area {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
  background: var(--bg-base);
}
.input-wrapper {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}
.chat-input {
  flex: 1;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
  resize: none;
  outline: none;
  font-family: var(--font-sans);
  transition: all var(--transition-fast);
  min-height: 40px;
}
.chat-input:focus {
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
}
.chat-input::placeholder {
  color: var(--text-muted);
}
.chat-send {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}
.chat-send:hover:not(:disabled) {
  background: var(--accent-hover);
}
.chat-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>