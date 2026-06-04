import type { AIConfig, ChatMessage } from '@/types'

function createTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const availableSignals = signals.filter(Boolean)
  if (availableSignals.length === 1) return availableSignals[0]
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(availableSignals)
  }

  const controller = new AbortController()
  const abort = () => {
    if (!controller.signal.aborted) controller.abort()
  }

  for (const signal of availableSignals) {
    if (signal.aborted) {
      abort()
      break
    }
    signal.addEventListener('abort', abort, { once: true })
  }

  return controller.signal
}

export interface AIProvider {
  id: string
  name: string
  type: 'cloud' | 'local'
  status: 'idle' | 'connecting' | 'connected' | 'error'
  lastError?: string
  testConnection(): Promise<{ ok: boolean; error?: string }>
  getConfig(): Record<string, string | number>
}

export interface AIOptions {
  temperature?: number
  maxTokens?: number
  model?: string
  signal?: AbortSignal
}

type ProviderStatusListener = (id: string, status: AIProvider['status'], error?: string) => void

export class FetchAIProvider implements AIProvider {
  id: string
  name: string
  type: 'cloud' | 'local'
  status: AIProvider['status'] = 'idle'
  lastError?: string

  private providerType: string
  private baseURL: string
  private apiKey: string
  private model: string
  private temperature: number
  private maxTokens: number

