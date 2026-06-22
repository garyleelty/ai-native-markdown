import { ref, computed, watch, type Ref } from 'vue'

export interface WritingTip {
  type: 'grammar' | 'style' | 'clarity' | 'engagement' | 'structure'
  severity: 'info' | 'warning' | 'suggestion'
  message: string
  explanation: string
  example?: string
  line?: number
}

export interface WritingScore {
  overall: number
  grammar: number
  style: number
  clarity: number
  engagement: number
  structure: number
}

export function useWritingCoach(content: Ref<string>) {
  const tips = ref<WritingTip[]>([])
  const score = ref<WritingScore | null>(null)
  const isAnalyzing = ref(false)
  const lastAnalyzedContent = ref('')

  // Analyze writing quality
  async function analyzeWriting() {
    if (isAnalyzing.value) return
    if (content.value === lastAnalyzedContent.value) return

    isAnalyzing.value = true
    lastAnalyzedContent.value = content.value

    try {
      const text = content.value
      if (!text.trim()) {
        tips.value = []
        score.value = null
        return
      }

      const newTips: WritingTip[] = []

      // Grammar checks
      newTips.push(...checkGrammar(text))

      // Style checks
      newTips.push(...checkStyle(text))

      // Clarity checks
      newTips.push(...checkClarity(text))

      // Engagement checks
      newTips.push(...checkEngagement(text))

      // Structure checks
      newTips.push(...checkStructure(text))

      tips.value = newTips

      // Calculate scores
      score.value = calculateScore(text, newTips)
    } finally {
      isAnalyzing.value = false
    }
  }

  // Grammar checks
  function checkGrammar(text: string): WritingTip[] {
    const tips: WritingTip[] = []

    // Check for common grammar issues
    const grammarPatterns = [
      {
        pattern: /\b(its|it's)\b/gi,
        check: (match: string, context: string) => {
          if (match.toLowerCase() === "it's" && !context.includes('it is') && !context.includes('it has')) {
            return {
              type: 'grammar' as const,
              severity: 'warning' as const,
              message: '检查 "it\'s" 的使用',
              explanation: '"it\'s" 是 "it is" 或 "it has" 的缩写。如果表示所有格，应该用 "its"。',
              example: '正确: The cat licked its paw. / It\'s raining.',
            }
          }
          return null
        },
      },
      {
        pattern: /\b(there|their|they're)\b/gi,
        check: (match: string, context: string) => {
          // Simple check - in real implementation, use NLP
          return null
        },
      },
      {
        pattern: /\b(a|an)\s+([aeiou])/gi,
        check: (match: string, context: string) => {
          const article = match.split(/\s+/)[0].toLowerCase()
          const nextWord = match.split(/\s+/)[1]?.toLowerCase()
          if (article === 'a' && nextWord && /^[aeiou]/.test(nextWord)) {
            return {
              type: 'grammar' as const,
              severity: 'info' as const,
              message: '冠词使用',
              explanation: `以元音开头的单词前应该用 "an" 而不是 "a"。`,
              example: `正确: an ${nextWord}`,
            }
          }
          return null
        },
      },
    ]

    for (const { pattern, check } of grammarPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        for (const match of matches) {
          const context = text.substring(Math.max(0, text.indexOf(match) - 50), text.indexOf(match) + match.length + 50)
          const tip = check(match, context)
          if (tip) {
            tips.push(tip)
          }
        }
      }
    }

    return tips
  }

  // Style checks
  function checkStyle(text: string): WritingTip[] {
    const tips: WritingTip[] = []

    // Check for passive voice overuse
    const passivePatterns = [
      /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi,
      /\b(is|are|was|were|be|been|being)\s+\w+en\b/gi,
    ]

    let passiveCount = 0
    for (const pattern of passivePatterns) {
      const matches = text.match(pattern)
      if (matches) passiveCount += matches.length
    }

    const totalVerbs = (text.match(/\b(is|are|was|were|be|been|being)\b/gi) || []).length
    if (totalVerbs > 0) {
      const passivePercentage = (passiveCount / totalVerbs) * 100
      if (passivePercentage > 20) {
        tips.push({
          type: 'style',
          severity: 'suggestion',
          message: '被动语态过多',
          explanation: `被动语态占比 ${Math.round(passivePercentage)}%，建议增加主动语态的使用。`,
          example: '被动: The report was written by John. / 主动: John wrote the report.',
        })
      }
    }

    // Check for adverb overuse
    const adverbMatches = text.match(/\b\w+ly\b/gi)
    if (adverbMatches) {
      const words = text.split(/\s+/).length
      const adverbPercentage = (adverbMatches.length / words) * 100
      if (adverbPercentage > 5) {
        tips.push({
          type: 'style',
          severity: 'suggestion',
          message: '副词过多',
          explanation: `副词占比 ${Math.round(adverbPercentage)}%，建议使用更精确的动词。`,
          example: '弱: He ran quickly. / 强: He sprinted.',
        })
      }
    }

    // Check for clichés
    const clichés = [
      'at the end of the day',
      'in this day and age',
      'when all is said and done',
      'the fact of the matter',
      'for all intents and purposes',
    ]

    for (const cliché of clichés) {
      if (text.toLowerCase().includes(cliché)) {
        tips.push({
          type: 'style',
          severity: 'info',
          message: '避免陈词滥调',
          explanation: `"${cliché}" 是一个陈词滥调，考虑使用更直接的表达。`,
        })
      }
    }

    return tips
  }

  // Clarity checks
  function checkClarity(text: string): WritingTip[] {
    const tips: WritingTip[] = []

    // Check for long sentences
    const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0)
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      const words = sentence.split(/\s+/).length
      if (words > 30) {
        tips.push({
          type: 'clarity',
          severity: 'warning',
          message: '句子过长',
          explanation: `第 ${i + 1} 句有 ${words} 个词，建议拆分以提高可读性。`,
          line: findLineNumber(text, sentence),
        })
      }
    }

    // Check for complex words
    const complexWords = [
      { complex: 'utilize', simple: 'use' },
      { complex: 'implement', simple: 'use' },
      { complex: 'facilitate', simple: 'help' },
      { complex: 'commence', simple: 'start' },
      { complex: 'terminate', simple: 'end' },
    ]

    for (const { complex, simple } of complexWords) {
      if (text.toLowerCase().includes(complex)) {
        tips.push({
          type: 'clarity',
          severity: 'suggestion',
          message: '使用简单词汇',
          explanation: `考虑将 "${complex}" 替换为更简单的 "${simple}"。`,
          example: `复杂: We utilize this method. / 简单: We use this method.`,
        })
      }
    }

    // Check for jargon
    const jargonPatterns = [
      /\b(synergy|leverage|paradigm|bandwidth|scalable)\b/gi,
    ]

    for (const pattern of jargonPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        for (const match of matches) {
          tips.push({
            type: 'clarity',
            severity: 'info',
            message: '避免行业术语',
            explanation: `"${match}" 是行业术语，考虑使用更通俗的表达。`,
          })
        }
      }
    }

    return tips
  }

  // Engagement checks
  function checkEngagement(text: string): WritingTip[] {
    const tips: WritingTip[] = []

    // Check for very short paragraphs
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim()
      const words = paragraph.split(/\s+/).length
      if (words < 10 && paragraphs.length > 1) {
        tips.push({
          type: 'engagement',
          severity: 'info',
          message: '段落过短',
          explanation: `第 ${i + 1} 段只有 ${words} 个词，考虑扩展或合并。`,
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
        tips.push({
          type: 'engagement',
          severity: 'info',
          message: '词汇重复',
          explanation: `"${word}" 重复使用 ${count} 次，考虑使用同义词。`,
        })
      }
    }

    // Check for questions (engagement boost)
    const questions = text.match(/\?|？/g)
    if (!questions || questions.length === 0) {
      tips.push({
        type: 'engagement',
        severity: 'suggestion',
        message: '增加互动性',
        explanation: '考虑添加一些问题来增加读者互动。',
        example: '例如: "你有没有想过...?" 或 "这意味着什么?"',
      })
    }

    return tips
  }

  // Structure checks
  function checkStructure(text: string): WritingTip[] {
    const tips: WritingTip[] = []

    // Check for headings
    const headings = text.match(/^#{1,6}\s+.+$/gm)
    if (!headings || headings.length === 0) {
      const words = text.split(/\s+/).length
      if (words > 200) {
        tips.push({
          type: 'structure',
          severity: 'warning',
          message: '缺少标题结构',
          explanation: '长文本应该使用标题来组织内容，提高可读性。',
        })
      }
    }

    // Check for list usage
    const listItems = text.match(/^[\s]*[-*+]\s+/gm)
    if (!listItems || listItems.length === 0) {
      const words = text.split(/\s+/).length
      if (words > 300) {
        tips.push({
          type: 'structure',
          severity: 'suggestion',
          message: '考虑使用列表',
          explanation: '对于多个相关要点，使用列表可以提高可读性。',
        })
      }
    }

    // Check for transitions
    const transitions = [
      'however', 'therefore', 'moreover', 'furthermore', 'additionally',
      'in addition', 'on the other hand', 'in contrast', 'similarly',
      '但是', '因此', '此外', '另外', '然而', '同时', '相比之下',
    ]

    const hasTransitions = transitions.some(t => text.toLowerCase().includes(t))
    if (!hasTransitions) {
      const words = text.split(/\s+/).length
      if (words > 200) {
        tips.push({
          type: 'structure',
          severity: 'suggestion',
          message: '添加过渡词',
          explanation: '使用过渡词可以帮助读者理解段落之间的关系。',
          example: '例如: "然而"、"因此"、"此外"等',
        })
      }
    }

    return tips
  }

  // Calculate writing score
  function calculateScore(text: string, tips: WritingTip[]): WritingScore {
    const words = text.split(/\s+/).length
    const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0).length
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length

    // Base scores
    let grammar = 100
    let style = 100
    let clarity = 100
    let engagement = 100
    let structure = 100

    // Deduct points for issues
    for (const tip of tips) {
      const deduction = tip.severity === 'warning' ? 10 : tip.severity === 'suggestion' ? 5 : 2

      switch (tip.type) {
        case 'grammar':
          grammar -= deduction
          break
        case 'style':
          style -= deduction
          break
        case 'clarity':
          clarity -= deduction
          break
        case 'engagement':
          engagement -= deduction
          break
        case 'structure':
          structure -= deduction
          break
      }
    }

    // Ensure scores are within bounds
    grammar = Math.max(0, Math.min(100, grammar))
    style = Math.max(0, Math.min(100, style))
    clarity = Math.max(0, Math.min(100, clarity))
    engagement = Math.max(0, Math.min(100, engagement))
    structure = Math.max(0, Math.min(100, structure))

    // Calculate overall score
    const overall = Math.round((grammar + style + clarity + engagement + structure) / 5)

    return {
      overall,
      grammar,
      style,
      clarity,
      engagement,
      structure,
    }
  }

  // Find line number of text
  function findLineNumber(fullText: string, searchText: string): number {
    const index = fullText.indexOf(searchText)
    if (index === -1) return 0
    return fullText.substring(0, index).split('\n').length
  }

  // Auto-analyze on content change (debounced)
  let analyzeTimer: ReturnType<typeof setTimeout> | null = null
  watch(content, () => {
    if (analyzeTimer) clearTimeout(analyzeTimer)
    analyzeTimer = setTimeout(analyzeWriting, 3000)
  }, { immediate: false })

  return {
    tips,
    score,
    isAnalyzing,
    analyzeWriting,
  }
}
