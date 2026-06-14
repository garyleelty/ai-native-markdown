import { ref } from 'vue'
import type { AIRAGSource } from '@/types'

export function useRAGPreview() {
  const activeSourcePreview = ref<{ messageId: string; source: AIRAGSource } | null>(null)

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

  return {
    activeSourcePreview,
    showSourcePreview,
    hideSourcePreview,
    isSourcePreviewActive,
  }
}