  constructor(config: AIConfig) {
    this.providerType = config.provider || 'ollama'
    this.id = this.providerType
    const nameMap: Record<string, string> = {
      ollama: 'Ollama',
      openai: 'OpenAI',
      deepseek: 'DeepSeek',
      custom: 'Custom',
    }
    this.name = nameMap[this.providerType] || this.providerType
    this.type = this.providerType === 'ollama' ? 'local' : 'cloud'
    this.baseURL = config.baseURL || (this.providerType === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1')
    this.apiKey = config.apiKey || ''
    this.model = config.model || (this.providerType === 'ollama' ? 'qwen2.5:7b' : this.providerType === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini')
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens ?? 4096
  }

  getConfig() {
    return { baseURL: this.baseURL, model: this.model, temperature: this.temperature }
  }

  async testConnection(signal?: AbortSignal): Promise<{ ok: boolean; error?: string }> {
    try {
      this.status = 'connecting'
      const timeoutSignal = createTimeoutSignal(8000)
      const combinedSignal = signal ? combineAbortSignals([signal, timeoutSignal]) : timeoutSignal
      if (this.providerType === 'ollama') {
        const resp = await fetch(`${this.baseURL}/api/tags`, { signal: combinedSignal })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        const models = data.models?.map((m: any) => m.name) || []
        if (!models.includes(this.model)) {
          this.status = 'connected'
          this.lastError = undefined
          return { ok: true, error: `模型 '${this.model}' 未安装，可用: ${models.join(', ')}` }
        }
      } else {
        const headers: Record<string, string> = {}
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`
        const resp = await fetch(`${this.baseURL}/models`, { headers, signal: combinedSignal })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      }
      this.status = 'connected'
      this.lastError = undefined
      return { ok: true }
    } catch (e: any) {
      const error = e?.message || String(e)
      this.status = 'error'
      this.lastError = error
      return { ok: false, error }
    }
  }

  async chat(messages: ChatMessage[], options?: AIOptions): Promise<string> {
    try {
      this.status = 'connecting'
      const timeoutSignal = createTimeoutSignal(60000)
      const signal = options?.signal ? combineAbortSignals([options.signal, timeoutSignal]) : timeoutSignal
      let result: string
      if (this.providerType === 'ollama') {
        const resp = await fetch(`${this.baseURL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: options?.model || this.model,
            messages,
            stream: false,
            options: { temperature: options?.temperature ?? this.temperature, num_predict: options?.maxTokens ?? this.maxTokens }
          }),
          signal
        })
        if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`)
        const data = await resp.json()
        result = data.message?.content || ''
      } else {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`
        const resp = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: options?.model || this.model,
            messages,
            temperature: options?.temperature ?? this.temperature,
            max_tokens: options?.maxTokens ?? this.maxTokens,
            stream: false,
          }),
          signal
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        result = data.choices?.[0]?.message?.content || ''
      }
      this.status = 'connected'
      this.lastError = undefined
      return result
    } catch (e: any) {
      if (e.name === 'AbortError') {
        this.status = 'idle'
        return ''
      }
      this.status = 'error'
      this.lastError = e?.message || String(e)
      throw new Error(this.lastError)
    }
  }

  async *streamChat(messages: ChatMessage[], options?: AIOptions): AsyncGenerator<string> {
    this.status = 'connecting'
    try {
      const timeoutSignal = createTimeoutSignal(60000)
      const signal = options?.signal ? combineAbortSignals([options.signal, timeoutSignal]) : timeoutSignal
      if (this.providerType === 'ollama') {
        const resp = await fetch(`${this.baseURL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: options?.model || this.model,
            messages,
            stream: true,
            options: { temperature: options?.temperature ?? this.temperature, num_predict: options?.maxTokens ?? this.maxTokens }
          }),
          signal
        })
        if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`)
        const reader = resp.body?.getReader()
        if (!reader) throw new Error('No response body')
        const decoder = new TextDecoder()
        let buffer = ''
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
      } else {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`
        const resp = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: options?.model || this.model,
            messages,
            temperature: options?.temperature ?? this.temperature,
            max_tokens: options?.maxTokens ?? this.maxTokens,
            stream: true,
          }),
          signal
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const reader = resp.body?.getReader()
        if (!reader) throw new Error('No response body')
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') {
              this.status = 'connected'
              this.lastError = undefined
              return
            }
            try {
              const json = JSON.parse(data)
              const content = json.choices?.[0]?.delta?.content
              if (content) yield content
            } catch {}
          }
        }
      }
      this.status = 'connected'
      this.lastError = undefined
    } catch (e: any) {
      if (e.name === 'AbortError') {
        this.status = 'idle'
        return
      }
      this.status = 'error'
      this.lastError = e?.message || String(e)
      throw new Error(this.lastError)
    }
  }
}

export class AIService {
  private providers: Map<string, FetchAIProvider> = new Map()
  private activeProviderId: string = 'ollama'
  private listeners: ProviderStatusListener[] = []

  registerProvider(provider: FetchAIProvider) {
    this.providers.set(provider.id, provider)
  }

  setActiveProvider(id: string) {
    if (this.providers.has(id)) {
      this.activeProviderId = id
    }
  }

  getActiveProvider(): FetchAIProvider | undefined {
    return this.providers.get(this.activeProviderId)
  }

  getProvider(id: string): FetchAIProvider | undefined {
    return this.providers.get(id)
  }

  getActiveProviderId(): string {
    return this.activeProviderId
  }

  listProviders(): FetchAIProvider[] {
    return Array.from(this.providers.values())
  }

  onStatusChange(listener: ProviderStatusListener) {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter(l => l !== listener) }
  }

  async listOllamaModels(baseURL: string): Promise<string[]> {
    try {
      const resp = await fetch(`${baseURL}/api/tags`, { signal: createTimeoutSignal(8000) })
      if (!resp.ok) return []
      const data = await resp.json()
      return data.models?.map((m: any) => m.name) || []
    } catch {
      return []
    }
  }
}

export const aiService = new AIService()

let _defaultRegistered = false

export function ensureDefaultProvider() {
  if (_defaultRegistered || aiService.listProviders().length > 0) return
  _defaultRegistered = true
  aiService.registerProvider(new FetchAIProvider({
    provider: 'ollama',
    baseURL: 'http://localhost:11434',
    apiKey: '',
    model: 'qwen2.5:7b',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '',
  }))
}
