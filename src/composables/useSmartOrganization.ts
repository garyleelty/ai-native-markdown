import { ref, computed, type Ref } from 'vue'
import { knowledgeIndex, type KnowledgeIndexRecord } from '@/services/knowledgeIndex'

export interface OrganizationSuggestion {
  type: 'category' | 'tag' | 'folder' | 'link'
  title: string
  description: string
  confidence: number
  action: () => Promise<void>
}

export interface NoteCategory {
  name: string
  count: number
  notes: string[]
  color: string
}

export function useSmartOrganization(currentFile: Ref<string>, content: Ref<string>) {
  const suggestions = ref<OrganizationSuggestion[]>([])
  const categories = ref<NoteCategory[]>([])
  const isAnalyzing = ref(false)

  // Analyze note content and suggest organization
  async function analyzeOrganization() {
    if (isAnalyzing.value) return
    isAnalyzing.value = true

    try {
      const allRecords = await knowledgeIndex.getAll()
      const currentRecord = allRecords.find(r => r.filePath === currentFile.value)

      if (!currentRecord) {
        suggestions.value = []
        return
      }

      const newSuggestions: OrganizationSuggestion[] = []

      // Analyze content for category suggestions
      const contentLower = content.value.toLowerCase()
      const titleLower = currentRecord.title.toLowerCase()

      // Suggest categories based on content
      const categoryPatterns = [
        { pattern: /技术|编程|代码|开发|api|sdk/i, category: '技术', color: '#7c6df2' },
        { pattern: /设计|ui|ux|界面|交互/i, category: '设计', color: '#20c4a8' },
        { pattern: /产品|需求|用户|市场/i, category: '产品', color: '#f0a030' },
        { pattern: /管理|项目|团队|流程/i, category: '管理', color: '#f06878' },
        { pattern: /学习|教程|笔记|知识/i, category: '学习', color: '#58a8f8' },
        { pattern: /会议|讨论|决策|行动/i, category: '会议', color: '#3adba0' },
        { pattern: /研究|分析|数据|报告/i, category: '研究', color: '#d0b890' },
      ]

      for (const { pattern, category, color } of categoryPatterns) {
        if (pattern.test(content.value) || pattern.test(currentRecord.title)) {
          const existing = categories.value.find(c => c.name === category)
          if (!existing) {
            newSuggestions.push({
              type: 'category',
              title: `分类到 "${category}"`,
              description: `根据内容分析，这篇笔记可能属于 "${category}" 类别`,
              confidence: 0.8,
              action: async () => {
                // In a real implementation, this would update the note's frontmatter
                console.log(`Categorizing ${currentFile.value} as ${category}`)
              },
            })
          }
        }
      }

      // Suggest tags based on content
      const existingTags = new Set(currentRecord.tags)
      const suggestedTags: string[] = []

      // Extract potential tags from content
      const tagPatterns = [
        { pattern: /#([\w一-鿿]+)/g, type: 'existing' },
        { pattern: /\b(api|sdk|ui|ux|ai|ml|devops|agile|scrum)\b/gi, type: 'technical' },
      ]

      for (const { pattern, type } of tagPatterns) {
        const matches = content.value.match(pattern)
        if (matches) {
          for (const match of matches) {
            const tag = match.replace('#', '').toLowerCase()
            if (!existingTags.has(tag) && tag.length > 2) {
              suggestedTags.push(tag)
            }
          }
        }
      }

      if (suggestedTags.length > 0) {
        newSuggestions.push({
          type: 'tag',
          title: `添加标签`,
          description: `建议添加标签: ${suggestedTags.slice(0, 3).join(', ')}`,
          confidence: 0.7,
          action: async () => {
            console.log(`Adding tags to ${currentFile.value}:`, suggestedTags)
          },
        })
      }

      // Suggest folder organization
      const pathParts = currentFile.value.split('/')
      if (pathParts.length > 2) {
        const currentFolder = pathParts[pathParts.length - 2]
        const suggestedFolder = suggestFolder(content.value, currentRecord.title)

        if (suggestedFolder && suggestedFolder !== currentFolder) {
          newSuggestions.push({
            type: 'folder',
            title: `移动到 "${suggestedFolder}"`,
            description: `根据内容，建议将笔记移动到 "${suggestedFolder}" 文件夹`,
            confidence: 0.6,
            action: async () => {
              console.log(`Moving ${currentFile.value} to ${suggestedFolder}`)
            },
          })
        }
      }

      // Suggest links to related notes
      const relatedNotes = findRelatedNotes(allRecords, currentRecord)
      if (relatedNotes.length > 0) {
        newSuggestions.push({
          type: 'link',
          title: `链接到相关笔记`,
          description: `发现 ${relatedNotes.length} 篇相关笔记，建议添加链接`,
          confidence: 0.9,
          action: async () => {
            console.log(`Adding links to ${currentFile.value}:`, relatedNotes)
          },
        })
      }

      suggestions.value = newSuggestions

      // Update categories
      updateCategories(allRecords)
    } finally {
      isAnalyzing.value = false
    }
  }

  // Suggest folder based on content
  function suggestFolder(content: string, title: string): string | null {
    const contentLower = content.toLowerCase()
    const titleLower = title.toLowerCase()

    const folderPatterns = [
      { pattern: /技术|编程|代码|开发|api|sdk/i, folder: '技术' },
      { pattern: /设计|ui|ux|界面|交互/i, folder: '设计' },
      { pattern: /产品|需求|用户|市场/i, folder: '产品' },
      { pattern: /管理|项目|团队|流程/i, folder: '管理' },
      { pattern: /学习|教程|笔记|知识/i, folder: '学习' },
      { pattern: /会议|讨论|决策|行动/i, folder: '会议' },
      { pattern: /研究|分析|数据|报告/i, folder: '研究' },
    ]

    for (const { pattern, folder } of folderPatterns) {
      if (pattern.test(content) || pattern.test(title)) {
        return folder
      }
    }

    return null
  }

  // Find related notes
  function findRelatedNotes(allRecords: KnowledgeIndexRecord[], currentRecord: KnowledgeIndexRecord): string[] {
    const related: string[] = []
    const currentContent = currentRecord.searchableText.toLowerCase()
    const currentTags = new Set(currentRecord.tags.map(t => t.toLowerCase()))

    for (const record of allRecords) {
      if (record.filePath === currentRecord.filePath) continue

      let relevance = 0

      // Check for tag matches
      for (const tag of record.tags) {
        if (currentTags.has(tag.toLowerCase())) {
          relevance += 10
        }
      }

      // Check for content similarity
      const recordContent = record.searchableText.toLowerCase()
      const words = currentContent.split(/\s+/).filter(w => w.length > 3)
      for (const word of words) {
        if (recordContent.includes(word)) {
          relevance += 1
        }
      }

      if (relevance > 20) {
        related.push(record.filePath)
      }
    }

    return related.slice(0, 5)
  }

  // Update categories based on all records
  function updateCategories(allRecords: KnowledgeIndexRecord[]) {
    const categoryMap = new Map<string, { count: number; notes: string[]; color: string }>()

    const categoryPatterns = [
      { pattern: /技术|编程|代码|开发|api|sdk/i, category: '技术', color: '#7c6df2' },
      { pattern: /设计|ui|ux|界面|交互/i, category: '设计', color: '#20c4a8' },
      { pattern: /产品|需求|用户|市场/i, category: '产品', color: '#f0a030' },
      { pattern: /管理|项目|团队|流程/i, category: '管理', color: '#f06878' },
      { pattern: /学习|教程|笔记|知识/i, category: '学习', color: '#58a8f8' },
      { pattern: /会议|讨论|决策|行动/i, category: '会议', color: '#3adba0' },
      { pattern: /研究|分析|数据|报告/i, category: '研究', color: '#d0b890' },
    ]

    for (const record of allRecords) {
      const content = record.searchableText.toLowerCase()
      const title = record.title.toLowerCase()

      for (const { pattern, category, color } of categoryPatterns) {
        if (pattern.test(content) || pattern.test(title)) {
          const existing = categoryMap.get(category)
          if (existing) {
            existing.count++
            existing.notes.push(record.filePath)
          } else {
            categoryMap.set(category, { count: 1, notes: [record.filePath], color })
          }
        }
      }
    }

    categories.value = Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      notes: data.notes,
      color: data.color,
    })).sort((a, b) => b.count - a.count)
  }

  return {
    suggestions,
    categories,
    isAnalyzing,
    analyzeOrganization,
  }
}
