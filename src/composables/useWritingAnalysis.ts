import { ref, computed, watch, type Ref } from 'vue'

export interface WritingMetrics {
  wordCount: number
  charCount: number
  sentenceCount: number
  paragraphCount: number
  avgWordsPerSentence: number
  avgSentencesPerParagraph: number
  readabilityScore: number
  readabilityLevel: string
  fleschKincaidGrade: number
  passiveVoicePercentage: number
  adverbPercentage: number
  complexWordPercentage: number
}

export interface WritingSuggestion {
  type: 'grammar' | 'style' | 'clarity' | 'engagement'
  severity: 'info' | 'warning' | 'suggestion'
  message: string
  line?: number
  context?: string
}

export function useWritingAnalysis(content: Ref<string>) {
  const isAnalyzing = ref(false)
  const metrics = ref<WritingMetrics | null>(null)
  const suggestions = ref<WritingSuggestion[]>([])
  const lastAnalyzedContent = ref('')

  // Simple word count
  const wordCount = computed(() => {
    const text = content.value.trim()
    if (!text) return 0
    // Count Chinese characters and English words
    const chineseChars = (text.match(/[一-鿿]/g) || []).length
    const englishWords = text.replace(/[一-鿿]/g, '').split(/\s+/).filter(w => w.length > 0).length
    return chineseChars + englishWords
  })

  // Character count
  const charCount = computed(() => content.value.length)

  // Sentence count
  const sentenceCount = computed(() => {
    const text = content.value.trim()
    if (!text) return 0
    // Count sentences ending with . ! ? or Chinese punctuation
    const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0)
    return sentences.length
  })

  // Paragraph count
  const paragraphCount = computed(() => {
    const text = content.value.trim()
    if (!text) return 0
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length
  })

  // Average words per sentence
  const avgWordsPerSentence = computed(() => {
    if (sentenceCount.value === 0) return 0
    return Math.round(wordCount.value / sentenceCount.value)
  })

  // Average sentences per paragraph
  const avgSentencesPerParagraph = computed(() => {
    if (paragraphCount.value === 0) return 0
    return Math.round(sentenceCount.value / paragraphCount.value)
  })

  // Simple readability score (Flesch Reading Ease approximation)
  const readabilityScore = computed(() => {
    if (sentenceCount.value === 0 || wordCount.value === 0) return 0

    // Simplified calculation
    const avgSentenceLength = wordCount.value / sentenceCount.value
    const avgSyllables = estimateAvgSyllables(content.value)

    // Flesch Reading Ease formula
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllables)
    return Math.max(0, Math.min(100, Math.round(score)))
  })

  // Readability level
  const readabilityLevel = computed(() => {
    const score = readabilityScore.value
    if (score >= 90) return '非常容易'
    if (score >= 80) return '容易'
    if (score >= 70) return '较容易'
    if (score >= 60) return '标准'
    if (score >= 50) return '较难'
    if (score >= 30) return '难'
    return '非常难'
  })

  // Flesch-Kincaid Grade Level
  const fleschKincaidGrade = computed(() => {
    if (sentenceCount.value === 0 || wordCount.value === 0) return 0

    const avgSentenceLength = wordCount.value / sentenceCount.value
    const avgSyllables = estimateAvgSyllables(content.value)

    const grade = (0.39 * avgSentenceLength) + (11.8 * avgSyllables) - 15.59
    return Math.max(0, Math.round(grade * 10) / 10)
  })

  // Estimate average syllables per word
  function estimateAvgSyllables(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0)
    if (words.length === 0) return 0

    let totalSyllables = 0
    for (const word of words) {
      // Simple syllable estimation
      const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '')
      if (cleanWord.length === 0) continue

      let syllables = 0
      const vowels = 'aeiouy'
      let prevVowel = false

      for (let i = 0; i < cleanWord.length; i++) {
        const isVowel = vowels.includes(cleanWord[i])
        if (isVowel && !prevVowel) {
          syllables++
        }
        prevVowel = isVowel
      }

      // Adjust for silent e
      if (cleanWord.endsWith('e') && syllables > 1) {
        syllables--
      }

      // At least one syllable per word
      totalSyllables += Math.max(1, syllables)
    }

    return totalSyllables / words.length
  }

  // Detect passive voice (simplified)
  const passiveVoicePercentage = computed(() => {
    const text = content.value
    if (!text) return 0

    const passivePatterns = [
      /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi,
      /\b(is|are|was|were|be|been|being)\s+\w+en\b/gi,
      /\b被\s*\w+/g,
      /\b由\s*\w+/g,
    ]

    let passiveCount = 0
    for (const pattern of passivePatterns) {
      const matches = text.match(pattern)
      if (matches) passiveCount += matches.length
    }

    const totalVerbs = (text.match(/\b(is|are|was|were|be|been|being|的|了|着|过)\b/g) || []).length
    if (totalVerbs === 0) return 0

    return Math.min(100, Math.round((passiveCount / totalVerbs) * 100))
  })

  // Detect adverbs
  const adverbPercentage = computed(() => {
    const text = content.value
    if (!text) return 0

    const adverbPatterns = [
      /\b\w+ly\b/gi,
      /\b地\s/g,
    ]

    let adverbCount = 0
    for (const pattern of adverbPatterns) {
      const matches = text.match(pattern)
      if (matches) adverbCount += matches.length
    }

    const totalWords = wordCount.value
    if (totalWords === 0) return 0

    return Math.min(100, Math.round((adverbCount / totalWords) * 100))
  })

  // Detect complex words
  const complexWordPercentage = computed(() => {
    const text = content.value
    if (!text) return 0

    const words = text.split(/\s+/).filter(w => w.length > 0)
    let complexCount = 0

    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '')
      if (cleanWord.length > 0) {
        const syllables = estimateAvgSyllables(word)
        if (syllables >= 3) {
          complexCount++
        }
      }
    }

    if (words.length === 0) return 0
    return Math.min(100, Math.round((complexCount / words.length) * 100))
  })

  // Generate writing suggestions
  function generateSuggestions(): WritingSuggestion[] {
    const result: WritingSuggestion[] = []
    const text = content.value

    if (!text.trim()) return result

    // Check for long sentences
    const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0)
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      const words = sentence.split(/\s+/).length
      if (words > 30) {
        result.push({
          type: 'clarity',
          severity: 'warning',
          message: `第 ${i + 1} 句过长（${words} 词），建议拆分`,
          line: findLineNumber(text, sentence),
          context: sentence.substring(0, 50) + '...'
        })
      }
    }

    // Check for passive voice overuse
    if (passiveVoicePercentage.value > 20) {
      result.push({
        type: 'style',
        severity: 'suggestion',
        message: `被动语态使用过多（${passiveVoicePercentage.value}%），建议增加主动语态`,
      })
    }

    // Check for adverb overuse
    if (adverbPercentage.value > 10) {
      result.push({
        type: 'style',
        severity: 'suggestion',
        message: `副词使用过多（${adverbPercentage.value}%），建议使用更精确的动词`,
      })
    }

    // Check for complex word overuse
    if (complexWordPercentage.value > 15) {
      result.push({
        type: 'engagement',
        severity: 'suggestion',
        message: `复杂词汇过多（${complexWordPercentage.value}%），建议使用更简单的词汇`,
      })
    }

    // Check for very short paragraphs
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim()
      const words = paragraph.split(/\s+/).length
      if (words < 10 && paragraphs.length > 1) {
        result.push({
          type: 'engagement',
          severity: 'info',
          message: `第 ${i + 1} 段过短（${words} 词），考虑扩展或合并`,
          line: findLineNumber(text, paragraph),
        })
      }
    }

    // Check for repeated words
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const wordFreq: Record<string, number> = {}
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    }
    for (const [word, count] of Object.entries(wordFreq)) {
      if (count > 5) {
        result.push({
          type: 'style',
          severity: 'info',
          message: `"${word}" 重复使用 ${count} 次，考虑使用同义词`,
        })
      }
    }

    return result
  }

  // Find line number of text
  function findLineNumber(fullText: string, searchText: string): number {
    const index = fullText.indexOf(searchText)
    if (index === -1) return 0
    return fullText.substring(0, index).split('\n').length
  }

  // Analyze content
  async function analyze() {
    if (isAnalyzing.value) return
    if (content.value === lastAnalyzedContent.value) return

    isAnalyzing.value = true
    lastAnalyzedContent.value = content.value

    try {
      // Update metrics
      metrics.value = {
        wordCount: wordCount.value,
        charCount: charCount.value,
        sentenceCount: sentenceCount.value,
        paragraphCount: paragraphCount.value,
        avgWordsPerSentence: avgWordsPerSentence.value,
        avgSentencesPerParagraph: avgSentencesPerParagraph.value,
        readabilityScore: readabilityScore.value,
        readabilityLevel: readabilityLevel.value,
        fleschKincaidGrade: fleschKincaidGrade.value,
        passiveVoicePercentage: passiveVoicePercentage.value,
        adverbPercentage: adverbPercentage.value,
        complexWordPercentage: complexWordPercentage.value,
      }

      // Generate suggestions
      suggestions.value = generateSuggestions()
    } finally {
      isAnalyzing.value = false
    }
  }

  // Auto-analyze on content change (debounced)
  let analyzeTimer: ReturnType<typeof setTimeout> | null = null
  watch(content, () => {
    if (analyzeTimer) clearTimeout(analyzeTimer)
    analyzeTimer = setTimeout(analyze, 2000)
  }, { immediate: false })

  return {
    isAnalyzing,
    metrics,
    suggestions,
    wordCount,
    charCount,
    sentenceCount,
    paragraphCount,
    readabilityScore,
    readabilityLevel,
    analyze,
  }
}
