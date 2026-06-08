import { describe, it, expect, beforeAll } from 'vitest'
import {
  escapeHtml,
  sanitizeFilePath,
  isValidFileName,
  sanitizeMarkdown,
  sanitizeSvg,
  encryptValue,
  decryptValue,
  safeStorage,
  safeCopyToClipboard,
} from '../security'

// jsdom in vitest may not have a working localStorage without a URL config.
// Provide a minimal in-memory fallback so safeStorage tests work reliably.
beforeAll(() => {
  if (typeof localStorage === 'undefined' || (() => { try { localStorage.setItem('__test__', '1'); localStorage.removeItem('__test__'); return false } catch { return true } })()) {
    const store: Record<string, string> = {}
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { Object.keys(store).forEach(k => delete store[k]) },
        get length() { return Object.keys(store).length },
        key: (_index: number) => null,
      },
      writable: true,
      configurable: true,
    })
  }
})

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
  it('escapes & to &amp;', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes < to &lt;', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b')
  })

  it('escapes > to &gt;', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b')
  })

  it('escapes " to &quot;', () => {
    expect(escapeHtml('a "b" c')).toBe('a &quot;b&quot; c')
  })

  it("escapes ' to &#39;", () => {
    expect(escapeHtml("a 'b' c")).toBe('a &#39;b&#39; c')
  })

  it('returns unchanged string when no special chars', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('escapes all special chars in a single string', () => {
    expect(escapeHtml('<a href="x&y">z\'w</a>')).toBe(
      '&lt;a href=&quot;x&amp;y&quot;&gt;z&#39;w&lt;/a&gt;'
    )
  })
})

// ---------------------------------------------------------------------------
// sanitizeFilePath
// ---------------------------------------------------------------------------
describe('sanitizeFilePath', () => {
  it('removes null bytes', () => {
    expect(sanitizeFilePath('a\0b\0c')).toBe('/abc')
  })

  it('converts backslashes to forward slashes', () => {
    expect(sanitizeFilePath('a\\b\\c')).toBe('/a/b/c')
  })

  it('removes .. segments', () => {
    expect(sanitizeFilePath('/a/../b')).toBe('/a/b')
  })

  it('removes . segments', () => {
    expect(sanitizeFilePath('/a/./b')).toBe('/a/b')
  })

  it('adds leading / if missing', () => {
    expect(sanitizeFilePath('a/b/c')).toBe('/a/b/c')
  })

  it('does not add leading / if already present', () => {
    expect(sanitizeFilePath('/a/b/c')).toBe('/a/b/c')
  })

  it('consolidates multiple slashes', () => {
    expect(sanitizeFilePath('a///b//c')).toBe('/a/b/c')
  })

  it('handles empty string', () => {
    expect(sanitizeFilePath('')).toBe('/')
  })

  it('handles path with all removed segments', () => {
    expect(sanitizeFilePath('..')).toBe('/')
    expect(sanitizeFilePath('.')).toBe('/')
  })
})

