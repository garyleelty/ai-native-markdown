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

const isTauri = '__TAURI_INTERNALS__' in window

async function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  if (!isTauri) {
    throw new Error('Tauri 环境不可用，AI 功能需要桌面端')
  }
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

export class TauriAIProvider implements AIProvider {
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
    this.name = this.providerType === 'ollama' ? 'Ollama' : 'OpenAI'
    this.type = this.providerType === 'ollama' ? 'local' : 'cloud'
    this.baseURL = config.baseURL || (this.providerType === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1')
    this.apiKey = config.apiKey || ''
    this.model = config.model || (this.providerType === 'ollama' ? 'qwen2.5:7b' : 'gpt-4o-mini')
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens ?? 4096
  }

  getConfig() {
    return { baseURL: this.baseURL, model: this.model, temperature: this.temperature }
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      this.status = 'connecting'
      await tauriInvoke('ai_proxy_test', {
        provider: this.providerType,
        baseUrl: this.baseURL,
        apiKey: this.apiKey,
      })
      this.status = 'connected'
      this.lastError = undefined
      return { ok: true }
    } catch (e: any) {
      const error = e?.toString?.() || String(e)
      this.status = 'error'
      this.lastError = error
      return { ok: false, error }
    }
  }

  async chat(messages: ChatMessage[], options?: AIOptions): Promise<string> {
    try {
      this.status = 'connecting'
      const result = await tauriInvoke('ai_proxy_chat', {
        request: {
          provider: this.providerType,
          baseUrl: this.baseURL,
          apiKey: this.apiKey,
          model: options?.model || this.model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: options?.temperature ?? this.temperature,
          maxTokens: options?.maxTokens ?? this.maxTokens,
        }
      }) as string
      this.status = 'connected'
      this.lastError = undefined
      return result
    } catch (e: any) {
      this.status = 'error'
      this.lastError = e?.toString?.() || String(e)
      throw new Error(this.lastError)
    }
  }

  async *streamChat(messages: ChatMessage[], options?: AIOptions): AsyncGenerator<string> {
    const { listen } = await import('@tauri-apps/api/event')

    const eventId = `ai-stream-${Date.now()}`

    const streamPromise = tauriInvoke('ai_proxy_stream', {
      request: {
        provider: this.providerType,
        baseUrl: this.baseURL,
        apiKey: this.apiKey,
        model: options?.model || this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? this.temperature,
        maxTokens: options?.maxTokens ?? this.maxTokens,
      }
    })

    const chunkQueue: string[] = []
    let errorQueue: string[] = []
    let done = false
    let resolveNext: (() => void) | null = null

    const unlistenChunk = await listen<{ event_id: string; content?: string; error?: string }>('ai-chunk', (event) => {
      if (event.payload.event_id !== eventId) return
      if (event.payload.error) {
        errorQueue.push(event.payload.error)
      } else if (event.payload.content) {
        chunkQueue.push(event.payload.content)
      }
      if (resolveNext) {
        resolveNext()
        resolveNext = null
      }
    })

    const unlistenDone = await listen<{ event_id: string }>('ai-done', (event) => {
      if (event.payload.event_id !== eventId) return
      done = true
      if (resolveNext) {
        resolveNext()
        resolveNext = null
      }
    })

    streamPromise.catch((e: any) => {
      errorQueue.push(e?.toString?.() || String(e))
      done = true
      if (resolveNext) {
        resolveNext()
        resolveNext = null
      }
    })

    try {
      while (true) {
        if (chunkQueue.length > 0) {
          yield chunkQueue.shift()!
          continue
        }
        if (errorQueue.length > 0) {
          throw new Error(errorQueue.shift()!)
        }
        if (done) break

        await new Promise<void>((resolve) => {
          resolveNext = resolve
        })
      }
    } finally {
      unlistenChunk()
      unlistenDone()
    }
  }
}

export class AIService {
  private providers: Map<string, TauriAIProvider> = new Map()
  private activeProviderId: string = 'ollama'
  private listeners: ProviderStatusListener[] = []

  registerProvider(provider: TauriAIProvider) {
    this.providers.set(provider.id, provider)
  }

  setActiveProvider(id: string) {
    if (this.providers.has(id)) {
      this.activeProviderId = id
    }
  }

  getActiveProvider(): TauriAIProvider | undefined {
    return this.providers.get(this.activeProviderId)
  }

  getProvider(id: string): TauriAIProvider | undefined {
    return this.providers.get(id)
  }

  getActiveProviderId(): string {
    return this.activeProviderId
  }

  listProviders(): TauriAIProvider[] {
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

export const aiService = new AIService()

aiService.registerProvider(new TauriAIProvider({
  provider: 'ollama',
  baseURL: 'http://localhost:11434',
  model: 'qwen2.5:7b',
  temperature: 0.7,
}))
