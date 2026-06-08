<template>
  <div class="chat-panel">
    <div class="chat-header">
      <div class="chat-header-left">
        <el-text class="chat-title" type="info" tag="strong">AI 助手</el-text>
        <el-tag v-if="activeModel" size="small" type="info" effect="plain">
          {{ activeModel }}
        </el-tag>
        <el-tag v-if="agentMode" size="small" type="warning" effect="plain">
          Agent
        </el-tag>
      </div>
      <div class="chat-header-right">
        <el-button
          :icon="SetUp"
          native-type="button"
          circle
          size="small"
          :type="agentMode ? 'warning' : 'default'"
          aria-label="切换 Agent 模式"
          @click="toggleAgentMode"
          title="切换 Agent 模式"
        />
        <el-button
          :icon="Delete"
          native-type="button"
          circle
          size="small"
          aria-label="清空对话"
          @click="clearMessages"
          title="清空对话"
        />
      </div>
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
          <div
            class="message-text"
            v-html="renderMarkdown(msg.content, msg.ragSources)"
            @click="handleMessageCitationClick($event, msg)"
            @mouseover="handleMessageCitationPreview($event, msg)"
            @focusin="handleMessageCitationPreview($event, msg)"
            @mouseout="handleMessageCitationPreviewEnd($event, msg)"
            @focusout="handleMessageCitationPreviewEnd($event, msg)"
          ></div>
          <div
            v-if="msg.role === 'assistant' && msg.ragSources?.length"
            class="message-sources"
            aria-label="RAG 来源"
          >
            <span class="sources-label">来源</span>
            <button
              v-for="source in msg.ragSources"
              :key="`${msg.id}-${source.id}-${source.filePath}-${source.chunkIndex}`"
              class="source-chip"
              type="button"
              :title="formatSourceTitle(source)"
              :aria-label="`打开 RAG 来源 ${formatSourceLabel(source)}`"
              :class="{ active: isSourcePreviewActive(msg.id, source.id) }"
              @mouseenter="showSourcePreview(msg.id, source)"
              @focus="showSourcePreview(msg.id, source)"
              @mouseleave="hideSourcePreview(msg.id, source.id)"
              @blur="hideSourcePreview(msg.id, source.id)"
              @click="openRAGSource(source)"
            >
              {{ formatSourceLabel(source) }}
            </button>
          </div>
          <div
            v-if="activeSourcePreview?.messageId === msg.id"
            class="source-preview"
            role="status"
            aria-label="RAG 来源预览"
          >
            <div class="source-preview-header">
              <span class="source-preview-id">{{ activeSourcePreview.source.id }}</span>
              <span class="source-preview-target">{{ formatSourceTarget(activeSourcePreview.source) }}</span>
            </div>
            <div
              v-if="activeSourcePreview.source.excerpt"
              class="source-preview-excerpt"
            >
              {{ activeSourcePreview.source.excerpt }}
            </div>
            <div v-else class="source-preview-empty">
              该历史来源没有保存预览文本，点击可打开原文。
            </div>
          </div>
          <div
            v-if="msg.role === 'assistant' && msg.toolCalls?.length"
            class="message-tool-calls"
            aria-label="工具调用记录"
          >
            <div class="tool-calls-label">工具调用</div>
            <div
              v-for="(tc, idx) in msg.toolCalls"
              :key="`${msg.id}-tc-${idx}`"
              class="tool-call-item"
              :class="{ 'tool-call-error': !tc.result.success }"
            >
              <div class="tool-call-header">
                <span class="tool-call-name">{{ tc.tool }}</span>
                <span class="tool-call-status" :class="tc.result.success ? 'success' : 'error'">
                  {{ tc.result.success ? '✓' : '✗' }}
                </span>
              </div>
              <div class="tool-call-params">
                <template v-for="(val, key) in tc.params" :key="key">
                  <span class="param-key">{{ key }}:</span>
                  <span class="param-value">{{ truncateParam(String(val)) }}</span>
                </template>
              </div>
              <div v-if="tc.result.display" class="tool-call-result">{{ tc.result.display }}</div>
              <div v-if="tc.result.error" class="tool-call-error-msg">{{ tc.result.error }}</div>
            </div>
          </div>
          <div class="message-actions" v-if="msg.role === 'assistant'">
            <el-button
              :icon="CopyDocument"
              native-type="button"
              size="small"
              circle
              aria-label="复制"
              @click="copyMessage(msg.content)"
              title="复制"
            />
            <el-button
              :icon="Plus"
              native-type="button"
              size="small"
              circle
              aria-label="插入到编辑器"
              @click="$emit('insert', msg.content)"
              title="插入到编辑器"
            />
            <el-button
              :icon="Refresh"
              native-type="button"
              size="small"
              circle
              aria-label="重新生成"
              @click="regenerate(msg)"
              title="重新生成"
              :disabled="streaming || isAgentRunning"
            />
          </div>
        </div>
      </div>

      <div v-if="streaming || isAgentRunning" class="chat-message assistant streaming">
        <div class="message-avatar">
          <el-icon :size="18">
            <ChatDotRound />
          </el-icon>
        </div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
          <div v-if="isAgentRunning" class="agent-status">Agent 正在执行...</div>
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
          v-if="streaming || isAgentRunning"
          type="danger"
          :icon="VideoPause"
          native-type="button"
          circle
          aria-label="停止"
          @click="stopAll"
          title="停止"
        />
      <template v-else>
        <VoiceInputButton mode="toggle" @result="handleVoiceResult" />
        <el-button
          type="primary"
          :icon="Promotion"
          native-type="button"
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
import { ref, watch, nextTick, computed, onUnmounted } from 'vue'
import { aiService } from '@/services/ai'
import type { AIMessage, AIRAGSource } from '@/types'
import { throttle } from '@/composables/useDebounce'
import { useAgentChat } from '@/composables/useAgentChat'
import { useChatStream } from '@/composables/useChatStream'
import { ElMessage } from 'element-plus'
import { escapeHtml, sanitizeMarkdown, safeCopyToClipboard, safeStorage } from '@/utils/security'
import {
  User,
  ChatDotRound,
  Delete,
  CopyDocument,
  Plus,
  Refresh,
  Promotion,
  VideoPause,
  SetUp
} from '@element-plus/icons-vue'
import QuickActions from './QuickActions.vue'
import VoiceInputButton from '@/components/ui/VoiceInputButton.vue'

