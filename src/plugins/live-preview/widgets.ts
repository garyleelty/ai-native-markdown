import { WidgetType } from '@codemirror/view'

export class LinkWidget extends WidgetType {
  constructor(
    private text: string,
    private url: string
  ) {
    super()
  }

  eq(other: LinkWidget): boolean {
    return other.text === this.text && other.url === this.url
  }

  toDOM(): HTMLElement {
    const a = document.createElement('a')
    a.href = this.url
    a.textContent = this.text
    a.className = 'cm-md-link'
    a.addEventListener('click', (e) => {
      e.preventDefault()
      window.open(this.url, '_blank')
    })
    return a
  }

  ignoreEvent(): boolean {
    return false
  }
}

export class ImageWidget extends WidgetType {
  constructor(
    private alt: string,
    private url: string
  ) {
    super()
  }

  eq(other: ImageWidget): boolean {
    return other.alt === this.alt && other.url === this.url
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span')
    container.className = 'cm-md-image-container'

    const img = document.createElement('img')
    img.src = this.url
    img.alt = this.alt
    img.className = 'cm-md-image'
    img.onerror = () => {
      img.style.display = 'none'
      const fallback = document.createElement('span')
      fallback.className = 'cm-md-image-fallback'
      fallback.textContent = `[图片: ${this.alt}]`
      container.appendChild(fallback)
    }

    container.appendChild(img)
    return container
  }

  ignoreEvent(): boolean {
    return true
  }
}

export class HorizontalRuleWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const hr = document.createElement('hr')
    hr.className = 'cm-md-hr'
    return hr
  }

  ignoreEvent(): boolean {
    return true
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super()
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-md-checkbox'
    span.textContent = this.checked ? '☑' : '☐'
    return span
  }

  ignoreEvent(): boolean {
    return true
  }
}
