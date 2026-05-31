import { EditorView, WidgetType } from '@codemirror/view'
import { createApp, h, type App } from 'vue'
import DiffView from './DiffView.vue'

const INLINE_EDIT_ACTIONS = [
  { id: 'polish', label: '润色', prompt: '请润色以下文本，保持原意，直接输出润色结果：\n\n' },
  { id: 'expand', label: '扩写', prompt: '请扩写以下文本，保持风格一致，直接输出扩写结果：\n\n' },
  { id: 'condense', label: '精简', prompt: '请精简以下文本，保留核心信息，直接输出精简结果：\n\n' },
  { id: 'translate', label: '翻译', prompt: '请将以下文本翻译为英文，直接输出翻译结果：\n\n' },
] as const

export class InlineEditWidget extends WidgetType {
  private selectedText: string
  private from: number
  private to: number
  private view: EditorView
  private onClose: () => void
  private container: HTMLElement | null = null
  private vueApp: App | null = null
  private destroyed = false

  constructor(selectedText: string, from: number, to: number, view: EditorView, onClose: () => void) {
    super()
    this.selectedText = selectedText
    this.from = from
    this.to = to
    this.view = view
    this.onClose = onClose
  }

  toDOM() {
    this.container = document.createElement('div')
    this.container.className = 'cm-inline-edit-widget'
    this.container.style.cssText = `
      position: relative;
      padding: 8px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      margin: 8px 0;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    `

    const actionsRow = document.createElement('div')
    actionsRow.style.cssText = 'display: flex; gap: 6px; margin-bottom: 8px;'

    for (const action of INLINE_EDIT_ACTIONS) {
      const btn = document.createElement('button')
      btn.className = `inline-edit-action action-${action.id}`
      btn.textContent = action.label
      btn.style.cssText = `
        padding: 4px 12px;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        background: var(--bg-primary);
        color: var(--text-secondary);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      `
      btn.addEventListener('click', () => this.handleAction(action))
      btn.addEventListener('mouseenter', () => {
        btn.style.color = 'var(--accent-primary)'
        btn.style.borderColor = 'var(--accent-primary)'
      })
      btn.addEventListener('mouseleave', () => {
        btn.style.color = 'var(--text-secondary)'
        btn.style.borderColor = 'var(--border-subtle)'
      })
      actionsRow.appendChild(btn)
    }

    this.container.appendChild(actionsRow)

    const diffContainer = document.createElement('div')
    diffContainer.className = 'inline-edit-diff-container'
    diffContainer.style.display = 'none'
    this.container.appendChild(diffContainer)

    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '✕'
    closeBtn.style.cssText = `
      position: absolute; top: 6px; right: 8px;
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; font-size: 14px; padding: 2px 4px;
    `
    closeBtn.addEventListener('click', () => {
      this.cleanup()
      const pos = this.view.state.selection.main.head
      this.view.dispatch({ selection: { anchor: pos, head: pos } })
    })
    this.container.appendChild(closeBtn)

    return this.container
  }

  private cleanup() {
    this.destroyed = true
    this.unmountVueApp()
    this.onClose()
  }

  private unmountVueApp() {
    if (this.vueApp) {
      this.vueApp.unmount()
      this.vueApp = null
    }
  }

  private async handleAction(action: typeof INLINE_EDIT_ACTIONS[number]) {
    if (this.destroyed) return

    const { aiService } = await import('@/services/ai')
    const provider = aiService.getActiveProvider()
    if (!provider) return

    const diffContainer = this.container?.querySelector('.inline-edit-diff-container') as HTMLElement
    if (!diffContainer || !diffContainer.isConnected) return

    this.unmountVueApp()

    diffContainer.style.display = 'block'
    const loadingEl = document.createElement('div')
    loadingEl.style.cssText = 'color: var(--text-muted); font-size: 12px; padding: 8px;'
    loadingEl.textContent = 'AI 处理中...'
    diffContainer.innerHTML = ''
    diffContainer.appendChild(loadingEl)

    try {
      let result = ''
      for await (const chunk of provider.streamChat([
        { role: 'system', content: '你是一个专业的 Markdown 写作助手，只输出处理后的文本。' },
        { role: 'user', content: action.prompt + this.selectedText }
      ], { temperature: 0.5 })) {
        result += chunk
        if (this.destroyed) return
      }

      if (this.destroyed || !diffContainer.isConnected) return

      diffContainer.innerHTML = ''
      this.vueApp = createApp({
        render: () => h(DiffView, {
          oldText: this.selectedText,
          newText: result.trim(),
          onAccept: (text: string) => {
            this.view.dispatch({
              changes: { from: this.from, to: this.to, insert: text },
              selection: { anchor: this.from + text.length }
            })
            this.cleanup()
          },
          onReject: () => {
            this.cleanup()
            const pos = this.view.state.selection.main.head
            this.view.dispatch({ selection: { anchor: pos, head: pos } })
          }
        })
      })
      this.vueApp.mount(diffContainer)
    } catch (e: any) {
      if (this.destroyed || !diffContainer.isConnected) return
      diffContainer.innerHTML = ''
      const errorEl = document.createElement('div')
      errorEl.style.cssText = 'color: var(--accent-red); font-size: 12px; padding: 8px;'
      errorEl.textContent = `处理失败: ${e?.message || e}`
      diffContainer.appendChild(errorEl)
    }
  }

  ignoreEvent() { return false }
}
