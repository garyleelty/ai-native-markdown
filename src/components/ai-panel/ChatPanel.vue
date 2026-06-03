<template>
  <div class="chat-panel">
    <div class="chat-header">
      <div class="chat-header-left">
        <el-text class="chat-title" type="info" tag="strong">AI 助手</el-text>
        <el-tag v-if="activeModel" size="small" type="info" effect="plain">
          {{ activeModel }}
        </el-tag>
      </div>
      <el-button
        :icon="Delete"
        circle
        size="small"
        aria-label="清空对话"
        @click="clearMessages"
        title="清空对话"
      />
    </div>

    <div class="chat-messages" ref="messagesRef">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="chat-message"
        :class="msg.role"
      >
        <div class="message-avatar">
          <el-icon :size="18">
            <ChatDotRound v-if="msg.role === 'assistant'" />
            <User v-else />
          </el-icon>
        </div>
        <div class="message-content">
          <div class="message-text" v-html="renderMarkdown(msg.content)"></div>
          <div class="message-actions" v-if="msg.role === 'assistant'">
            <el-button
              :icon="CopyDocument"
              size="small"
              circle
              aria-label="复制"
              @click="copyMessage(msg.content)"
              title="复制"
            />
            <el-button
              :icon="Plus"
              size="small"
              circle
              aria-label="插入到编辑器"
              @click="$emit('insert', msg.content)"
              title="插入到编辑器"
            />
            <el-button
              :icon="Refresh"
              size="small"
              circle
              aria-label="重新生成"
              @click="regenerate(msg)"
              title="重新生成"
              :disabled="streaming"
            />
          </div>
        </div>
      </div>

      <div v-if="streaming" class="chat-message assistant streaming">
        <div class="message-avatar">
          <el-icon :size="18">
            <ChatDotRound />
          </el-icon>
        </div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <QuickActions v-if="messages.length === 0" @action="handleQuickAction" />
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="2"
        placeholder="输入问题..."
        resize="none"
        @keydown.enter.exact.prevent="sendMessage"
        @keydown.shift.enter.exact.stop
      />
      <el-button
          v-if="streaming"
          type="danger"
          :icon="VideoPause"
          circle
          aria-label="停止"
          @click="stopStreaming"
          title="停止"
        />
      <template v-else>
        <VoiceInputButton mode="toggle" @result="handleVoiceResult" />
        <el-button
          type="primary"
          :icon="Promotion"
          circle
          aria-label="发送"
          @click="sendMessage"
          :disabled="!inputText.trim()"
          title="发送"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { aiService } from '@/services/ai'
import { ragService } from '@/services/rag'
import type { AIMessage } from '@/types'
import { useSettingsStore } from '@/stores'
import { throttle } from '@/composables/useDebounce'
import { ElMessage } from 'element-plus'
import { sanitizeMarkdown } from '@/utils/security'
import {
  User,
  ChatDotRound,
  Delete,
  CopyDocument,
  Plus,
  Refresh,
  Promotion,
  VideoPause
} from '@element-plus/icons-vue'
import QuickActions from './QuickActions.vue'
import VoiceInputButton from '@/components/ui/VoiceInputButton.vue'

const props = defineProps<{
  context?: string
}>()

const emit = defineEmits<{
  (e: 'insert', content: string): void
}>()

const CHAT_HISTORY_KEY = 'ai_chat_history'
const MAX_HISTORY_MESSAGES = 50
const MAX_HISTORY_BYTES = 200_000
const BASE_SYSTEM_PROMPT = '你是一个专业的 Markdown 写作助手。'

function loadChatHistory(): AIMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AIMessage[]
    return parsed.slice(-MAX_HISTORY_MESSAGES)
  } catch {
    return []
  }
}

function saveChatHistory(msgs: AIMessage[]) {
  try {
    let toSave = msgs.slice(-MAX_HISTORY_MESSAGES)
    let serialized = JSON.stringify(toSave)
    while (serialized.length > MAX_HISTORY_BYTES && toSave.length > 0) {
      toSave = toSave.slice(1)
      serialized = JSON.stringify(toSave)
    }
    localStorage.setItem(CHAT_HISTORY_KEY, serialized)
  } catch {
  }
}

function buildSystemContent(documentContext: string | undefined, ragContext: string): string {
  const contextParts = [BASE_SYSTEM_PROMPT]
  if (ragContext) {
    contextParts.push(`以下是相关的文档上下文：\n\n${ragContext}\n\n请优先基于上下文回答用户问题。`)
  }
  if (documentContext) {
    contextParts.push(`当前文档内容：\n${documentContext}`)
  }
  return contextParts.join('\n\n')
}

const messages = ref<AIMessage[]>(loadChatHistory())
const inputText = ref('')
const streaming = ref(false)
let currentAbortController: AbortController | null = null
const messagesRef = ref<HTMLDivElement>()

const settingsStore = useSettingsStore()

const activeModel = computed(() => {
  const provider = aiService.getActiveProvider()
  return provider ? provider.getConfig().model : null
})

const scrollToBottom = throttle(async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}, 100)