const props = defineProps<{
  context?: string
}>()

const emit = defineEmits<{
  (e: 'insert', content: string): void
  (e: 'open-source', payload: { path: string; lineNumber?: number }): void
}>()

const CHAT_HISTORY_KEY = 'ai_chat_history'
const MAX_HISTORY_MESSAGES = 50
const MAX_HISTORY_BYTES = 200_000

function loadChatHistory(): AIMessage[] {
  const parsed = safeStorage.get<AIMessage[]>(CHAT_HISTORY_KEY, [])
  if (!Array.isArray(parsed)) return []
  return parsed.slice(-MAX_HISTORY_MESSAGES)
}

function saveChatHistory(msgs: AIMessage[]) {
  let toSave = msgs.slice(-MAX_HISTORY_MESSAGES)
  let serialized = JSON.stringify(toSave)
  while (serialized.length > MAX_HISTORY_BYTES && toSave.length > 0) {
    toSave = toSave.slice(1)
    serialized = JSON.stringify(toSave)
  }
  safeStorage.set(CHAT_HISTORY_KEY, toSave)
}

function formatSourceLabel(source: AIRAGSource): string {
  const fileName = source.filePath.split('/').pop() || source.filePath
  const lineRange = formatSourceLineRange(source)
  return `${source.id} ${fileName}#${source.chunkIndex + 1}${lineRange ? `:${lineRange}` : ''}`
}

function formatSourceTitle(source: AIRAGSource): string {
  return `${source.id} ${formatSourceTarget(source)}`
}

function formatSourceTarget(source: AIRAGSource): string {
  const lineRange = formatSourceLineRange(source)
  return `${source.filePath}#chunk-${source.chunkIndex + 1}${lineRange ? ` ${lineRange}` : ''}`
}

function formatSourceLineRange(source: AIRAGSource): string {
  if (!source.lineStart || source.lineStart <= 0) return ''
  if (!source.lineEnd || source.lineEnd <= source.lineStart) return `L${source.lineStart}`
  return `L${source.lineStart}-L${source.lineEnd}`
}

function sourceLineNumber(source: AIRAGSource): number | undefined {
  return source.lineStart && source.lineStart > 0 ? source.lineStart : undefined
}

const messages = ref<AIMessage[]>(loadChatHistory())
const inputText = ref('')
const messagesRef = ref<HTMLDivElement>()
const activeSourcePreview = ref<{ messageId: string; source: AIRAGSource } | null>(null)

const { streaming, streamChat, stopStreaming, dispose: disposeStream } = useChatStream({
  messages: () => messages.value,
  documentContext: props.context,
  onError: (msg: string) => ElMessage.error('AI 请求失败'),
  onStopped: (msg: AIMessage) => {
    messages.value.push(msg)
    void scrollToBottom()
  },
})

const {
  agentMode,
  isAgentRunning,
  setAgentMode,
  executeAgent,
  stopAgent,
} = useAgentChat({
  messages: () => messages.value,
  onMessageUpdate: (msg: AIMessage) => {
    const idx = messages.value.findIndex(m => m.id === msg.id)
    if (idx !== -1) messages.value[idx] = { ...msg }
  },
})

