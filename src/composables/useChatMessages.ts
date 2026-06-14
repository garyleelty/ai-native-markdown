import { ref, watch } from 'vue'
import type { AIMessage } from '@/types'
import { safeStorage } from '@/utils/security'

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

export function useChatMessages() {
  const messages = ref<AIMessage[]>(loadChatHistory())

  const clearMessages = () => { messages.value = [] }

  watch(messages, () => { saveChatHistory(messages.value) }, { deep: true })

  return {
    messages,
    clearMessages,
  }
}
