import { aiService } from '@/services/ai'
import type { GhostTextConfig } from '@/types'

export interface CompletionResult {
  text: string
  requestId: number
}

export interface CompletionContext {
  fileName?: string
  headings?: string[]
  tags?: string[]
  documentStructure?: string
}

let currentRequestId = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

export function requestCompletion(
  prefix: string,
  config: GhostTextConfig,
  onResult: (result: CompletionResult) => void,
  onError: (error: string) => void,
  context?: CompletionContext
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

      // Build context-aware prompt
      let contextInfo = ''
      if (context?.fileName) {
        contextInfo += `当前文件：${context.fileName}\n`
      }
      if (context?.headings && context.headings.length > 0) {
        contextInfo += `文档结构：${context.headings.join(' > ')}\n`
      }
      if (context?.tags && context.tags.length > 0) {
        contextInfo += `标签：${context.tags.join(', ')}\n`
      }
      if (context?.documentStructure) {
        contextInfo += `文档大纲：\n${context.documentStructure}\n`
      }

      const systemPrompt = `你是一个专业的 Markdown 写作助手。你的任务是根据上下文智能续写内容。

规则：
1. 只输出续写内容，不要加任何前缀、解释或标记
2. 保持与前文一致的风格、语气和格式
3. 如果前文是列表，继续列表格式
4. 如果前文是段落，自然续写段落
5. 如果前文是代码块，续写代码
6. 如果前文是标题，续写标题下的内容
7. 续写长度不超过${config.maxCompletionChars}字
8. 优先完成当前句子或段落
9. 如果前文有未完成的句子，先完成它
10. 保持 Markdown 格式正确`

      const userPrompt = `${contextInfo ? contextInfo + '\n' : ''}请根据以下前文内容，智能续写：\n\n${truncatedPrefix}`

      let result = ''
      for await (const chunk of provider.streamChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
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
      if (!controller.signal.aborted && requestId !== currentRequestId) {
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
