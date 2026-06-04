import DOMPurify from 'dompurify'

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function sanitizeFilePath(path: string): string {
  let sanitized = path.replace(/\0/g, '')
  sanitized = sanitized.replace(/\\/g, '/')
  const parts = sanitized.split('/').filter(part => part !== '..' && part !== '.')
  sanitized = parts.join('/')
  sanitized = sanitized.replace(/\/+/g, '/')
  if (!sanitized.startsWith('/')) {
    sanitized = '/' + sanitized
  }
  return sanitized
}

export function isValidFileName(name: string): boolean {
  if (!name || name.trim().length === 0) return false
  if (name.includes('/') || name.includes('\\')) return false
  if (name.startsWith('.')) return false
  if (/[\x00-\x1f\x7f]/.test(name)) return false
  if (name.length > 255) return false
  return true
}

const MARKDOWN_ALLOWED_TAGS = [
  'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
  'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr',
  'span', 'div', 'del', 'sup', 'sub', 'input', 'button',
  'svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline',
  'ellipse', 'text', 'g', 'defs', 'use', 'clippath', 'title', 'desc',
  'tspan', 'image', 'marker', 'pattern', 'stop',
  'lineargradient', 'radialgradient',
  'math', 'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'mfrac',
  'msqrt', 'mroot', 'munder', 'mover', 'munderover', 'mtable',
  'mtr', 'mtd', 'mtext', 'mspace', 'mpadded', 'mphantom',
  'mfenced', 'menclose', 'mstyle', 'merror', 'annotation', 'semantics',
]

const MARKDOWN_ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'target', 'rel',
  'checked', 'disabled', 'type',
  'data-filename', 'data-line', 'data-line-end',
  'style',
  'd', 'r', 'cx', 'cy', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2',
  'points', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-opacity', 'fill-opacity', 'opacity', 'font-size', 'text-anchor',
  'viewbox', 'preserveaspectratio', 'xmlns', 'id',
  'mathvariant', 'displaystyle', 'scriptlevel',
  'colspan', 'rowspan',
  'offset', 'stop-color', 'stop-opacity',
  'textlength', 'lengthadjust', 'font-family', 'font-weight',
  'dominant-baseline', 'alignment-baseline',
]

const DANGEROUS_ATTRS = [
  'onload', 'onclick', 'onerror', 'onmouseover', 'onfocus', 'onblur',
  'onsubmit', 'onreset', 'onchange', 'oninput', 'onkeydown', 'onkeyup',
  'onkeypress', 'onmouseout', 'onmousedown', 'onmouseup',
]

export function sanitizeMarkdown(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: MARKDOWN_ALLOWED_TAGS,
    ALLOWED_ATTR: MARKDOWN_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: DANGEROUS_ATTRS,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  })
}

export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['foreignobject'],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: DANGEROUS_ATTRS,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  })
}

const ENC_PREFIX = 'enc:v1:'
const CRYPTO_KEY = 'ai-native-md-obf-2024'

export function obfuscateValue(plaintext: string): string {
  if (!plaintext) return ''
  const encoded = btoa(unescape(encodeURIComponent(plaintext)))
  let result = ''
  for (let i = 0; i < encoded.length; i++) {
    result += String.fromCharCode(encoded.charCodeAt(i) ^ CRYPTO_KEY.charCodeAt(i % CRYPTO_KEY.length))
  }
  return ENC_PREFIX + btoa(result)
}

export function deobfuscateValue(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith(ENC_PREFIX)) return ciphertext
  try {
    const decoded = atob(ciphertext.slice(ENC_PREFIX.length))
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ CRYPTO_KEY.charCodeAt(i % CRYPTO_KEY.length))
    }
    return decodeURIComponent(escape(atob(result)))
  } catch {
    return ''
  }
}

export const encryptValue = obfuscateValue
export const decryptValue = deobfuscateValue

export const safeStorage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key)
      if (!item) return defaultValue
      return JSON.parse(item) as T
    } catch {
      return defaultValue
    }
  },

  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
    }
  },

  clear(): void {
    try {
      localStorage.clear()
    } catch {
    }
  },
}

export async function safeCopyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}
