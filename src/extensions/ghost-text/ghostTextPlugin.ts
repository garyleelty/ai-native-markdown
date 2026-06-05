import { ViewPlugin, ViewUpdate, EditorView, Decoration, DecorationSet, WidgetType, keymap } from '@codemirror/view'
import { RangeSetBuilder, StateEffect } from '@codemirror/state'
import { requestCompletion, cancelCompletion, CompletionResult } from './completionService'
import type { GhostTextConfig } from '@/types'

const ghostTextRefresh = StateEffect.define<void>()
const ghostTextTrigger = StateEffect.define<void>()

// 模块级状态
let currentGhostText = ''
let currentGhostPos = -1
let currentRequestId = 0
let activeConfig: GhostTextConfig | null = null

/** 由 Editor.vue 调用，同步配置 */
export function updateGhostTextConfig(config: GhostTextConfig) {
  activeConfig = config
  if (!config.enabled) {
    currentGhostText = ''
    currentGhostPos = -1
    cancelCompletion()
  }
}

function getConfig(): GhostTextConfig {
  return activeConfig || {
    enabled: true,
    debounceMs: 800,
    maxPrefixChars: 1500,
    maxCompletionChars: 200,
    triggerMode: 'pause'
  }
}

function triggerCompletion(view: EditorView) {
  const config = getConfig()
  if (!config.enabled) return

  cancelCompletion()
  currentGhostText = ''
  currentGhostPos = -1

  const pos = view.state.selection.main.head
  const prefix = view.state.doc.sliceString(0, pos)
  requestCompletion(
    prefix,
    config,
    (result: CompletionResult) => {
      if (result.requestId >= currentRequestId) {
        currentGhostText = result.text
        currentGhostPos = view.state.selection.main.head
        currentRequestId = result.requestId
        view.dispatch({ effects: ghostTextRefresh.of(undefined) })
      }
    },
    () => {}
  )
}

/** Ghost Text 使用 Widget 装饰器在光标位置渲染半透明文本 */
class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) { super() }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-ghost-text'
    span.textContent = this.text
    span.style.cssText = 'opacity: 0.4; color: var(--text-muted); font-style: italic; pointer-events: none;'
    return span
  }

  ignoreEvent() { return true }
}

export const ghostTextPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(_view: EditorView) {
    this.decorations = Decoration.none
  }

  update(update: ViewUpdate) {
    const config = getConfig()
    if (!config.enabled) {
      if (this.decorations !== Decoration.none) {
        this.decorations = Decoration.none
      }
      return
    }

    if (update.transactions.some(tr => tr.effects.some(e => e.is(ghostTextTrigger)))) {
      triggerCompletion(update.view)
      return
    }

    if (update.docChanged) {
      const pos = update.state.selection.main.head

      // 用户正在逐字接受补全：光标移到 ghostPos+1 且输入了 ghost text 首字符
      if (currentGhostText && pos === currentGhostPos + 1) {
        const change = update.changes
        let insertedChar = ''
        change.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
          insertedChar = inserted.sliceString(0)
        })
        if (insertedChar && currentGhostText.startsWith(insertedChar)) {
          const remaining = currentGhostText.slice(1)
          if (remaining) {
            // 自动填入剩余部分
            update.view.dispatch({
              changes: { from: pos, insert: remaining },
              selection: { anchor: pos + remaining.length }
            })
          }
          currentGhostText = ''
          currentGhostPos = -1
          this.decorations = Decoration.none
          return
        }
      }

      // 普通输入：清除 ghost text 并请求新补全
      currentGhostText = ''
      currentGhostPos = -1
      this.decorations = Decoration.none

      const prefix = update.state.doc.sliceString(0, pos)
      requestCompletion(
        prefix,
        config,
        (result: CompletionResult) => {
          if (result.requestId >= currentRequestId) {
            currentGhostText = result.text
            currentGhostPos = update.state.selection.main.head
            currentRequestId = result.requestId
            // 触发重新渲染以显示 ghost text widget
            update.view.dispatch({ effects: ghostTextRefresh.of(undefined) })
          }
        },
        () => {}
      )
      return
    }

    // 非文档变化（如选区变化或空 dispatch 触发），更新装饰
    if (currentGhostText && currentGhostPos >= 0 && currentGhostPos <= update.state.doc.length) {
      const widget = Decoration.widget({
        widget: new GhostTextWidget(currentGhostText),
        side: 1
      })
      const b = new RangeSetBuilder<Decoration>()
      b.add(currentGhostPos, currentGhostPos, widget)
      this.decorations = b.finish()
    } else {
      this.decorations = Decoration.none
    }
  }

  destroy() {
    currentGhostText = ''
    currentGhostPos = -1
    cancelCompletion()
  }
}, {
  decorations: v => v.decorations,

  eventHandlers: {
    keydown(event: KeyboardEvent, view: EditorView) {
      if (event.key === 'Tab' && currentGhostText && currentGhostPos >= 0) {
        event.preventDefault()
        view.dispatch({
          changes: { from: currentGhostPos, insert: currentGhostText },
          selection: { anchor: currentGhostPos + currentGhostText.length }
        })
        currentGhostText = ''
        currentGhostPos = -1
        return true
      }
      if (event.key === 'Escape' && currentGhostText) {
        currentGhostText = ''
        currentGhostPos = -1
        cancelCompletion()
        view.dispatch({})
        return true
      }
      return false
    }
  }
})

export const ghostTextKeymap = keymap.of([{
  key: 'Alt-\\',
  run(view) {
    const config = getConfig()
    if (!config.enabled) return false
    view.dispatch({ effects: ghostTextTrigger.of(undefined) })
    return true
  }
}])

export function clearGhostText() {
  currentGhostText = ''
  currentGhostPos = -1
  cancelCompletion()
}
