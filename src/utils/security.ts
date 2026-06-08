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
  'checked', 'disabled', 'type', 'aria-label',
  'data-filename', 'data-line', 'data-line-end', 'data-target', 'data-heading',
  'data-source-id',
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
    ADD_TAGS: ['foreignobject', 'style'],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: DANGEROUS_ATTRS,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  })
}

const ENC_PREFIX = 'enc:v2:'

async function getDerivationKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('ai-native-md-key-2024'),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('ai-native-md-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptValue(plaintext: string): Promise<string> {
  if (!plaintext) return ''
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getDerivationKey()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )
  const payload = new Uint8Array(iv.length + encrypted.byteLength)
  payload.set(iv, 0)
  payload.set(new Uint8Array(encrypted), iv.length)
  return ENC_PREFIX + btoa(String.fromCharCode(...payload))
}

export async function decryptValue(ciphertext: string): Promise<string> {
  if (!ciphertext) return ''
  if (!ciphertext.startsWith(ENC_PREFIX)) {
    // Fallback: try legacy v1 XOR deobfuscation
    return legacyDeobfuscateV1(ciphertext)
  }
  try {
    const raw = atob(ciphertext.slice(ENC_PREFIX.length))
    const payload = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) payload[i] = raw.charCodeAt(i)
    const iv = payload.slice(0, 12)
    const data = payload.slice(12)
    const key = await getDerivationKey()
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(decrypted)
  } catch {
    return ''
  }
}

// Legacy v1 XOR deobfuscation for backward compatibility
const V1_PREFIX = 'enc:v1:'
const V1_CRYPTO_KEY = 'ai-native-md-obf-2024'

function legacyDeobfuscateV1(ciphertext: string): string {
  if (!ciphertext.startsWith(V1_PREFIX)) return ciphertext
  try {
    const decoded = atob(ciphertext.slice(V1_PREFIX.length))
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ V1_CRYPTO_KEY.charCodeAt(i % V1_CRYPTO_KEY.length))
    }
    return decodeURIComponent(escape(atob(result)))
  } catch {
    return ''
  }
}

/** @deprecated Use encryptValue instead */
export const obfuscateValue = encryptValue
/** @deprecated Use decryptValue instead */
export const deobfuscateValue = decryptValue

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
