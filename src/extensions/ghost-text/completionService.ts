import { aiService } from '@/services/ai'
import type { GhostTextConfig } from '@/types'

export interface CompletionResult {
  text: string
  requestId: number
}

let currentRequestId = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

export function requestCompletion(
  prefix: string,
  config: GhostTextConfig,
  onResult: (result: CompletionResult) => void,
  onError: (error: string) => void
): void {
  cancelCompletion()

  const requestId = ++currentRequestId

  debounceTimer = setTimeout(async () => {
    debounceTimer = null
    const controller = new AbortController()
    abortController = controller

    try {
      const provider = aiService.getActiveProvider()
      if (!provider) {
        onError('未配置 AI 服务')
        return
      }

      const truncatedPrefix = prefix.slice(-config.maxPrefixChars)
      const prompt = `你是一个 Markdown 写作助手。请根据以下前文内容，续写接下来的一小段文字（不超过${config.maxCompletionChars}字）。只输出续写内容，不要加任何前缀、解释或标记：\n\n${truncatedPrefix}`

      let result = ''
      for await (const chunk of provider.streamChat([
        { role: 'system', content: '你是一个专业的 Markdown 写作助手，只输出续写内容。' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.4,
        maxTokens: config.maxCompletionChars * 2,
        signal: controller.signal
      })) {
        if (controller.signal.aborted || requestId !== currentRequestId) return
        result += chunk
        if (result.length >= config.maxCompletionChars) break
      }

      if (!controller.signal.aborted && requestId === currentRequestId) {
        onResult({ text: result.trim(), requestId })
      }
    } catch (e: any) {
      if (!controller.signal.aborted && requestId === currentRequestId) {
        onError(e?.message || String(e))
      }
    } finally {
      if (abortController === controller) {
        abortController = null
      }
    }
  }, config.debounceMs)
}

export function cancelCompletion(): void {
  currentRequestId += 1
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}
