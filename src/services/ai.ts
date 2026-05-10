/**
 * AI 服务层 - 统一接口，支持多种 AI Provider
 * 
 * 支持的 Provider:
 * - Ollama: 本地运行，默认 http://localhost:11434
 * - OpenAI 兼容: 支持所有 OpenAI API 格式的服务（OpenAI / DeepSeek / 通义千问 / 本地 LM Studio 等）
 * 
 * 网络配置说明:
 * - Ollama: 需要本地运行 Ollama 服务（ollama serve），默认端口 11434
 * - OpenAI: 通过 Vite 代理 /api/ai/openai 转发到目标 API，避免 CORS
 * - 也可在配置中自定义 baseURL 直连（需目标服务支持 CORS）
 */

// ═══════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════

export interface AIProvider {
  id: string
  name: string
  type: 'cloud' | 'local'
  status: 'idle' | 'connecting' | 'connected' | 'error'
  lastError?: string
  streamComplete(prompt: string, options?: AIOptions): AsyncGenerator<string>
  chat(messages: ChatMessage[], options?: AIOptions): AsyncGenerator<string>
  testConnection(): Promise<{ ok: boolean; error?: string }>
  getConfig(): Record<string, string | number>
}

export interface AIOptions {
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIConfig {
  provider: string
  apiKey?: string
  baseURL?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

type ProviderStatusListener = (id: string, status: AIProvider['status'], error?: string) => void

// ═══════════════════════════════════════════════
// OpenAI 兼容 Provider
// ═══════════════════════════════════════════════

export class OpenAIProvider implements AIProvider {
  id = 'openai'
  name = 'OpenAI'
  type = 'cloud' as const
  status: AIProvider['status'] = 'idle'
  lastError?: string

  private apiKey: string
  private baseURL: string
  private model: string
  private temperature: number

  constructor(config: AIConfig) {
    this.apiKey = config.apiKey || ''
    this.baseURL = config.baseURL || '/api/ai/openai'
    this.model = config.model || 'gpt-4o-mini'
    this.temperature = config.temperature ?? 0.7
  }

  getConfig() {
    return { baseURL: this.baseURL, model: this.model, temperature: this.temperature }
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.apiKey && !this.baseURL.includes('localhost')) {
      return { ok: false, error: '缺少 API Key，请在 AI 配置中填写' }
    }
    try {
      this.status = 'connecting'
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(8000),
      })
      if (response.ok) {
        this.status = 'connected'
        this.lastError = undefined
        return { ok: true }
      }
      const errText = await response.text().catch(() => '')
      const error = `HTTP ${response.status}: ${response.statusText}${errText ? ' - ' + errText.slice(0, 200) : ''}`
      this.status = 'error'
      this.lastError = error
      return { ok: false, error }
    } catch (e: any) {
      const error = this.classifyError(e)
      this.status = 'error'
      this.lastError = error
      return { ok: false, error }
    }
  }

  async *streamComplete(prompt: string, options?: AIOptions): AsyncGenerator<string> {
    const url = `${this.baseURL}/chat/completions`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`

    let response: Response
    try {
      this.status = 'connecting'
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: options?.model || this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? this.temperature,
          max_tokens: options?.maxTokens ?? 2000,
          stream: true,
        }),
      })
    } catch (e: any) {
      this.status = 'error'
      this.lastError = this.classifyError(e)
      throw new Error(this.lastError)
    }

    if (!response.ok) {
      this.status = 'error'
      const errBody = await response.text().catch(() => '')
      this.lastError = `请求失败 (${response.status}): ${errBody.slice(0, 300) || response.statusText}`
      throw new Error(this.lastError)
    }

    this.status = 'connected'
    this.lastError = undefined

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') return

          try {
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.delta?.content
            if (content) yield content
          } catch {
            // 跳过不完整的 JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async *chat(messages: ChatMessage[], options?: AIOptions): AsyncGenerator<string> {
    yield* this.streamComplete(
      messages.map(m => `${m.role === 'system' ? '[System]' : m.role === 'user' ? '[User]' : '[Assistant]'} ${m.content}`).join('\n'),
      options,
    )
  }

  private classifyError(e: any): string {
    const msg = e?.message || String(e)
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('net::'))
      return '网络连接失败，请检查：1) 目标服务是否运行 2) baseURL 是否正确 3) 是否需要配置 Vite 代理'
    if (msg.includes('401') || msg.includes('Unauthorized'))
      return '认证失败：API Key 无效或已过期，请检查配置'
    if (msg.includes('403'))
      return '访问被拒绝：请检查 API Key 权限或账户余额'
    if (msg.includes('429'))
      return '请求频率超限：请稍后重试或升级 API 套餐'
    if (msg.includes('500') || msg.includes('502') || msg.includes('503'))
      return '服务端错误：目标 AI 服务暂时不可用，请稍后重试'
    if (msg.includes('timeout') || msg.includes('Timeout'))
      return '连接超时：目标服务响应过慢，请检查网络或更换 baseURL'
    return `连接错误: ${msg}`
  }
}

// ═══════════════════════════════════════════════
// Ollama Provider
// ═══════════════════════════════════════════════

export class OllamaProvider implements AIProvider {
  id = 'ollama'
  name = 'Ollama'
  type = 'local' as const
  status: AIProvider['status'] = 'idle'
  lastError?: string

  private baseURL: string
  private model: string

  constructor(config?: AIConfig) {
    this.baseURL = config?.baseURL || '/api/ai/ollama'
    this.model = config?.model || 'qwen2.5:7b'
  }

  getConfig() {
    return { baseURL: this.baseURL, model: this.model }
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      this.status = 'connecting'
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        const data = await response.json()
        const models = (data.models || []).map((m: any) => m.name)
        // 检查当前模型是否已安装
        if (models.length > 0 && !models.some((m: string) => m.startsWith(this.model.split(':')[0]))) {
          this.status = 'connected'
          this.lastError = `模型 "${this.model}" 未安装，可用模型: ${models.slice(0, 5).join(', ')}`
          return { ok: true, error: this.lastError }
        }
        this.status = 'connected'
        this.lastError = undefined
        return { ok: true }
      }
      const error = `Ollama 返回 HTTP ${response.status}`
      this.status = 'error'
      this.lastError = error
      return { ok: false, error }
    } catch (e: any) {
      const msg = e?.message || String(e)
      let error: string
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        error = '无法连接 Ollama 服务，请确认：\n1) 已安装 Ollama (https://ollama.com)\n2) 已运行 ollama serve\n3) 服务运行在正确端口'
      } else if (msg.includes('timeout')) {
        error = '连接 Ollama 超时，服务可能未启动'
      } else {
        error = `连接错误: ${msg}`
      }
      this.status = 'error'
      this.lastError = error
      return { ok: false, error }
    }
  }

  async *streamComplete(prompt: string, options?: AIOptions): AsyncGenerator<string> {
    let response: Response
    try {
      this.status = 'connecting'
      response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options?.model || this.model,
          prompt,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 2000,
          },
        }),
      })
    } catch (e: any) {
      this.status = 'error'
      this.lastError = this.classifyError(e)
      throw new Error(this.lastError)
    }

    if (!response.ok) {
      this.status = 'error'
      const errBody = await response.text().catch(() => '')
      if (response.status === 404) {
        this.lastError = `模型 "${options?.model || this.model}" 未找到，请先运行: ollama pull ${options?.model || this.model}`
      } else {
        this.lastError = `Ollama 请求失败 (${response.status}): ${errBody.slice(0, 300) || response.statusText}`
      }
      throw new Error(this.lastError)
    }

    this.status = 'connected'
    this.lastError = undefined

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            if (json.response) yield json.response
            if (json.error) throw new Error(json.error)
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async *chat(messages: ChatMessage[], options?: AIOptions): AsyncGenerator<string> {
    // Ollama 也支持 /api/chat 端点（更原生的多轮对话）
    const ollamaMessages = messages.map(m => ({ role: m.role, content: m.content }))
    
    let response: Response
    try {
      this.status = 'connecting'
      response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options?.model || this.model,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 2000,
          },
        }),
      })
    } catch (e: any) {
      // fallback to streamComplete
      yield* this.streamComplete(
        messages.map(m => `${m.role === 'system' ? '[System]' : m.role === 'user' ? '[User]' : '[Assistant]'} ${m.content}`).join('\n'),
        options,
      )
      return
    }

    if (!response.ok) {
      // fallback to streamComplete
      yield* this.streamComplete(
        messages.map(m => `${m.role === 'system' ? '[System]' : m.role === 'user' ? '[User]' : '[Assistant]'} ${m.content}`).join('\n'),
        options,
      )
      return
    }

    this.status = 'connected'
    this.lastError = undefined

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            if (json.message?.content) yield json.message.content
            if (json.error) throw new Error(json.error)
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private classifyError(e: any): string {
    const msg = e?.message || String(e)
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
      return '无法连接 Ollama，请确认服务已启动 (ollama serve)'
    if (msg.includes('timeout'))
      return 'Ollama 连接超时，请检查服务是否运行'
    return `连接错误: ${msg}`
  }
}

// ═══════════════════════════════════════════════
// AI 服务管理器（单例）
// ═══════════════════════════════════════════════

export class AIService {
  private providers: Map<string, AIProvider> = new Map()
  private activeProviderId: string = 'ollama'
  private listeners: ProviderStatusListener[] = []

  registerProvider(provider: AIProvider) {
    this.providers.set(provider.id, provider)
  }

  setActiveProvider(id: string) {
    if (this.providers.has(id)) {
      this.activeProviderId = id
    }
  }

  getActiveProvider(): AIProvider | undefined {
    return this.providers.get(this.activeProviderId)
  }

  getProvider(id: string): AIProvider | undefined {
    return this.providers.get(id)
  }

  getActiveProviderId(): string {
    return this.activeProviderId
  }

  listProviders(): AIProvider[] {
    return Array.from(this.providers.values())
  }

  onStatusChange(listener: ProviderStatusListener) {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter(l => l !== listener) }
  }

  private notifyStatus(id: string, status: AIProvider['status'], error?: string) {
    this.listeners.forEach(l => l(id, status, error))
  }
}

export class DeepSeekProvider extends OpenAIProvider {
  id = 'deepseek'
  name = 'DeepSeek'
  type = 'cloud' as const

  constructor(config?: AIConfig) {
    super({
      provider: 'deepseek',
      apiKey: config?.apiKey || '',
      baseURL: config?.baseURL || 'https://api.deepseek.com/v1',
      model: config?.model || 'deepseek-chat',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 2000,
    })
  }
}

export class CustomProvider extends OpenAIProvider {
  id = 'custom'
  name = 'Custom'
  type = 'cloud' as const

  constructor(config?: AIConfig) {
    super({
      provider: 'custom',
      apiKey: config?.apiKey || '',
      baseURL: config?.baseURL || '',
      model: config?.model || '',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 2000,
    })
  }
}

export const aiService = new AIService()

aiService.registerProvider(new OllamaProvider())
