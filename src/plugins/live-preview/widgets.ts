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

type Align = 'left' | 'center' | 'right'

export class TableWidget extends WidgetType {
  private headers: string[]
  private rows: string[][]
  private aligns: Align[]

  constructor(headers: string[], rows: string[][], aligns: Align[]) {
    super()
    this.headers = headers
    this.rows = rows
    this.aligns = aligns
  }

  eq(other: TableWidget): boolean {
    if (this.headers.length !== other.headers.length) return false
    if (this.rows.length !== other.rows.length) return false
    if (this.aligns.length !== other.aligns.length) return false
    for (let i = 0; i < this.headers.length; i++) {
      if (this.headers[i] !== other.headers[i]) return false
    }
    for (let i = 0; i < this.rows.length; i++) {
      for (let j = 0; j < this.rows[i].length; j++) {
        if (this.rows[i][j] !== other.rows[i][j]) return false
      }
    }
    for (let i = 0; i < this.aligns.length; i++) {
      if (this.aligns[i] !== other.aligns[i]) return false
    }
    return true
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'cm-md-table-container'

    const table = document.createElement('table')
    table.className = 'cm-md-table'

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    for (let i = 0; i < this.headers.length; i++) {
      const th = document.createElement('th')
      th.textContent = this.headers[i].trim()
      th.style.textAlign = this.aligns[i] || 'left'
      headerRow.appendChild(th)
    }
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (const row of this.rows) {
      const tr = document.createElement('tr')
      for (let i = 0; i < this.headers.length; i++) {
        const td = document.createElement('td')
        td.textContent = (row[i] || '').trim()
        td.style.textAlign = this.aligns[i] || 'left'
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    container.appendChild(table)
    return container
  }

  ignoreEvent(): boolean {
    return true
  }
}
