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
      btn.innerHTML = `<span class="cm-ai-action-icon">${action.icon}</span><span class="cm-ai-action-label">${action.label}</span>`
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
    resultEl.innerHTML = `
      <div class="cm-ai-result-header">
        <span class="cm-ai-result-status">AI 处理中...</span>
        <button class="cm-ai-result-close" title="关闭">&times;</button>
      </div>
      <div class="cm-ai-result-body">
        <div class="cm-ai-typing-indicator"><span></span><span></span><span></span></div>
      </div>
    `
    resultEl.querySelector('.cm-ai-result-close')?.addEventListener('click', () => {
      this.destroyResult()
    })
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

    resultEl.innerHTML = `
      <div class="cm-ai-result-header">
        <span class="cm-ai-result-status">${type === 'success' ? '处理完成' : '处理失败'}</span>
        <div class="cm-ai-result-actions">
          <button class="cm-ai-result-btn accept" title="替换原文">替换</button>
          <button class="cm-ai-result-btn insert" title="插入到原文之后">插入</button>
          <button class="cm-ai-result-close" title="关闭">&times;</button>
        </div>
      </div>
      <div class="cm-ai-result-body">${sanitizeMarkdown(text)}</div>
    `

    if (type === 'success') {
      resultEl.querySelector('.cm-ai-result-btn.accept')?.addEventListener('click', () => {
        this.view.dispatch({
          changes: { from: this.from, to: this.to, insert: text },
          selection: { anchor: this.from + text.length }
        })
        this.view.focus()
      })
      resultEl.querySelector('.cm-ai-result-btn.insert')?.addEventListener('click', () => {
        const inserted = '\n\n' + text
        this.view.dispatch({
          changes: { from: this.to, insert: inserted },
          selection: { anchor: this.to + inserted.length }
        })
        this.view.focus()
      })
    }
    resultEl.querySelector('.cm-ai-result-close')?.addEventListener('click', () => {
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  ignoreEvent(): boolean { return false }

  eq(other: AIActionMenuWidget): boolean {
    return this.from === other.from && this.to === other.to && this.selectedText === other.selectedText
  }
}