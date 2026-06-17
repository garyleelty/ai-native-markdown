import { computed, type ComputedRef } from 'vue'

export interface ProtectedPanelInput {
  viewportWidth: number
  sidebarVisible: boolean
  sidebarWidth: number
  aiVisible: boolean
  aiPanelWidth: number
  graphVisible: boolean
  graphPaneWidth: number
  rightDockVisible: boolean
  rightDockWidth: number
  minEditorWidth?: number
}

export interface ProtectedPanelVisibility {
  ai: boolean
  graph: boolean
  rightDock: boolean
}

const DEFAULT_MIN_EDITOR_WIDTH = 400
const SHELL_PADDING_ALLOWANCE = 24

export function getProtectedPanelVisibility(input: ProtectedPanelInput): ProtectedPanelVisibility {
  const minEditorWidth = input.minEditorWidth ?? DEFAULT_MIN_EDITOR_WIDTH
  const visible = {
    ai: input.aiVisible,
    graph: input.graphVisible,
    rightDock: input.rightDockVisible,
  }

  const usedWidth = () => {
    return SHELL_PADDING_ALLOWANCE
      + (input.sidebarVisible ? input.sidebarWidth : 0)
      + (visible.ai ? input.aiPanelWidth : 0)
      + (visible.graph ? input.graphPaneWidth : 0)
      + (visible.rightDock ? input.rightDockWidth : 0)
  }

  const editorWidth = () => input.viewportWidth - usedWidth()

  const hideOrder: Array<keyof ProtectedPanelVisibility> = ['rightDock', 'graph', 'ai']
  for (const key of hideOrder) {
    if (editorWidth() >= minEditorWidth) break
    visible[key] = false
  }

  return visible
}

export function useResponsivePanels(input: {
  viewportWidth: () => number
  isNarrowViewport: () => boolean
  sidebarVisible: () => boolean
  sidebarWidth: () => number
  aiVisible: () => boolean
  aiPanelWidth: () => number
  graphVisible: () => boolean
  graphPaneWidth: () => number
  rightDockVisible: () => boolean
  rightDockWidth: () => number
  minEditorWidth?: number
}): {
  protectedPanels: ComputedRef<ProtectedPanelVisibility>
} {
  const protectedPanels = computed(() => {
    if (input.isNarrowViewport()) {
      return {
        ai: input.aiVisible(),
        graph: input.graphVisible(),
        rightDock: input.rightDockVisible(),
      }
    }
    return getProtectedPanelVisibility({
      viewportWidth: input.viewportWidth(),
      sidebarVisible: input.sidebarVisible(),
      sidebarWidth: input.sidebarWidth(),
      aiVisible: input.aiVisible(),
      aiPanelWidth: input.aiPanelWidth(),
      graphVisible: input.graphVisible(),
      graphPaneWidth: input.graphPaneWidth(),
      rightDockVisible: input.rightDockVisible(),
      rightDockWidth: input.rightDockWidth(),
      minEditorWidth: input.minEditorWidth,
    })
  })

  return { protectedPanels }
}
