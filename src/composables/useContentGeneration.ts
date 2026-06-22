import { ref, type Ref } from 'vue'
import { aiService } from '@/services/ai'

export interface GenerationRequest {
  type: 'section' | 'expand' | 'summarize' | 'rewrite' | 'translate'
  prompt: string
  context?: string
  maxLength?: number
  style?: 'formal' | 'casual' | 'technical' | 'creative'
}

export interface GenerationResult {
  content: string
  requestId: number
  tokensUsed: number
}

export function useContentGeneration() {
  const isGenerating = ref(false)
  const lastResult = ref<GenerationResult | null>(null)
  const error = ref<string | null>(null)

  let currentRequestId = 0
  let abortController: AbortController | null = null

  // Generate content based on request
  async function generate(request: GenerationRequest): Promise<string> {
    if (isGenerating.value) {
      throw new Error('Generation already in progress')
    }

    const requestId = ++currentRequestId
    const controller = new AbortController()
    abortController = controller

    isGenerating.value = true
    error.value = null

    try {
      const provider = aiService.getActiveProvider()
      if (!provider) {
        throw new Error('未配置 AI 服务')
      }

      // Build system prompt based on request type
      const systemPrompt = buildSystemPrompt(request)

      // Build user prompt
      const userPrompt = buildUserPrompt(request)

      // Generate content
      let result = ''
      for await (const chunk of provider.streamChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.7,
        maxTokens: request.maxLength || 2000,
        signal: controller.signal
      })) {
        if (controller.signal.aborted || requestId !== currentRequestId) {
          throw new Error('Generation cancelled')
        }
        result += chunk
      }

      if (controller.signal.aborted || requestId !== currentRequestId) {
        throw new Error('Generation cancelled')
      }

      lastResult.value = {
        content: result.trim(),
        requestId,
        tokensUsed: estimateTokens(result),
      }

      return result.trim()
    } catch (e: any) {
      if (e.message !== 'Generation cancelled') {
        error.value = e.message || 'Generation failed'
      }
      throw e
    } finally {
      if (abortController === controller) {
        abortController = null
      }
      isGenerating.value = false
    }
  }

  // Build system prompt based on request type
  function buildSystemPrompt(request: GenerationRequest): string {
    const stylePrompts: Record<string, string> = {
      formal: '使用正式、专业的语言风格',
      casual: '使用轻松、口语化的语言风格',
      technical: '使用技术性、精确的语言风格',
      creative: '使用创造性、生动的语言风格',
    }

    const stylePrompt = stylePrompts[request.style || 'formal'] || stylePrompts.formal

    switch (request.type) {
      case 'section':
        return `你是一个专业的写作助手。请根据提供的大纲或标题，生成完整的章节内容。

规则：
1. 内容应该丰富、详细、有深度
2. ${stylePrompt}
3. 使用 Markdown 格式
4. 包含适当的标题、段落、列表等结构
5. 内容应该逻辑清晰、条理分明
6. 如果有上下文，应该与上下文保持一致`

      case 'expand':
        return `你是一个专业的写作助手。请扩展和丰富提供的内容。

规则：
1. 保持原文的核心观点和结构
2. 添加更多细节、例子、解释
3. ${stylePrompt}
4. 使用 Markdown 格式
5. 扩展后的内容应该更加完整和深入
6. 保持与原文一致的风格和语气`

      case 'summarize':
        return `你是一个专业的写作助手。请总结和提炼提供的内容。

规则：
1. 提取核心观点和关键信息
2. 保持简洁明了
3. ${stylePrompt}
4. 使用 Markdown 格式
5. 总结应该涵盖主要内容
6. 保持原文的逻辑结构`

      case 'rewrite':
        return `你是一个专业的写作助手。请重写和改进提供的内容。

规则：
1. 保持原文的核心意思
2. 改进语言表达、逻辑结构
3. ${stylePrompt}
4. 使用 Markdown 格式
5. 重写后应该更加清晰、专业
6. 修正可能的语法错误`

      case 'translate':
        return `你是一个专业的写作助手。请翻译提供的内容。

规则：
1. 保持原文的意思和风格
2. 翻译应该自然流畅
3. ${stylePrompt}
4. 使用 Markdown 格式
5. 保持原文的结构和格式
6. 对于专业术语，可以保留原文或提供解释`

      default:
        return `你是一个专业的写作助手。请根据要求生成内容。

规则：
1. 内容应该丰富、详细
2. ${stylePrompt}
3. 使用 Markdown 格式
4. 保持逻辑清晰
5. 与上下文保持一致`
    }
  }

  // Build user prompt based on request
  function buildUserPrompt(request: GenerationRequest): string {
    let prompt = ''

    if (request.context) {
      prompt += `上下文：\n${request.context}\n\n`
    }

    switch (request.type) {
      case 'section':
        prompt += `请根据以下大纲或标题，生成完整的章节内容：\n\n${request.prompt}`
        break

      case 'expand':
        prompt += `请扩展和丰富以下内容：\n\n${request.prompt}`
        break

      case 'summarize':
        prompt += `请总结以下内容：\n\n${request.prompt}`
        break

      case 'rewrite':
        prompt += `请重写和改进以下内容：\n\n${request.prompt}`
        break

      case 'translate':
        prompt += `请翻译以下内容：\n\n${request.prompt}`
        break

      default:
        prompt += request.prompt
    }

    if (request.maxLength) {
      prompt += `\n\n请控制内容长度在 ${request.maxLength} 字以内。`
    }

    return prompt
  }

  // Estimate token count
  function estimateTokens(text: string): number {
    // Simple estimation: 1 token ≈ 4 characters for English, 1 token ≈ 2 characters for Chinese
    const chineseChars = (text.match(/[一-鿿]/g) || []).length
    const otherChars = text.length - chineseChars
    return Math.ceil(chineseChars / 2 + otherChars / 4)
  }

  // Cancel current generation
  function cancel() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  // Generate section from outline
  async function generateSection(outline: string, context?: string): Promise<string> {
    return generate({
      type: 'section',
      prompt: outline,
      context,
      style: 'formal',
    })
  }

  // Expand existing content
  async function expandContent(content: string, context?: string): Promise<string> {
    return generate({
      type: 'expand',
      prompt: content,
      context,
      style: 'formal',
    })
  }

  // Summarize content
  async function summarizeContent(content: string): Promise<string> {
    return generate({
      type: 'summarize',
      prompt: content,
      style: 'formal',
    })
  }

  // Rewrite content
  async function rewriteContent(content: string, style?: 'formal' | 'casual' | 'technical' | 'creative'): Promise<string> {
    return generate({
      type: 'rewrite',
      prompt: content,
      style: style || 'formal',
    })
  }

  // Translate content
  async function translateContent(content: string, targetLanguage?: string): Promise<string> {
    return generate({
      type: 'translate',
      prompt: content,
      context: targetLanguage ? `翻译为${targetLanguage}` : undefined,
      style: 'formal',
    })
  }

  return {
    isGenerating,
    lastResult,
    error,
    generate,
    generateSection,
    expandContent,
    summarizeContent,
    rewriteContent,
    translateContent,
    cancel,
  }
}
