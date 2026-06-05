export interface AIAction {
  id: string
  label: string
  icon: string
  prompt: string
  systemRole: string
  temperature?: number
}

export const AI_ACTIONS: AIAction[] = [
  {
    id: 'explain',
    label: '解释',
    icon: '?',
    prompt: '请用通俗易懂的语言解释以下文本的含义，直接输出解释结果：\n\n',
    systemRole: '你是一个善于用简单语言解释复杂概念的教学助手。只用中文回复。',
    temperature: 0.3
  },
  {
    id: 'translate-zh',
    label: '译中',
    icon: '中',
    prompt: '请将以下文本翻译为中文，直接输出翻译结果：\n\n',
    systemRole: '你是一个专业的翻译助手，翻译准确自然。只输出翻译结果。',
    temperature: 0.2
  },
  {
    id: 'translate-en',
    label: '译英',
    icon: 'EN',
    prompt: 'Please translate the following text to English. Output only the translation:\n\n',
    systemRole: 'You are a professional translator. Output only the translation.',
    temperature: 0.2
  },
  {
    id: 'polish',
    label: '润色',
    icon: '*',
    prompt: '请优化以下文本的表达，使其更流畅自然，保持原意不变，直接输出润色结果：\n\n',
    systemRole: '你是一个专业的文字编辑。只输出润色后的文本。',
    temperature: 0.5
  },
  {
    id: 'expand',
    label: '扩写',
    icon: '+',
    prompt: '请扩写以下内容，添加更多细节和深度，保持风格一致，直接输出扩写结果：\n\n',
    systemRole: '你是一个专业的内容创作者。只输出扩写后的文本。',
    temperature: 0.7
  },
  {
    id: 'summarize',
    label: '摘要',
    icon: '=',
    prompt: '请用一段话概括以下文本的核心要点，直接输出摘要：\n\n',
    systemRole: '你是一个擅长提炼要点的总结助手。只输出摘要。',
    temperature: 0.3
  },
  {
    id: 'fix-grammar',
    label: '纠错',
    icon: 'Aa',
    prompt: '请修正以下文本中的语法错误、错别字和表达不当之处，保持原意不变，直接输出修正结果：\n\n',
    systemRole: '你是一个专业的校对助手。只输出修正后的文本。',
    temperature: 0.1
  },
  {
    id: 'continue',
    label: '续写',
    icon: '>',
    prompt: '请根据以下前文内容，自然流畅地续写一段，保持风格一致，直接输出续写内容：\n\n',
    systemRole: '你是一个专业的写作助手。只输出续写内容，不重复前文。',
    temperature: 0.6
  }
]

export interface AIActionConfig {
  enabled: boolean
  position: 'top' | 'bottom'
  showIcons: boolean
}