const activeModel = computed(() => {
  const provider = aiService.getActiveProvider()
  return provider ? provider.getConfig().model : null
})

const scrollToBottom = throttle(async () => {
  await nextTick()
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}, 100)

const truncateParam = (val: string, maxLen = 80): string => {
  return val.length <= maxLen ? val : val.slice(0, maxLen) + '...'
}

const toggleAgentMode = () => setAgentMode(!agentMode.value)

function openRAGSource(source: AIRAGSource) {
  emit('open-source', { path: source.filePath, lineNumber: sourceLineNumber(source) })
}

function showSourcePreview(messageId: string, source: AIRAGSource) {
  activeSourcePreview.value = { messageId, source }
}

function hideSourcePreview(messageId?: string, sourceId?: string) {
  const active = activeSourcePreview.value
  if (!active) return
  if (messageId && active.messageId !== messageId) return
  if (sourceId && active.source.id !== sourceId) return
  activeSourcePreview.value = null
}

function isSourcePreviewActive(messageId: string, sourceId: string): boolean {
  return activeSourcePreview.value?.messageId === messageId && activeSourcePreview.value.source.id === sourceId
}

function renderSourceCitations(html: string, sources?: AIRAGSource[]): string {
  if (!sources?.length) return html
  const sourceMap = new Map(
    sources.filter(s => /^S\d+$/.test(s.id)).map(s => [s.id, s])
  )
  if (sourceMap.size === 0) return html
  return html.replace(/\[(S\d+)\]/g, (match, sourceId: string) => {
    const source = sourceMap.get(sourceId)
    if (!source) return match
    const label = `[${source.id}]`
    const title = `打开 ${formatSourceTitle(source)}`
    return [
      '<button', ' class="source-citation"', ' type="button"',
      ` title="${escapeHtml(title)}"`, ` aria-label="${escapeHtml(title)}"`,
      ` data-source-id="${escapeHtml(source.id)}"`, '>',
      escapeHtml(label), '</button>',
    ].join('')
  })
}

const renderMarkdown = (text: string, sources?: AIRAGSource[]) => {
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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
  return sanitizeMarkdown(renderSourceCitations(rendered, sources)
    .replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)])
    .replace(/\x00IC(\d+)\x00/g, (_, i) => inlineCodes[parseInt(i)]))
}

function findSourceFromCitationEvent(event: Event, msg: AIMessage): { source: AIRAGSource; button: HTMLButtonElement } | null {
  if (!msg.ragSources?.length) return null
  const target = event.target as HTMLElement | null
  const button = target?.closest('.source-citation') as HTMLButtonElement | null
  if (!button) return null
  const sourceId = button.getAttribute('data-source-id')
  const source = msg.ragSources.find(item => item.id === sourceId)
  return source ? { source, button } : null
}

function handleMessageCitationClick(event: MouseEvent, msg: AIMessage) {
  const found = findSourceFromCitationEvent(event, msg)
  if (found) openRAGSource(found.source)
}

function handleMessageCitationPreview(event: MouseEvent | FocusEvent, msg: AIMessage) {
  const found = findSourceFromCitationEvent(event, msg)
  if (found) showSourcePreview(msg.id, found.source)
}

function handleMessageCitationPreviewEnd(event: MouseEvent | FocusEvent, msg: AIMessage) {
  const found = findSourceFromCitationEvent(event, msg)
  if (!found) return
  const relatedTarget = event.relatedTarget
  if (relatedTarget instanceof Node && found.button.contains(relatedTarget)) return
  hideSourcePreview(msg.id, found.source.id)
}