const renderMarkdown = (text: string) => {
  const codeBlocks: string[] = []
  const inlineCodes: string[] = []

  const preserved = text
    .replace(/```([\s\S]*?)```/g, (_, code) => {
      codeBlocks.push(`<pre><code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
      return `\x00CB${codeBlocks.length - 1}\x00`
    })
    .replace(/`([^`]+)`/g, (_, code) => {
      inlineCodes.push(`<code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`)
      return `\x00IC${inlineCodes.length - 1}\x00`
    })

  const rendered = preserved
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')

  return sanitizeMarkdown(rendered
    .replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)])
    .replace(/\x00IC(\d+)\x00/g, (_, i) => inlineCodes[parseInt(i)]))
}

const addCopyButtons = () => {
  nextTick(() => {
    const codeBlocks = messagesRef.value?.querySelectorAll('pre code')
    codeBlocks?.forEach((block) => {
      const pre = block.parentElement
      if (pre && !pre.querySelector('.copy-btn')) {
        const btn = document.createElement('button')
        btn.className = 'copy-btn'
        btn.textContent = '复制'
        btn.onclick = () => {
          navigator.clipboard.writeText(block.textContent || '')
          btn.textContent = '已复制'
          setTimeout(() => { btn.textContent = '复制' }, 2000)
        }
        pre.style.position = 'relative'
        pre.appendChild(btn)
      }
    })
  })
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || streaming.value) return

  const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const userMsg: AIMessage = {
      id: uid(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    messages.value.push(userMsg)
    inputText.value = ''
    await scrollToBottom()

    const assistantMsg: AIMessage = {
      id: uid(),
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

    let ragContext = ''
    if (settingsStore.enableRAG) {
      try {
        ragContext = await ragService.buildContext(text, 2000)
      } catch {
        ragContext = ''
      }
    }

    chatMessages.unshift({ role: 'system', content: buildSystemContent(props.context, ragContext) })

    currentAbortController = new AbortController()
    for await (const chunk of provider.streamChat(chatMessages, { signal: currentAbortController.signal })) {
      assistantMsg.content += chunk
      await scrollToBottom()
    }
  } catch (error: any) {
    assistantMsg.content = `错误: ${error.message || String(error)}`
    ElMessage.error('AI 请求失败')
  } finally {
    streaming.value = false
    currentAbortController = null
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
    ElMessage.success('已复制到剪贴板')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('已复制到剪贴板')
  }
}

const stopStreaming = () => {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
  streaming.value = false
}

const clearMessages = () => {
  messages.value = []
}

const handleQuickAction = (prompt: string, _label: string) => {
  inputText.value = prompt
  sendMessage()
}

const handleVoiceResult = (text: string) => {
  inputText.value += text
}

watch(messages, () => { scrollToBottom(); addCopyButtons(); saveChatHistory(messages.value) }, { deep: true })
</script>

<style scoped>
.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--obsidian-bg-secondary);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--obsidian-bg-secondary);
  border-bottom: 1px solid var(--obsidian-border);
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chat-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--obsidian-text-normal);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: var(--obsidian-text-faint) transparent;
}

.chat-messages::-webkit-scrollbar {
  width: 4px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--obsidian-text-faint);
  border-radius: 2px;
}

.chat-message {
  display: flex;
  gap: 8px;
  max-width: 100%;
  animation: messageIn var(--duration-fast) var(--ease-default);
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(2px); }
  to { opacity: 1; transform: translateY(0); }
}

.chat-message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--obsidian-bg-tertiary);
  color: var(--obsidian-text-muted);
  margin-top: 2px;
}

.chat-message.assistant .message-avatar {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
}

.chat-message.user .message-avatar {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
}

.message-content {
  max-width: calc(100% - 40px);
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font-size: 13px;
  line-height: 1.55;
  color: var(--obsidian-text-normal);
  font-family: var(--font-sans);
}

.chat-message.user .message-content {
  background: var(--obsidian-accent-soft);
  border: none;
}

.chat-message.assistant .message-content {
  background: var(--obsidian-bg-hover);
  border: none;
  border-left: 2px solid var(--obsidian-accent);
}

.message-text :deep(pre) {
  background: var(--obsidian-bg-primary);
  padding: 10px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  font-size: 12px;
  margin: 6px 0;
  border: none;
  font-family: var(--font-mono);
}

.message-text :deep(code) {
  background: var(--obsidian-bg-primary);
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--obsidian-accent);
}

.message-text :deep(pre code) {
  background: none;
  padding: 0;
  color: var(--obsidian-text-normal);
}

.message-actions {
  display: flex;
  gap: 2px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--obsidian-border);
}

.message-actions :deep(.el-button) {
  width: 22px;
  height: 22px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--obsidian-accent);
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.chat-input-area {
  padding: 8px 12px;
  border-top: 1px solid var(--obsidian-border);
  flex-shrink: 0;
  background: var(--obsidian-bg-secondary);
  display: flex;
  gap: 6px;
  align-items: flex-end;
}

.chat-input-area :deep(.el-textarea__inner) {
  background: var(--obsidian-bg-primary);
  color: var(--obsidian-text-normal);
  border-color: var(--obsidian-border);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: 13px;
  padding: 6px 10px;
  box-shadow: none;
}

.chat-input-area :deep(.el-textarea__inner:focus) {
  border-color: var(--obsidian-accent);
  box-shadow: none;
}

.chat-input-area :deep(.el-textarea__inner::placeholder) {
  color: var(--obsidian-text-faint);
}

.chat-input-area :deep(.el-button--primary) {
  background: var(--obsidian-accent);
  border-color: var(--obsidian-accent);
}

.chat-input-area :deep(.el-button--primary:hover) {
  background: var(--obsidian-accent);
  border-color: var(--obsidian-accent);
  opacity: 0.85;
}

.chat-input-area :deep(.el-button--danger) {
  background: transparent;
  border-color: var(--obsidian-text-faint);
  color: var(--obsidian-text-muted);
}

.copy-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--obsidian-bg-tertiary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
  font-size: 11px;
  font-family: var(--font-sans);
  color: var(--obsidian-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-default);
}

pre:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  background: var(--obsidian-bg-hover);
  color: var(--obsidian-text-normal);
}
</style>
