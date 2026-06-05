import { EditorView, WidgetType } from '@codemirror/view'
import { createApp, h, type App } from 'vue'
import { aiService } from '@/services/ai'
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
  private abortController: AbortController | null = null

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
      btn.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        event.stopPropagation()
      })
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
    closeBtn.type = 'button'
    closeBtn.textContent = '×'
    closeBtn.setAttribute('aria-label', '关闭内联编辑')
    closeBtn.title = '关闭'
    closeBtn.style.cssText = `
      position: absolute; top: 6px; right: 8px;
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; font-size: 14px; padding: 2px 4px;
    `
    closeBtn.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
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
    this.abortController?.abort()
    this.abortController = null
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

    const diffContainer = this.container?.querySelector('.inline-edit-diff-container') as HTMLElement
    if (!diffContainer || !diffContainer.isConnected) return

    const provider = aiService.getActiveProvider()
    if (!provider) {
      this.showStatus(diffContainer, '请先在设置中配置 AI 服务', 'error')
      return
    }

    this.unmountVueApp()
    this.abortController?.abort()
    const controller = new AbortController()
    this.abortController = controller

    diffContainer.style.display = 'block'
    const loadingEl = document.createElement('div')
    loadingEl.style.cssText = 'color: var(--text-muted); font-size: 12px; padding: 8px;'
    loadingEl.textContent = 'AI 处理中...'
    diffContainer.replaceChildren()
    diffContainer.appendChild(loadingEl)

    try {
      let result = ''
      for await (const chunk of provider.streamChat([
        { role: 'system', content: '你是一个专业的 Markdown 写作助手，只输出处理后的文本。' },
        { role: 'user', content: action.prompt + this.selectedText }
      ], { temperature: 0.5, signal: controller.signal })) {
        result += chunk
        if (this.destroyed || controller.signal.aborted) return
      }

      if (this.destroyed || controller.signal.aborted || !diffContainer.isConnected) return

      diffContainer.replaceChildren()
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
      if (this.destroyed || controller.signal.aborted || e?.name === 'AbortError' || !diffContainer.isConnected) return
      this.showStatus(diffContainer, `处理失败: ${e?.message || e}`, 'error')
    } finally {
      if (this.abortController === controller) this.abortController = null
    }
  }

  private showStatus(container: HTMLElement, message: string, type: 'error' | 'muted') {
    this.unmountVueApp()
    container.style.display = 'block'
    container.replaceChildren()
    const statusEl = document.createElement('div')
    statusEl.className = `inline-edit-status ${type}`
    statusEl.style.cssText = `color: ${type === 'error' ? 'var(--accent-red)' : 'var(--text-muted)'}; font-size: 12px; padding: 8px;`
    statusEl.textContent = message
    container.appendChild(statusEl)
  }

  ignoreEvent() { return true }

  destroy() {
    this.destroyed = true
    this.abortController?.abort()
    this.abortController = null
    this.unmountVueApp()
    this.container = null
  }
}