const addCopyButtons = () => {
  nextTick(() => {
    messagesRef.value?.querySelectorAll('pre code').forEach((block) => {
      const pre = block.parentElement
      if (pre && !pre.querySelector('.copy-btn')) {
        const btn = document.createElement('button')
        btn.className = 'copy-btn'
        btn.type = 'button'
        btn.setAttribute('aria-label', '复制代码块')
        btn.textContent = '复制'
        btn.onclick = async () => {
          const copied = await safeCopyToClipboard(block.textContent || '')
          btn.textContent = copied ? '已复制' : '复制失败'
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
  if (!text || streaming.value || isAgentRunning.value) return

  const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  messages.value.push({ id: uid(), role: 'user', content: text, timestamp: Date.now() })
  inputText.value = ''
  await scrollToBottom()

  if (agentMode.value) {
    await sendAgentMessage(text, uid)
    return
  }

  const assistantMsg = await streamChat(text)
  if (assistantMsg) {
    messages.value.push(assistantMsg)
    await scrollToBottom()
  }
}

const sendAgentMessage = async (prompt: string, uid: () => string) => {
  const assistantMsg: AIMessage = {
    id: uid(), role: 'assistant', content: '', toolCalls: [], timestamp: Date.now()
  }
  messages.value.push(assistantMsg)
  await scrollToBottom()

  try {
    const result = await executeAgent(prompt)
    if (result) {
      assistantMsg.content = result.message
      assistantMsg.toolCalls = result.toolCalls
    } else {
      assistantMsg.content = 'Agent 执行已取消'
    }
  } catch (e) {
    assistantMsg.content = `Agent 执行出错: ${e instanceof Error ? e.message : String(e)}`
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
  const copied = await safeCopyToClipboard(content)
  copied ? ElMessage.success('已复制到剪贴板') : ElMessage.error('复制失败')
}

const stopAll = () => { stopStreaming(); stopAgent() }
const clearMessages = () => { messages.value = [] }
const handleQuickAction = (prompt: string, _label: string) => { inputText.value = prompt; sendMessage() }
const handleVoiceResult = (text: string) => { inputText.value += text }

watch(messages, () => { scrollToBottom(); addCopyButtons(); saveChatHistory(messages.value) }, { deep: true })

onUnmounted(() => { disposeStream(); stopAgent() })

defineExpose({ clearMessages })
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

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chat-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
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

.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-track { background: transparent; }
.chat-messages::-webkit-scrollbar-thumb { background: var(--obsidian-text-faint); border-radius: 2px; }

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

.chat-message.user { flex-direction: row-reverse; }

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

.chat-message.assistant .message-avatar,
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

.message-text :deep(.source-citation) {
  display: inline-flex;
  align-items: center;
  padding: 0 3px;
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-sm);
  background: var(--obsidian-bg-primary);
  color: var(--obsidian-accent);
  font-family: var(--font-mono);
  font-size: 0.9em;
  line-height: 1.3;
  cursor: pointer;
  vertical-align: baseline;
}

.message-text :deep(.source-citation:hover),
.message-text :deep(.source-citation:focus-visible) {
  border-color: var(--obsidian-accent);
  background: var(--obsidian-accent-soft);
  outline: none;
}

.message-sources {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--obsidian-border);
  color: var(--obsidian-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.sources-label { color: var(--obsidian-text-faint); white-space: nowrap; }

.source-chip {
  max-width: 100%;
  padding: 1px 5px;
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-sm);
  background: var(--obsidian-bg-primary);
  color: var(--obsidian-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.source-chip:hover,
.source-chip:focus-visible,
.source-chip.active {
  border-color: var(--obsidian-accent);
  color: var(--obsidian-accent);
  outline: none;
}

.source-preview {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--obsidian-border);
  color: var(--obsidian-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.source-preview-header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  margin-bottom: 3px;
}

.source-preview-id {
  flex-shrink: 0;
  color: var(--obsidian-accent);
  font-family: var(--font-mono);
  font-weight: 600;
}

.source-preview-target {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  color: var(--obsidian-text-faint);
}

.source-preview-excerpt,
.source-preview-empty {
  color: var(--obsidian-text-muted);
  overflow-wrap: anywhere;
}

.message-actions {
  display: flex;
  gap: 2px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--obsidian-border);
}

.message-actions :deep(.el-button) { width: 22px; height: 22px; }

.typing-indicator { display: flex; gap: 4px; padding: 4px 0; }

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

.chat-input-area :deep(.el-textarea__inner::placeholder) { color: var(--obsidian-text-faint); }

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

.message-tool-calls {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--obsidian-border);
}

.tool-calls-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--obsidian-text-faint);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tool-call-item {
  padding: 4px 6px;
  margin-bottom: 4px;
  border-radius: var(--radius-sm);
  background: var(--obsidian-bg-primary);
  border-left: 2px solid var(--obsidian-accent);
  font-size: 11px;
  line-height: 1.4;
}

.tool-call-item.tool-call-error { border-left-color: var(--el-color-danger, #f56c6c); }

.tool-call-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.tool-call-name { font-family: var(--font-mono); font-weight: 600; color: var(--obsidian-accent); }
.tool-call-status.success { color: var(--el-color-success, #67c23a); }
.tool-call-status.error { color: var(--el-color-danger, #f56c6c); }

.tool-call-params {
  color: var(--obsidian-text-muted);
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
}

.param-key { font-family: var(--font-mono); color: var(--obsidian-text-faint); }
.param-value { color: var(--obsidian-text-muted); word-break: break-all; }
.tool-call-result { margin-top: 2px; color: var(--obsidian-text-muted); }
.tool-call-error-msg { margin-top: 2px; color: var(--el-color-danger, #f56c6c); }
.agent-status { font-size: 11px; color: var(--obsidian-text-muted); margin-top: 4px; }

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

pre:hover .copy-btn { opacity: 1; }
.copy-btn:hover { background: var(--obsidian-bg-hover); color: var(--obsidian-text-normal); }
</style>
