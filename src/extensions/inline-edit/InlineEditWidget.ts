import { EditorView, WidgetType } from '@codemirror/view'
import { createApp, h } from 'vue'
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

  constructor(selectedText: string, from: number, to: number, view: EditorView, onClose: () => void) {
    super()
    this.selectedText = selectedText
    this.from = from
    this.to = to
    this.view = view
    this.onClose = onClose
  }

  toDOM() {
    const container = document.createElement('div')
    container.className = 'cm-inline-edit-widget'
    container.style.cssText = `
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

    container.appendChild(actionsRow)

    const diffContainer = document.createElement('div')
    diffContainer.className = 'inline-edit-diff-container'
    diffContainer.style.display = 'none'
    container.appendChild(diffContainer)

    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '✕'
    closeBtn.style.cssText = `
      position: absolute; top: 6px; right: 8px;
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; font-size: 14px; padding: 2px 4px;
    `
    closeBtn.addEventListener('click', () => {
      this.onClose()
      // 触发选区清空以移除 decoration
      const pos = this.view.state.selection.main.head
      this.view.dispatch({ selection: { anchor: pos, head: pos } })
    })
    container.appendChild(closeBtn)

    return container
  }

  private async handleAction(action: typeof INLINE_EDIT_ACTIONS[number]) {
    const { aiService } = await import('@/services/ai')
    const provider = aiService.getActiveProvider()
    if (!provider) return

    const widget = this.view.dom.querySelector('.cm-inline-edit-widget')
    const diffContainer = widget?.querySelector('.inline-edit-diff-container') as HTMLElement
    if (!diffContainer) return

    diffContainer.style.display = 'block'
    diffContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 8px;">AI 处理中...</div>'

    try {
      let result = ''
      for await (const chunk of provider.streamChat([
        { role: 'system', content: '你是一个专业的 Markdown 写作助手，只输出处理后的文本。' },
        { role: 'user', content: action.prompt + this.selectedText }
      ], { temperature: 0.5 })) {
        result += chunk
      }

      diffContainer.innerHTML = ''
      const app = createApp({
        render: () => h(DiffView, {
          oldText: this.selectedText,
          newText: result.trim(),
          onAccept: (text: string) => {
            this.view.dispatch({
              changes: { from: this.from, to: this.to, insert: text }
            })
            this.onClose()
          },
          onReject: () => {
            this.onClose()
            const pos = this.view.state.selection.main.head
            this.view.dispatch({ selection: { anchor: pos, head: pos } })
          }
        })
      })
      app.mount(diffContainer)
    } catch (e: any) {
      diffContainer.innerHTML = `<div style="color: var(--accent-red); font-size: 12px; padding: 8px;">处理失败: ${e?.message || e}</div>`
    }
  }

  ignoreEvent() { return false }
}
