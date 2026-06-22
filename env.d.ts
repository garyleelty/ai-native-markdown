/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt, options?: Record<string, unknown>) => void
  export default plugin
}

interface Window {
  aiNativeVault?: import('./src/services/vault/types').VaultBridge
  aiNativeUpdater?: {
    checkForUpdates(): Promise<{ ok: boolean; updateAvailable?: boolean; error?: string }>
    downloadUpdate(): Promise<{ ok: boolean; error?: string }>
    installUpdate(): void
    getState(): Promise<{ checking: boolean; available: boolean; version: string; releaseNotes: string }>
    onStatus(listener: (data: { status: string; version?: string; releaseNotes?: string; error?: string }) => void): () => void
    onProgress(listener: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void): () => void
  }
}

declare module 'markdown-it-katex' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt, options?: Record<string, unknown>) => void
  export default plugin
}
