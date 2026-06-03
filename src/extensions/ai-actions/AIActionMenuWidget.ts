import { WidgetType, EditorView } from '@codemirror/view'
import { AI_ACTIONS, type AIAction } from './types'
import { aiService } from '@/services/ai'
import { sanitizeMarkdown } from '@/utils/security'

export class AIActionMenuWidget extends WidgetType {
  private selectedText: string
  private from: number
  private to: number
  private view: EditorView

  constructor(selectedText: string, from: number, to: number, view: EditorView) {
    super()
    this.selectedText = selectedText
    this.from = from
    this.to = to
    this.view = view
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'cm-ai-action-menu'

    const actionsRow = document.createElement('div')
    actionsRow.className = 'cm-ai-action-row'

    for (const action of AI_ACTIONS) {
      const btn = document.createElement('button')
      btn.className = 'cm-ai-action-btn'
      btn.title = action.label
      const icon = document.createElement('span')
      icon.className = 'cm-ai-action-icon'
      icon.textContent = action.icon
      const label = document.createElement('span')
      label.className = 'cm-ai-action-label'
      label.textContent = action.label
      btn.append(icon, label)
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.executeAction(action)
      })
      actionsRow.appendChild(btn)
    }

    container.appendChild(actionsRow)

    const resultContainer = document.createElement('div')
    resultContainer.className = 'cm-ai-action-result'
    resultContainer.style.display = 'none'
    container.appendChild(resultContainer)

    return container
  }

  private async executeAction(action: AIAction) {
    const provider = aiService.getActiveProvider()
    if (!provider) {
      this.showResult('请先在设置中配置 AI 服务', 'error')
      return
    }

    this.showLoading()

    try {
      let result = ''
      for await (const chunk of provider.streamChat([
        { role: 'system', content: action.systemRole },
        { role: 'user', content: action.prompt + this.selectedText }
      ], { temperature: action.temperature ?? 0.3 })) {
        result += chunk
        this.showStreamingResult(result)
      }
      this.showResult(result.trim(), 'success')
    } catch (e: any) {
      this.showResult(`处理失败: ${e?.message || String(e)}`, 'error')
    }
  }

  private showLoading() {
    const resultEl = this.getResultContainer()
    if (!resultEl) return
    resultEl.style.display = 'block'
    resultEl.className = 'cm-ai-action-result loading'
    resultEl.replaceChildren()

    const header = document.createElement('div')
    header.className = 'cm-ai-result-header'
    const status = document.createElement('span')
    status.className = 'cm-ai-result-status'
    status.textContent = 'AI 处理中...'
    const close = document.createElement('button')
    close.className = 'cm-ai-result-close'
    close.title = '关闭'
    close.textContent = 'x'
    close.addEventListener('click', () => {
      this.destroyResult()
    })
    header.append(status, close)

    const body = document.createElement('div')
    body.className = 'cm-ai-result-body'
    const indicator = document.createElement('div')
    indicator.className = 'cm-ai-typing-indicator'
    indicator.append(document.createElement('span'), document.createElement('span'), document.createElement('span'))
    body.appendChild(indicator)
    resultEl.append(header, body)
  }

  private showStreamingResult(text: string) {
    const body = this.getResultBody()
    if (!body) return
    body.textContent = text
  }

  private showResult(text: string, type: 'success' | 'error') {
    const resultEl = this.getResultContainer()
    if (!resultEl) return
    resultEl.style.display = 'block'
    resultEl.className = `cm-ai-action-result ${type}`
    resultEl.replaceChildren()

    const header = document.createElement('div')
    header.className = 'cm-ai-result-header'
    const status = document.createElement('span')
    status.className = 'cm-ai-result-status'
    status.textContent = type === 'success' ? '处理完成' : '处理失败'
    const actions = document.createElement('div')
    actions.className = 'cm-ai-result-actions'

    const acceptBtn = document.createElement('button')
    acceptBtn.className = 'cm-ai-result-btn accept'
    acceptBtn.title = '替换原文'
    acceptBtn.textContent = '替换'
    const insertBtn = document.createElement('button')
    insertBtn.className = 'cm-ai-result-btn insert'
    insertBtn.title = '插入到原文之后'
    insertBtn.textContent = '插入'
    const closeBtn = document.createElement('button')
    closeBtn.className = 'cm-ai-result-close'
    closeBtn.title = '关闭'
    closeBtn.textContent = 'x'

    actions.append(acceptBtn, insertBtn, closeBtn)
    header.append(status, actions)

    const body = document.createElement('div')
    body.className = 'cm-ai-result-body'
    body.innerHTML = sanitizeMarkdown(text)
    resultEl.append(header, body)

    if (type === 'success') {
      acceptBtn.addEventListener('click', () => {
        this.view.dispatch({
          changes: { from: this.from, to: this.to, insert: text },
          selection: { anchor: this.from + text.length }
        })
        this.view.focus()
      })
      insertBtn.addEventListener('click', () => {
        const inserted = '\n\n' + text
        this.view.dispatch({
          changes: { from: this.to, insert: inserted },
          selection: { anchor: this.to + inserted.length }
        })
        this.view.focus()
      })
    }
    closeBtn.addEventListener('click', () => {
      this.destroyResult()
    })
  }

  private getResultContainer(): HTMLElement | null {
    const widget = this.view.dom.querySelector('.cm-ai-action-menu')
    return widget?.querySelector('.cm-ai-action-result') as HTMLElement | null
  }

  private getResultBody(): HTMLElement | null {
    const resultEl = this.getResultContainer()
    return resultEl?.querySelector('.cm-ai-result-body') as HTMLElement | null
  }

  private destroyResult() {
    const resultEl = this.getResultContainer()
    if (resultEl) resultEl.style.display = 'none'
  }

  private destroyWidget() {
    this.view.dispatch({ selection: { anchor: this.to } })
    this.view.focus()
  }
  ignoreEvent(): boolean { return false }

  eq(other: AIActionMenuWidget): boolean {
    return this.from === other.from && this.to === other.to && this.selectedText === other.selectedText
  }
}
