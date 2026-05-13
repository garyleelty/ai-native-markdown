/**
 * 安全工具函数
 * 提供 XSS 防护、输入验证、内容净化等功能
 */

// XSS 防护：转义 HTML 特殊字符
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 验证文件路径，防止路径遍历攻击
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

// 验证文件名
export function isValidFileName(name: string): boolean {
  // 不允许空文件名
  if (!name || name.trim().length === 0) return false
  // 不允许包含路径分隔符
  if (name.includes('/') || name.includes('\\')) return false
  // 不允许以 . 开头（隐藏文件）
  if (name.startsWith('.')) return false
  // 不允许控制字符
  if (/[\x00-\x1f\x7f]/.test(name)) return false
  // 最大长度限制
  if (name.length > 255) return false
  return true
}

// 验证 Markdown 内容，防止恶意脚本
export function sanitizeMarkdown(content: string): string {
  // 移除 script 标签
  let sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  // 移除事件处理器属性
  sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
  // 移除 javascript: 伪协议
  sanitized = sanitized.replace(/javascript:/gi, '')
  // 移除 data: URI（可能包含脚本）
  sanitized = sanitized.replace(/data:text\/html[^\s]*/gi, '')
  return sanitized
}

// 安全的 localStorage 操作
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
      // 存储空间不足或其他错误
      return false
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // 忽略错误
    }
  },

  clear(): void {
    try {
      localStorage.clear()
    } catch {
      // 忽略错误
    }
  },
}

// 安全的剪贴板操作
export async function safeCopyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // 降级方案
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
