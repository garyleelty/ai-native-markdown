import { useSettingsStore } from '@/stores/settings'

const SPLIT_RATIO_MIN = 0.2
const SPLIT_RATIO_MAX = 0.8

export function useResize(options: {
  isNarrowViewport: () => boolean
}) {
  const settingsStore = useSettingsStore()

  let resizing = ''
  let startPos = { x: 0, y: 0 }
  let startSize = { w: 0, h: 0 }
  let startSplitRatio = 0.5
  let splitViewWidth = 1

  const startResize = (panel: string, event: MouseEvent) => {
    if (panel === 'sidebar' && options.isNarrowViewport()) return
    resizing = panel
    startPos.x = event.clientX
    startPos.y = event.clientY
    if (panel === 'sidebar') startSize.w = settingsStore.sidebarWidth
    else if (panel === 'graphPane') startSize.w = settingsStore.graphPaneWidth
    else if (panel === 'rightDock') startSize.w = settingsStore.rightDockWidth
    else if (panel === 'aiPanel') {
      if (options.isNarrowViewport()) startSize.h = settingsStore.aiPanelHeight
      else startSize.w = settingsStore.aiPanelWidth
    } else if (panel === 'splitDivider') {
      startSplitRatio = settingsStore.splitRatio
      const splitView = (event.target as HTMLElement).closest?.('.split-view') as HTMLElement | null
      splitViewWidth = splitView?.offsetWidth || 1
    }
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)
    document.body.style.cursor = (panel === 'aiPanel' && options.isNarrowViewport()) ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleResize = (event: MouseEvent) => {
    if (!resizing) return
    if (resizing === 'sidebar') {
      const diff = event.clientX - startPos.x
      settingsStore.setSidebarWidth(Math.max(240, Math.min(400, startSize.w + diff)))
    } else if (resizing === 'graphPane') {
      const diff = startPos.x - event.clientX
      settingsStore.setGraphPaneWidth(Math.max(320, Math.min(760, startSize.w + diff)))
    } else if (resizing === 'rightDock') {
      const diff = startPos.x - event.clientX
      settingsStore.setRightDockWidth(Math.max(280, Math.min(460, startSize.w + diff)))
    } else if (resizing === 'aiPanel') {
      if (options.isNarrowViewport()) {
        const diff = startPos.y - event.clientY
        settingsStore.setAIPanelHeight(Math.max(140, Math.min(400, startSize.h + diff)))
      } else {
        const diff = startPos.x - event.clientX
        settingsStore.setAIPanelWidth(Math.max(280, Math.min(520, startSize.w + diff)))
      }
    } else if (resizing === 'splitDivider') {
      const diff = event.clientX - startPos.x
      const ratioDiff = diff / splitViewWidth
      settingsStore.setSplitRatio(
        Math.max(SPLIT_RATIO_MIN, Math.min(SPLIT_RATIO_MAX, startSplitRatio + ratioDiff))
      )
    }
  }

  const stopResize = () => {
    resizing = ''
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  return {
    startResize,
    stopResize,
  }
}
