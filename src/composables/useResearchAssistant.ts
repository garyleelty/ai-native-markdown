import { ref, computed, watch, type Ref } from 'vue'
import { knowledgeIndex, type KnowledgeReference } from '@/services/knowledgeIndex'

export interface ResearchSuggestion {
  type: 'related' | 'background' | 'contradiction' | 'extension'
  title: string
  path: string
  excerpt: string
  relevance: number
  reason: string
}

export interface ResearchContext {
  currentTopic: string
  relatedTopics: string[]
  keyConcepts: string[]
  gaps: string[]
}

export function useResearchAssistant(currentFile: Ref<string>, content: Ref<string>) {
  const suggestions = ref<ResearchSuggestion[]>([])
  const researchContext = ref<ResearchContext | null>(null)
  const isAnalyzing = ref(false)
  const lastAnalyzedContent = ref('')

  // Extract key concepts from content
  function extractKeyConcepts(text: string): string[] {
    const concepts: string[] = []

    // Extract headings
    const headingMatches = text.match(/^#{1,6}\s+(.+)$/gm)
    if (headingMatches) {
      concepts.push(...headingMatches.map(h => h.replace(/^#{1,6}\s+/, '').trim()))
    }

    // Extract bold text
    const boldMatches = text.match(/\*\*([^*]+)\*\*/g)
    if (boldMatches) {
      concepts.push(...boldMatches.map(b => b.replace(/\*\*/g, '').trim()))
    }

    // Extract tags
    const tagMatches = text.match(/#[\w一-鿿]+/g)
    if (tagMatches) {
      concepts.push(...tagMatches.map(t => t.slice(1)))
    }

    // Extract wiki links
    const linkMatches = text.match(/\[\[([^\]]+)\]\]/g)
    if (linkMatches) {
      concepts.push(...linkMatches.map(l => l.replace(/[\[\]]/g, '').trim()))
    }

    // Deduplicate
    return [...new Set(concepts)].slice(0, 20)
  }

  // Extract topic from content
  function extractTopic(text: string): string {
    // Try to find title
    const titleMatch = text.match(/^#\s+(.+)$/m)
    if (titleMatch) {
      return titleMatch[1].trim()
    }

    // Use first heading
    const headingMatch = text.match(/^#{1,3}\s+(.+)$/m)
    if (headingMatch) {
      return headingMatch[1].trim()
    }

    // Use first line
    const firstLine = text.split('\n')[0]?.trim()
    if (firstLine && firstLine.length > 0) {
      return firstLine.substring(0, 50)
    }

    return '未知主题'
  }

  // Find related notes
  async function findRelatedNotes(concepts: string[], currentPath: string): Promise<ResearchSuggestion[]> {
    const results: ResearchSuggestion[] = []
    const allRecords = await knowledgeIndex.getAll()

    for (const record of allRecords) {
      if (record.filePath === currentPath) continue

      let relevance = 0
      const reasons: string[] = []

      // Check for concept matches in title
      for (const concept of concepts) {
        if (record.title.toLowerCase().includes(concept.toLowerCase())) {
          relevance += 20
          reasons.push(`标题包含 "${concept}"`)
        }
      }

      // Check for concept matches in tags
      for (const tag of record.tags) {
        for (const concept of concepts) {
          if (tag.toLowerCase().includes(concept.toLowerCase())) {
            relevance += 15
            reasons.push(`标签 "${tag}" 匹配`)
          }
        }
      }

      // Check for concept matches in content
      const contentLower = record.searchableText.toLowerCase()
      for (const concept of concepts) {
        if (contentLower.includes(concept.toLowerCase())) {
          relevance += 5
          if (!reasons.some(r => r.includes('内容'))) {
            reasons.push('内容相关')
          }
        }
      }

      // Check for backlinks
      if (record.links.some(link => link.includes(currentPath))) {
        relevance += 30
        reasons.push('链接到当前笔记')
      }

      if (relevance > 10) {
        // Generate excerpt
        const excerpt = generateExcerpt(record.searchableText, concepts)

        results.push({
          type: 'related',
          title: record.title,
          path: record.filePath,
          excerpt,
          relevance,
          reason: reasons.slice(0, 2).join('; '),
        })
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance)

    return results.slice(0, 10)
  }

  // Generate excerpt with concept highlights
  function generateExcerpt(content: string, concepts: string[]): string {
    const sentences = content.split(/[.!?。！？]+/).filter(s => s.trim().length > 0)

    // Find most relevant sentence
    let bestSentence = ''
    let bestScore = 0

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase()
      let score = 0

      for (const concept of concepts) {
        if (sentenceLower.includes(concept.toLowerCase())) {
          score += 10
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestSentence = sentence.trim()
      }
    }

    if (bestSentence && bestScore > 0) {
      return bestSentence.length > 150 ? bestSentence.substring(0, 150) + '...' : bestSentence
    }

    return content.substring(0, 150) + '...'
  }

  // Analyze research context
  async function analyzeResearchContext() {
    if (isAnalyzing.value) return
    if (content.value === lastAnalyzedContent.value) return

    isAnalyzing.value = true
    lastAnalyzedContent.value = content.value

    try {
      const keyConcepts = extractKeyConcepts(content.value)
      const currentTopic = extractTopic(content.value)

      // Find related notes
      const relatedNotes = await findRelatedNotes(keyConcepts, currentFile.value)

      // Identify gaps
      const gaps: string[] = []
      const existingTopics = new Set(relatedNotes.map(n => n.title.toLowerCase()))

      for (const concept of keyConcepts) {
        if (!existingTopics.has(concept.toLowerCase())) {
          gaps.push(concept)
        }
      }

      researchContext.value = {
        currentTopic,
        relatedTopics: relatedNotes.map(n => n.title),
        keyConcepts,
        gaps: gaps.slice(0, 5),
      }

      suggestions.value = relatedNotes
    } finally {
      isAnalyzing.value = false
    }
  }

  // Auto-analyze on content change (debounced)
  let analyzeTimer: ReturnType<typeof setTimeout> | null = null
  watch([currentFile, content], () => {
    if (analyzeTimer) clearTimeout(analyzeTimer)
    analyzeTimer = setTimeout(analyzeResearchContext, 3000)
  }, { immediate: false })

  return {
    suggestions,
    researchContext,
    isAnalyzing,
    analyzeResearchContext,
  }
}
