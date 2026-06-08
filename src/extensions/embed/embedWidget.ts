import { EditorView, WidgetType } from '@codemirror/view'
import { resolveEmbed, type EmbedResult } from '@/services/embedResolver'
import { resolveEmbedPlaceholders } from '@/services/embedRenderer'
import { escapeHtml } from '@/utils/security'

export interface EmbedWidgetOptions {
  currentFile?: () => string
  currentContent?: () => string
  onNavigate?: (target: string) => void
  onDependencies?: (dependencies: string[]) => void
}

function navigationTarget(filePath: string, heading?: string): string {
  return heading ? `${filePath}#${heading}` : filePath
}

type AssetEmbedType = 'image' | 'audio' | 'video' | 'pdf'

export class EmbedWidget extends WidgetType {
  private result: EmbedResult | null = null
  private container: HTMLElement | null = null
  private destroyed = false

  constructor(
    private readonly target: string,
    private readonly heading: string | undefined,
    private readonly renderKey: string | number = 0,
    private readonly options: EmbedWidgetOptions = {}
  ) {
    super()
  }

  toDOM(_view: EditorView): HTMLElement {
    this.container = document.createElement('div')
    this.container.className = 'cm-live-preview-embed cm-live-preview-embed-loading'
    this.container.textContent = '加载嵌入内容...'
    void this.loadContent()
    return this.container
  }

  private async loadContent(): Promise<void> {
    if (this.destroyed) return
    const sourcePath = this.options.currentFile?.()
    const currentContent = this.options.currentContent?.()
    this.result = await resolveEmbed(this.target, this.heading, 0, sourcePath, currentContent)
    if (this.destroyed || !this.container) return
    if (this.result.filePath) this.options.onDependencies?.([this.result.filePath])
    await this.render()
  }

  private async render(): Promise<void> {
    if (!this.container || !this.result) return
    const label = this.heading ? `${this.target || 'current file'}#${this.heading}` : this.target

    if (this.result.type === 'not-found') {
      this.container.className = 'cm-live-preview-embed cm-live-preview-embed-not-found'
      this.container.innerHTML = [
        '<div class="cm-live-preview-embed-header">',
        `<span class="cm-live-preview-embed-path">${escapeHtml(label)}</span>`,
        '</div>',
        '<div class="cm-live-preview-embed-error">未找到嵌入目标</div>',
      ].join('')
      return
    }

    if (['image', 'audio', 'video', 'pdf'].includes(this.result.type)) {
      this.renderAsset(label, this.result.type as AssetEmbedType)
      this.bindNavigation()
      return
    }

    this.container.className = 'cm-live-preview-embed cm-live-preview-embed-note'
    this.container.innerHTML = [
      '<div class="cm-live-preview-embed-header">',
      this.renderSourceButton(label),
      '</div>',
      `<div class="cm-live-preview-embed-content">${this.result.content || ''}</div>`,
    ].join('')
    this.bindNavigation()

    const dependencies = new Set<string>()
    await resolveEmbedPlaceholders(this.container, {
      sourcePath: this.result.filePath,
      currentContent: this.result.rawContent,
      onDependency: (filePath) => dependencies.add(filePath),
    })
    if (dependencies.size > 0) this.options.onDependencies?.([...dependencies])
  }

  private renderSourceButton(label: string): string {
    if (!this.result?.filePath) return `<span class="cm-live-preview-embed-path">${escapeHtml(label)}</span>`
    const target = navigationTarget(this.result.filePath, this.result.heading)
    return [
      `<button class="cm-live-preview-embed-source" data-filename="${escapeHtml(target)}" type="button">`,
      `<span class="cm-live-preview-embed-path">${escapeHtml(label)}</span>`,
      '</button>',
    ].join('')
  }

  private renderAsset(label: string, type: AssetEmbedType): void {
    if (!this.container || !this.result) return
    const escapedContent = escapeHtml(this.result.content || '')
    const escapedLabel = escapeHtml(label)
    const header = [
      '<div class="cm-live-preview-embed-header">',
      this.renderSourceButton(label),
      '</div>',
    ].join('')
    this.container.className = `cm-live-preview-embed cm-live-preview-embed-${type}`

    if (type === 'image') {
      this.container.innerHTML = [
        header,
        `<img src="${escapedContent}" alt="${escapedLabel}" />`,
      ].join('')
      return
    }

    if (type === 'audio') {
      this.container.innerHTML = [
        header,
        `<audio controls preload="metadata" src="${escapedContent}"></audio>`,
      ].join('')
      return
    }

    if (type === 'video') {
      this.container.innerHTML = [
        header,
        `<video controls preload="metadata" src="${escapedContent}"></video>`,
      ].join('')
      return
    }

    this.container.innerHTML = [
      header,
      `<iframe class="cm-live-preview-embed-pdf-frame" src="${escapedContent}" title="${escapedLabel}" sandbox></iframe>`,
    ].join('')
  }

  private bindNavigation(): void {
    const button = this.container?.querySelector<HTMLButtonElement>('.cm-live-preview-embed-source')
    if (!button) return
    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const target = button.dataset.filename
      if (target) this.options.onNavigate?.(target)
    })
  }

  eq(other: EmbedWidget): boolean {
    return other.target === this.target && other.heading === this.heading && other.renderKey === this.renderKey
  }

  ignoreEvent(): boolean {
    return false
  }

  destroy(): void {
    this.destroyed = true
    this.container = null
  }
}
