import { ref, computed, type Ref } from 'vue'
import { knowledgeIndex, type KnowledgeIndexRecord } from '@/services/knowledgeIndex'

export interface SynthesisResult {
  topic: string
  summary: string
  keyPoints: string[]
  sources: Array<{
    path: string
    title: string
    relevance: number
    excerpt: string
  }>
  connections: Array<{
    from: string
    to: string
    relationship: string
  }>
}

export interface KnowledgeCluster {
  name: string
  notes: string[]
  themes: string[]
  strength: number
}

export function useKnowledgeSynthesis() {
  const isSynthesizing = ref(false)
  const synthesisResult = ref<SynthesisResult | null>(null)
  const clusters = ref<KnowledgeCluster[]>([])
  const error = ref<string | null>(null)

  // Synthesize knowledge on a topic
  async function synthesize(topic: string): Promise<SynthesisResult> {
    if (isSynthesizing.value) {
      throw new Error('Synthesis already in progress')
    }

    isSynthesizing.value = true
    error.value = null

    try {
      const allRecords = await knowledgeIndex.getAll()

      // Find relevant notes
      const relevantNotes = findRelevantNotes(allRecords, topic)

      // Extract key points
      const keyPoints = extractKeyPoints(relevantNotes, topic)

      // Find connections
      const connections = findConnections(relevantNotes)

      // Generate summary
      const summary = generateSummary(relevantNotes, topic, keyPoints)

      const result: SynthesisResult = {
        topic,
        summary,
        keyPoints,
        sources: relevantNotes.map(note => ({
          path: note.filePath,
          title: note.title,
          relevance: calculateRelevance(note, topic),
          excerpt: generateExcerpt(note.searchableText, topic),
        })),
        connections,
      }

      synthesisResult.value = result
      return result
    } catch (e: any) {
      error.value = e.message || 'Synthesis failed'
      throw e
    } finally {
      isSynthesizing.value = false
    }
  }

  // Find relevant notes for a topic
  function findRelevantNotes(records: KnowledgeIndexRecord[], topic: string): KnowledgeIndexRecord[] {
    const topicLower = topic.toLowerCase()
    const topicWords = topicLower.split(/\s+/).filter(w => w.length > 2)

    const scored = records.map(record => {
      let score = 0
      const titleLower = record.title.toLowerCase()
      const contentLower = record.searchableText.toLowerCase()

      // Title match
      if (titleLower.includes(topicLower)) {
        score += 100
      }

      // Tag match
      for (const tag of record.tags) {
        if (tag.toLowerCase().includes(topicLower) || topicLower.includes(tag.toLowerCase())) {
          score += 50
        }
      }

      // Content keyword match
      for (const word of topicWords) {
        if (contentLower.includes(word)) {
          score += 10
        }
      }

      // Frontmatter match
      for (const [key, value] of Object.entries(record.frontmatter)) {
        const valueStr = String(value).toLowerCase()
        if (valueStr.includes(topicLower) || topicLower.includes(valueStr)) {
          score += 30
        }
      }

      return { record, score }
    })

    return scored
      .filter(item => item.score > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.record)
  }

  // Calculate relevance score
  function calculateRelevance(record: KnowledgeIndexRecord, topic: string): number {
    const topicLower = topic.toLowerCase()
    const titleLower = record.title.toLowerCase()
    const contentLower = record.searchableText.toLowerCase()

    let score = 0

    if (titleLower.includes(topicLower)) score += 50
    if (contentLower.includes(topicLower)) score += 30

    for (const tag of record.tags) {
      if (tag.toLowerCase().includes(topicLower)) score += 20
    }

    return Math.min(100, score)
  }

  // Extract key points from notes
  function extractKeyPoints(notes: KnowledgeIndexRecord[], topic: string): string[] {
    const keyPoints: string[] = []
    const topicLower = topic.toLowerCase()

    for (const note of notes) {
      const content = note.searchableText
      const sentences = content.split(/[.!?。！？]+/).filter(s => s.trim().length > 10)

      for (const sentence of sentences) {
        const sentenceLower = sentence.toLowerCase()
        if (sentenceLower.includes(topicLower) || topicLower.split(/\s+/).some(w => sentenceLower.includes(w))) {
          const trimmed = sentence.trim()
          if (trimmed.length > 10 && trimmed.length < 200) {
            keyPoints.push(trimmed)
          }
        }
      }
    }

    // Deduplicate and limit
    const unique = [...new Set(keyPoints)]
    return unique.slice(0, 10)
  }

  // Find connections between notes
  function findConnections(notes: KnowledgeIndexRecord[]): Array<{ from: string; to: string; relationship: string }> {
    const connections: Array<{ from: string; to: string; relationship: string }> = []

    for (const note of notes) {
      // Check for wiki links
      for (const link of note.links) {
        const linkedNote = notes.find(n => n.title === link || n.filePath.includes(link))
        if (linkedNote) {
          connections.push({
            from: note.title,
            to: linkedNote.title,
            relationship: '链接',
          })
        }
      }

      // Check for shared tags
      for (const otherNote of notes) {
        if (note.filePath === otherNote.filePath) continue

        const sharedTags = note.tags.filter(tag => otherNote.tags.includes(tag))
        if (sharedTags.length > 0) {
          connections.push({
            from: note.title,
            to: otherNote.title,
            relationship: `共享标签: ${sharedTags.join(', ')}`,
          })
        }
      }
    }

    // Deduplicate
    const unique = connections.filter((conn, index, self) =>
      index === self.findIndex(c => c.from === conn.from && c.to === conn.to)
    )

    return unique.slice(0, 20)
  }

  // Generate summary
  function generateSummary(notes: KnowledgeIndexRecord[], topic: string, keyPoints: string[]): string {
    if (notes.length === 0) {
      return `未找到关于 "${topic}" 的相关笔记。`
    }

    let summary = `关于 "${topic}" 的知识综合：\n\n`
    summary += `共找到 ${notes.length} 篇相关笔记。\n\n`

    if (keyPoints.length > 0) {
      summary += `关键要点：\n`
      for (let i = 0; i < Math.min(5, keyPoints.length); i++) {
        summary += `${i + 1}. ${keyPoints[i]}\n`
      }
      summary += '\n'
    }

    summary += `主要来源：\n`
    for (const note of notes.slice(0, 3)) {
      summary += `- ${note.title}\n`
    }

    return summary
  }

  // Generate excerpt
  function generateExcerpt(content: string, topic: string): string {
    const topicLower = topic.toLowerCase()
    const sentences = content.split(/[.!?。！？]+/).filter(s => s.trim().length > 10)

    // Find most relevant sentence
    let bestSentence = ''
    let bestScore = 0

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase()
      let score = 0

      if (sentenceLower.includes(topicLower)) score += 50
      for (const word of topicLower.split(/\s+/)) {
        if (sentenceLower.includes(word)) score += 10
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

  // Identify knowledge clusters
  async function identifyClusters(): Promise<KnowledgeCluster[]> {
    const allRecords = await knowledgeIndex.getAll()

    // Group by tags
    const tagGroups = new Map<string, string[]>()
    for (const record of allRecords) {
      for (const tag of record.tags) {
        const existing = tagGroups.get(tag) || []
        existing.push(record.filePath)
        tagGroups.set(tag, existing)
      }
    }

    // Create clusters
    const clusters: KnowledgeCluster[] = []
    for (const [tag, notes] of tagGroups) {
      if (notes.length >= 2) {
        clusters.push({
          name: tag,
          notes,
          themes: [tag],
          strength: notes.length / allRecords.length,
        })
      }
    }

    // Sort by strength
    clusters.sort((a, b) => b.strength - a.strength)

    return clusters.slice(0, 10)
  }

  return {
    isSynthesizing,
    synthesisResult,
    clusters,
    error,
    synthesize,
    identifyClusters,
  }
}
