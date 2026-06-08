import { ref, type Ref } from 'vue'
import { aiService } from '@/services/ai'
import { ragService, type RAGContextResult } from '@/services/rag'
import { knowledgeIndex } from '@/services/knowledgeIndex'
import type { AIMessage, AIRAGSource } from '@/types'
import { useEditorStore, useSettingsStore } from '@/stores'

const BASE_SYSTEM_PROMPT = '你是一个专业的 Markdown 写作助手。'

function buildSystemContent(basePrompt: string, documentContext: string | undefined, ragContext: RAGContextResult | null): string {
  const contextParts = [basePrompt.trim() || BASE_SYSTEM_PROMPT]
  if (ragContext?.context) {
    const sourceList = ragContext.sources
      .map(source => `[${source.id}] ${formatSourceTarget(source)}`)
      .join('\n')
    contextParts.push([
      '以下是相关的文档上下文，来源编号用于回答引用：',
      '',
      ragContext.context,
      '可用来源：',
      sourceList,
      '',
      '请优先基于上下文回答用户问题；如果使用了上下文中的事实，请在相关句子后标注来源编号（如 [S1]），不要编造不存在的来源。',
    ].join('\n'))
  }
  if (documentContext) {
    contextParts.push(`当前文档内容：\n${documentContext}`)
  }
  return contextParts.join('\n\n')
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

export function useChatStream(options: {
  messages: () => AIMessage[]
  documentContext?: string
  onBeforeStream?: () => void
  onAfterStream?: () => void
  onError?: (error: string) => void
  onStopped?: (message: AIMessage) => void
}) {
  const streaming = ref(false)
  let currentAbortController: AbortController | null = null
  let activeAssistantMsg: AIMessage | null = null
  let stoppedAssistantId: string | null = null
  let userStoppedStreaming = false
  let isDisposed = false

  const settingsStore = useSettingsStore()
  const editorStore = useEditorStore()

  async function ensureCurrentDocumentIndexedForRAG(): Promise<void> {
    if (!settingsStore.enableRAG) return
    const filePath = editorStore.currentFile
    const content = editorStore.content
    if (!filePath || !content.trim()) return
    try {
      await ragService.indexDocument(filePath, content)
    } catch (error) {
      console.warn('RAG current document indexing failed; continuing chat without fresh index.', error)
    }
  }

  async function streamChat(text: string): Promise<AIMessage | undefined> {
    if (streaming.value || isDisposed) return undefined

    const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const assistantMsg: AIMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    options.onBeforeStream?.()
    streaming.value = true
    userStoppedStreaming = false
    stoppedAssistantId = null
    activeAssistantMsg = assistantMsg

    try {
      const provider = aiService.getActiveProvider()
      if (!provider) {
        if (isDisposed) return undefined
        assistantMsg.content = 'AI Provider 未就绪，请在 AI 配置中检查模型和连接。'
        streaming.value = false
        return assistantMsg
      }

      const chatMessages = options.messages()
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))

      let ragContext: RAGContextResult | null = null
      if (settingsStore.enableRAG) {
        try {
          await ensureCurrentDocumentIndexedForRAG()
          if (isDisposed) return undefined
          const graphRecords = await knowledgeIndex.getAll().catch(() => [])
          ragContext = await ragService.buildContextWithSources(text, 2000, {
            includeGraphContext: graphRecords.length > 0,
            graphRecords,
          })
          if (ragContext.sources.length > 0) {
            assistantMsg.ragSources = ragContext.sources
          }
          if (isDisposed) return undefined
        } catch {
          ragContext = null
        }
      }

      chatMessages.unshift({
        role: 'system',
        content: buildSystemContent(settingsStore.aiConfig.systemPrompt, options.documentContext, ragContext),
      })

      const streamController = new AbortController()
      currentAbortController = streamController
      for await (const chunk of provider.streamChat(chatMessages, { signal: streamController.signal })) {
        if (isDisposed || streamController.signal.aborted || currentAbortController !== streamController) return undefined
        assistantMsg.content += chunk
      }
    } catch (error: any) {
      if (isDisposed) return undefined
      const aborted = userStoppedStreaming || currentAbortController?.signal.aborted || error?.name === 'AbortError'
      if (aborted) {
        if (!assistantMsg.content.trim()) assistantMsg.content = '已停止生成'
      } else {
        assistantMsg.content = `错误: ${error.message || String(error)}`
        options.onError?.(error.message || String(error))
      }
    } finally {
      if (!isDisposed) streaming.value = false
      currentAbortController = null
      if (activeAssistantMsg?.id === assistantMsg.id) activeAssistantMsg = null
      userStoppedStreaming = false
      options.onAfterStream?.()
    }

    if (stoppedAssistantId === assistantMsg.id) return undefined
    return assistantMsg
  }

  function stopStreaming(): void {
    userStoppedStreaming = true
    if (activeAssistantMsg && stoppedAssistantId !== activeAssistantMsg.id) {
      if (!activeAssistantMsg.content.trim()) activeAssistantMsg.content = '已停止生成'
      stoppedAssistantId = activeAssistantMsg.id
      options.onStopped?.({ ...activeAssistantMsg })
    }
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    streaming.value = false
  }

  function dispose(): void {
    isDisposed = true
    userStoppedStreaming = true
    currentAbortController?.abort()
    currentAbortController = null
  }

  return {
    streaming,
    streamChat,
    stopStreaming,
    dispose,
  }
}