// ---------------------------------------------------------------------------
// isValidFileName
// ---------------------------------------------------------------------------
describe('isValidFileName', () => {
  it('rejects empty string', () => {
    expect(isValidFileName('')).toBe(false)
  })

  it('rejects whitespace-only string', () => {
    expect(isValidFileName('   ')).toBe(false)
  })

  it('rejects names with forward slash', () => {
    expect(isValidFileName('a/b')).toBe(false)
  })

  it('rejects names with backslash', () => {
    expect(isValidFileName('a\\b')).toBe(false)
  })

  it('rejects names starting with dot', () => {
    expect(isValidFileName('.hidden')).toBe(false)
  })

  it('rejects names with control characters', () => {
    expect(isValidFileName('a\x00b')).toBe(false)
    expect(isValidFileName('a\x1fb')).toBe(false)
    expect(isValidFileName('a\x7fb')).toBe(false)
  })

  it('rejects names longer than 255 characters', () => {
    const longName = 'a'.repeat(256)
    expect(isValidFileName(longName)).toBe(false)
  })

  it('accepts valid names', () => {
    expect(isValidFileName('readme.md')).toBe(true)
    expect(isValidFileName('my file.txt')).toBe(true)
    expect(isValidFileName('中文文件.md')).toBe(true)
  })

  it('accepts names exactly 255 characters', () => {
    const name = 'a'.repeat(255)
    expect(isValidFileName(name)).toBe(true)
  })

  it('accepts names with dots not at the start', () => {
    expect(isValidFileName('file.test.md')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// sanitizeMarkdown
// ---------------------------------------------------------------------------
describe('sanitizeMarkdown', () => {
  it('removes script tags', () => {
    const result = sanitizeMarkdown('<script>alert("xss")</script>')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert')
  })

  it('removes onclick handlers', () => {
    const result = sanitizeMarkdown('<div onclick="alert(1)">click</div>')
    expect(result).not.toContain('onclick')
  })

  it('removes onerror handlers', () => {
    const result = sanitizeMarkdown('<img src="x" onerror="alert(1)">')
    expect(result).not.toContain('onerror')
  })

  it('preserves allowed tags', () => {
    const html = '<strong>bold</strong> <em>italic</em> <code>code</code>'
    expect(sanitizeMarkdown(html)).toBe(html)
  })

  it('preserves allowed attributes', () => {
    const html = '<a href="https://example.com" target="_blank" rel="noopener">link</a>'
    const result = sanitizeMarkdown(html)
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('target="_blank"')
    expect(result).toContain('rel="noopener"')
  })

  it('removes iframe tags', () => {
    const result = sanitizeMarkdown('<iframe src="evil.com"></iframe>')
    expect(result).not.toContain('<iframe')
  })

  it('removes style tags', () => {
    const result = sanitizeMarkdown('<style>body{display:none}</style>')
    expect(result).not.toContain('<style')
  })

  it('removes style attributes from elements', () => {
    const html = '<p style="color: red; font-size: 20px;">text</p>'
    const result = sanitizeMarkdown(html)
    expect(result).not.toContain('style="')
    expect(result).toContain('<p>text</p>')
  })

  it('removes CSS injection attempts via style attributes', () => {
    const html = '<div style="background: url(&#x27;javascript:alert(1)&#x27;)">evil</div>'
    const result = sanitizeMarkdown(html)
    expect(result).not.toContain('javascript:')
    expect(result).not.toContain('style="')
  })
})

// ---------------------------------------------------------------------------
// sanitizeSvg
// ---------------------------------------------------------------------------
describe('sanitizeSvg', () => {
  it('removes script tags from SVG', () => {
    const svg = '<svg><script>alert("xss")</script></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain('<script')
  })

  it('preserves SVG elements', () => {
    const svg = '<svg><circle cx="50" cy="50" r="40" fill="red"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).toContain('circle')
    expect(result).toContain('cx="50"')
    expect(result).toContain('fill="red"')
  })

  it('removes onclick from SVG elements', () => {
    const svg = '<svg><rect onclick="alert(1)" width="100" height="100"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain('onclick')
  })
})

// ---------------------------------------------------------------------------
// encryptValue / decryptValue
// ---------------------------------------------------------------------------
const hasSubtleCrypto = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'

describe.skipIf(!hasSubtleCrypto)('encryptValue / decryptValue', () => {
  it('round-trips a string', async () => {
    const original = 'my-secret-api-key'
    const encrypted = await encryptValue(original)
    const decrypted = await decryptValue(encrypted)
    expect(decrypted).toBe(original)
  })

  it('round-trips a string with unicode', async () => {
    const original = '密钥🔑key'
    const encrypted = await encryptValue(original)
    const decrypted = await decryptValue(encrypted)
    expect(decrypted).toBe(original)
  })

  it('encryptValue returns empty string for empty input', async () => {
    expect(await encryptValue('')).toBe('')
  })

  it('encrypted output starts with enc:v2:', async () => {
    const encrypted = await encryptValue('test')
    expect(encrypted.startsWith('enc:v2:')).toBe(true)
  })

  it('decryptValue returns empty string for empty input', async () => {
    expect(await decryptValue('')).toBe('')
  })

  it('decryptValue returns empty string for invalid data', async () => {
    expect(await decryptValue('enc:v2:invalid-base64!!!')).toBe('')
  })

  it('decryptValue returns empty string for tampered ciphertext', async () => {
    const encrypted = await encryptValue('hello')
    // Tamper with the base64 payload
    const tampered = encrypted.slice(0, -2) + 'XX'
    expect(await decryptValue(tampered)).toBe('')
  })

  it('decryptValue handles legacy v1 format (non-enc:v2: returns as-is or empty)', async () => {
    // A string that doesn't start with enc:v2: or enc:v1: is returned as-is
    const result = await decryptValue('plain-text')
    expect(result).toBe('plain-text')
  })
})

// ---------------------------------------------------------------------------
// safeStorage
// ---------------------------------------------------------------------------
describe('safeStorage', () => {
  it('get returns default when key is missing', () => {
    expect(safeStorage.get('nonexistent_key', 'default')).toBe('default')
  })

  it('get returns default when key is missing (number)', () => {
    expect(safeStorage.get('nonexistent_key', 42)).toBe(42)
  })

  it('set and get round-trip a string', () => {
    safeStorage.set('test_key', 'hello')
    expect(safeStorage.get('test_key', '')).toBe('hello')
  })

  it('set and get round-trip an object', () => {
    const obj = { a: 1, b: 'two' }
    safeStorage.set('test_obj', obj)
    expect(safeStorage.get('test_obj', null)).toEqual(obj)
  })

  it('set returns boolean', () => {
    const result = safeStorage.set('test_bool', true)
    expect(typeof result).toBe('boolean')
  })

  it('set returns true on success', () => {
    expect(safeStorage.set('test_success', 'value')).toBe(true)
  })

  it('remove deletes a key', () => {
    safeStorage.set('test_remove', 'value')
    safeStorage.remove('test_remove')
    expect(safeStorage.get('test_remove', 'gone')).toBe('gone')
  })

  it('clear removes all keys', () => {
    safeStorage.set('test_clear1', 'a')
    safeStorage.set('test_clear2', 'b')
    safeStorage.clear()
    expect(safeStorage.get('test_clear1', null)).toBeNull()
    expect(safeStorage.get('test_clear2', null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// safeCopyToClipboard
// ---------------------------------------------------------------------------
describe('safeCopyToClipboard', () => {
  it('returns a boolean', async () => {
    const result = await safeCopyToClipboard('test')
    expect(typeof result).toBe('boolean')
  })
})
