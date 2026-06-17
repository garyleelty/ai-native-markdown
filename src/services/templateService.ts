import { safeStorage } from '@/utils/security'

export interface TemplateEntry {
  id: string
  name: string
  content: string
  builtIn: boolean
}

export const TEMPLATES_STORAGE_KEY = 'ai-markdown:templates'
const MAX_USER_TEMPLATES = 50

function generateId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const builtInTemplates: TemplateEntry[] = [
  { id: 'blank', name: '空白文档', content: '', builtIn: true },
  {
    id: 'blog', name: '博客文章', content: `# 标题\n\n> 一句话描述\n\n## 背景\n\n## 正文\n\n### 要点一\n\n### 要点二\n\n## 总结\n\n---\n\n*感谢阅读！*`, builtIn: true,
  },
  {
    id: 'readme', name: 'README', content: `# 项目名称\n\n简短描述\n\n## 功能特性\n\n- 特性一\n- 特性二\n- 特性三\n\n## 快速开始\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## 使用方法\n\n## 配置\n\n## 贡献\n\n## 许可证\n\nMIT`, builtIn: true,
  },
  {
    id: 'meeting', name: '会议纪要', content: `# 会议纪要\n\n**日期**: {{date}}\n**参与者**: \n**主题**: \n\n## 议题\n\n### 议题一\n\n- 讨论:\n- 决定:\n\n### 议题二\n\n- 讨论:\n- 决定:\n\n## 行动项\n\n| 任务 | 负责人 | 截止日期 |\n|------|--------|----------|\n|      |        |          |\n\n## 下次会议\n\n- 时间:\n- 议题:`, builtIn: true,
  },
  {
    id: 'weekly', name: '周报', content: `# 周报 {{week}}\n\n## 本周完成\n\n1. \n2. \n3. \n\n## 进行中\n\n1. \n2. \n\n## 下周计划\n\n1. \n2. \n3. \n\n## 风险与问题\n\n- \n\n## 学习与反思\n\n`, builtIn: true,
  },
  {
    id: 'api', name: 'API 文档', content: `# API 文档\n\n## 接口名称\n\n**URL**: \`/api/endpoint\`\n**方法**: \`GET/POST\`\n\n### 请求参数\n\n| 参数 | 类型 | 必填 | 描述 |\n|------|------|------|------|\n|      |      |      |      |\n\n### 响应\n\n\`\`\`json\n{\n  "code": 200,\n  "data": {},\n  "message": "success"\n}\n\`\`\`\n\n### 错误码\n\n| 错误码 | 描述 |\n|--------|------|\n|        |      |`, builtIn: true,
  },
  {
    id: 'tutorial', name: '教程', content: `# 教程标题\n\n## 前置条件\n\n- \n\n## 步骤一：\n\n1. \n2. \n3. \n\n## 步骤二：\n\n1. \n2. \n\n## 步骤三：\n\n1. \n2. \n\n## 常见问题\n\n### Q1:\n\nA: \n\n## 总结\n\n恭喜完成！`, builtIn: true,
  },
  {
    id: 'chat-export', name: '对话导出', content: `# 对话记录\n\n**日期**: {{date}}\n**模型**: \n\n---\n\n## 用户\n\n\n\n## 助手\n\n\n\n---\n\n## 用户\n\n\n\n## 助手\n\n`, builtIn: true,
  },
]

function normalizeUserTemplates(value: unknown): TemplateEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const normalized: TemplateEntry[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const id = typeof (item as TemplateEntry).id === 'string' ? (item as TemplateEntry).id : ''
    if (!id || seen.has(id)) continue
    const name = typeof (item as TemplateEntry).name === 'string' ? (item as TemplateEntry).name : ''
    if (!name) continue
    const content = typeof (item as TemplateEntry).content === 'string' ? (item as TemplateEntry).content : ''
    seen.add(id)
    normalized.push({ id, name, content, builtIn: false })
  }
  return normalized
}

function loadUserTemplates(): TemplateEntry[] {
  return normalizeUserTemplates(safeStorage.get<unknown>(TEMPLATES_STORAGE_KEY, []))
}

function persistUserTemplates(templates: TemplateEntry[]): void {
  safeStorage.set(TEMPLATES_STORAGE_KEY, templates)
}

export const templateService = {
  getAllTemplates(): TemplateEntry[] {
    return [...builtInTemplates, ...loadUserTemplates()]
  },

  getUserTemplates(): TemplateEntry[] {
    return loadUserTemplates()
  },

  saveUserTemplate(template: { id?: string; name: string; content: string }): TemplateEntry {
    if (!template.name.trim()) {
      throw new Error('Template name cannot be empty')
    }
    const users = loadUserTemplates()
    if (template.id) {
      const idx = users.findIndex(t => t.id === template.id)
      if (idx !== -1) {
        users[idx] = { ...users[idx], name: template.name, content: template.content }
        persistUserTemplates(users)
        return users[idx]
      }
    }
    if (users.length >= MAX_USER_TEMPLATES) {
      throw new Error(`Cannot create more than ${MAX_USER_TEMPLATES} user templates`)
    }
    const entry: TemplateEntry = { id: generateId(), name: template.name, content: template.content, builtIn: false }
    users.push(entry)
    persistUserTemplates(users)
    return entry
  },

  deleteUserTemplate(id: string): boolean {
    const users = loadUserTemplates()
    const filtered = users.filter(t => t.id !== id)
    if (filtered.length === users.length) return false
    persistUserTemplates(filtered)
    return true
  },
}
