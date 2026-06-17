import { describe, expect, it } from 'vitest'
import { getProtectedPanelVisibility } from '../useResponsivePanels'

describe('getProtectedPanelVisibility', () => {
  const base = {
    viewportWidth: 1900,
    sidebarVisible: true,
    sidebarWidth: 280,
    aiVisible: true,
    aiPanelWidth: 380,
    graphVisible: true,
    graphPaneWidth: 480,
    rightDockVisible: true,
    rightDockWidth: 300,
    minEditorWidth: 400,
  }

  it('keeps all panels when enough width is available', () => {
    expect(getProtectedPanelVisibility(base)).toEqual({
      ai: true,
      graph: true,
      rightDock: true,
    })
  })

  it('hides right dock first, then graph, then AI to protect editor width', () => {
    expect(getProtectedPanelVisibility({ ...base, viewportWidth: 1300 })).toEqual({
      ai: true,
      graph: false,
      rightDock: false,
    })

    expect(getProtectedPanelVisibility({ ...base, viewportWidth: 960 })).toEqual({
      ai: false,
      graph: false,
      rightDock: false,
    })
  })

  it('keeps user-hidden panels hidden', () => {
    expect(getProtectedPanelVisibility({
      ...base,
      aiVisible: false,
      rightDockVisible: false,
    })).toEqual({
      ai: false,
      graph: true,
      rightDock: false,
    })
  })
})
