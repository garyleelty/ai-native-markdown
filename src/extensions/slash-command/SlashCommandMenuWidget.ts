import { WidgetType } from '@codemirror/view'
import type { SlashCommand, CommandContext } from '@/services/commandRegistry'

export class SlashCommandMenuWidget extends WidgetType {
  private commands: SlashCommand[]
  private selectedIndex: number
  private onSelect: (command: SlashCommand, index: number) => void
  private onClose: () => void

  constructor(
    commands: SlashCommand[],
    selectedIndex: number,
    onSelect: (command: SlashCommand, index: number) => void,
    onClose: () => void
  ) {
    super()
    this.commands = commands
    this.selectedIndex = selectedIndex
    this.onSelect = onSelect
    this.onClose = onClose
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'slash-command-menu'

    let currentCategory = ''
    for (let i = 0; i < this.commands.length; i++) {
      const cmd = this.commands[i]
      if (cmd.category !== currentCategory) {
        currentCategory = cmd.category
        const categoryEl = document.createElement('div')
        categoryEl.className = 'slash-command-category'
        categoryEl.textContent = this.getCategoryLabel(currentCategory)
        container.appendChild(categoryEl)
      }

      const item = document.createElement('div')
      item.className = 'slash-command-item' + (i === this.selectedIndex ? ' selected' : '')
      item.dataset.index = String(i)

      const icon = document.createElement('span')
      icon.className = 'slash-command-icon'
      icon.textContent = cmd.icon

      const label = document.createElement('span')
      label.className = 'slash-command-label'
      label.textContent = cmd.label

      const desc = document.createElement('span')
      desc.className = 'slash-command-desc'
      desc.textContent = cmd.description

      item.append(icon, label, desc)

      item.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      item.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.onSelect(cmd, i)
      })

      container.appendChild(item)
    }

    return container
  }

  private getCategoryLabel(category: string): string {
    switch (category) {
      case 'block': return '块级元素'
      case 'ai': return 'AI 操作'
      case 'insert': return '插入'
      default: return category
    }
  }

  updateSelected(index: number): void {
    const container = (this as unknown as { dom?: HTMLElement }).dom
    if (!container) return
    const items = container.querySelectorAll('.slash-command-item')
    items.forEach((el, i) => {
      el.classList.toggle('selected', i === index)
    })
  }

  ignoreEvent(): boolean { return true }

  eq(other: SlashCommandMenuWidget): boolean {
    return (
      this.commands.length === other.commands.length &&
      this.selectedIndex === other.selectedIndex &&
      this.commands.every((c, i) => c.id === other.commands[i].id)
    )
  }

  destroy(): void {}
}
