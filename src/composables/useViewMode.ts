import { computed, type Component } from 'vue'
import { View, EditPen } from '@element-plus/icons-vue'
import { useEditorStore } from '../stores/editor'
import type { ViewMode } from '../types'

export function useViewMode(options: {
  editorStore: () => ReturnType<typeof useEditorStore>
  isNarrowViewport: () => boolean
  focusMode: () => boolean
}) {
  const viewModeTooltip = computed(() => {
    if (options.focusMode()) return '专注模式 (F11)'
    const map: Record<string, string> = { source: '源码模式', 'live-preview': '实时预览', split: '分屏模式', preview: '阅读模式' }
    return map[options.editorStore().viewMode] || '切换视图'
  })

  const viewModeIcon = computed<Component>(() => {
    return options.editorStore().viewMode === 'source' ? EditPen : View
  })

  const viewModeLabel = computed(() => {
    const map: Record<string, string> = { source: '源码', 'live-preview': '实时预览', preview: '阅读' }
    return map[options.editorStore().viewMode] || '源码'
  })

  const viewModeTagType = computed(() => {
    const map: Record<string, string> = { source: 'info', 'live-preview': 'success', preview: 'warning' }
    return map[options.editorStore().viewMode] || 'info'
  })

  const handleViewDropdown = (command: string) => {
    const store = options.editorStore()
    switch (command) {
      case 'source':
        store.setViewMode('source')
        break
      case 'live':
        store.setViewMode('live-preview')
        break
      case 'split':
        store.setViewMode('split')
        break
      case 'preview':
        store.setViewMode('preview')
        break
    }
  }

  const handleViewModeTriggerClick = (event: MouseEvent) => {
    if (!options.isNarrowViewport()) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation?.()
    const modes: ViewMode[] = ['source', 'live-preview', 'split', 'preview']
    const store = options.editorStore()
    const idx = modes.indexOf(store.viewMode)
    store.setViewMode(modes[(idx + 1) % modes.length])
  }

  const handleToggleLivePreview = () => {
    const store = options.editorStore()
    if (store.viewMode === 'source') {
      store.setViewMode('live-preview')
    } else if (store.viewMode === 'live-preview') {
      store.setViewMode('source')
    } else if (store.viewMode === 'preview') {
      store.setViewMode('live-preview')
    }
  }

  const preferReadableMobileView = (
    mode: ViewMode = 'source',
    optionsOverride: { force?: boolean } = {}
  ) => {
    const store = options.editorStore()
    if (!options.isNarrowViewport() || store.openTabs.length === 0) return
    if (optionsOverride.force || store.viewMode === 'live-preview' || store.viewMode === 'split') {
      store.setViewMode(mode)
    }
  }

  return {
    viewModeTooltip,
    viewModeIcon,
    viewModeLabel,
    viewModeTagType,
    handleViewDropdown,
    handleViewModeTriggerClick,
    handleToggleLivePreview,
    preferReadableMobileView,
  }
}
