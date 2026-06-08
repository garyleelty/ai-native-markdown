// src/extensions/slash-command/commands/aiCommands.ts
import type { SlashCommand, CommandContext } from '@/services/commandRegistry'
import type { ChatMessage } from '@/types'
import { handleError } from '@/utils/errorHandler'

async function executeAIAction(
  ctx: CommandContext,
  systemRole: string,
  promptPrefix: string,
  temperature?: number
): Promise<void> {
  const provider = ctx.services.ai.getActiveProvider()
  if (!provider) return

  const { view, from, to, selectedText } = ctx
  const text = selectedText || view.state.sliceDoc(
    Math.max(0, from - 500),
    from
  )

  const controller = new AbortController()

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemRole },
      { role: 'user', content: `${promptPrefix}\n\n${text}` }
    ]

    let result = ''
    for await (const chunk of provider.streamChat(messages, {
      temperature,
      signal: controller.signal
    })) {
      result += chunk
    }

    if (result) {
      view.dispatch({
        changes: { from, to, insert: result },
        selection: { anchor: from + result.length }
      })
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      handleError(e, 'AI 操作失败')
    }
  }
}

export const aiCommands: SlashCommand[] = [
  {
    id: 'ai-summarize',
    label: 'AI 摘要',
    description: '生成选中文本的摘要',
    icon: 'file-text',
    category: 'ai',
    keywords: ['summarize', '摘要', '总结', '概括'],
    priority: 10,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的文本摘要助手。请生成简洁准确的摘要，保留核心要点。',
      '请为以下文本生成摘要：'
    )
  },
  {
    id: 'ai-translate-zh',
    label: 'AI 译中',
    description: '将选中文本翻译为中文',
    icon: 'languages',
    category: 'ai',
    keywords: ['translate', 'chinese', '翻译', '中文', '译中'],
    priority: 9,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的翻译助手。请将文本翻译为自然流畅的中文。',
      '请将以下文本翻译为中文：'
    )
  },
  {
    id: 'ai-translate-en',
    label: 'AI 译英',
    description: '将选中文本翻译为英文',
    icon: 'languages',
    category: 'ai',
    keywords: ['translate', 'english', '翻译', '英文', '译英'],
    priority: 8,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的翻译助手。请将文本翻译为自然流畅的英文。',
      '请将以下文本翻译为英文：'
    )
  },
  {
    id: 'ai-polish',
    label: 'AI 润色',
    description: '润色选中文本',
    icon: 'sparkles',
    category: 'ai',
    keywords: ['polish', '润色', '优化', '改进', '修饰'],
    priority: 7,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的文本润色助手。请改善文本的表达，使其更清晰、流畅、专业，同时保持原意不变。',
      '请润色以下文本：'
    )
  },
  {
    id: 'ai-expand',
    label: 'AI 扩写',
    description: '扩写选中文本',
    icon: 'maximize-2',
    category: 'ai',
    keywords: ['expand', '扩写', '扩展', '展开', '详细'],
    priority: 6,
    requireSelection: true,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的文本扩写助手。请在保持原意的基础上，丰富细节、增加论据、扩展内容。',
      '请扩写以下文本：'
    )
  },
  {
    id: 'ai-outline',
    label: 'AI 大纲',
    description: '为当前文档生成大纲',
    icon: 'list',
    category: 'ai',
    keywords: ['outline', '大纲', '目录', '结构'],
    priority: 5,
    requireSelection: false,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的大纲生成助手。请根据文档内容生成结构化大纲，使用 Markdown 标题层级。',
      '请为以下文档生成大纲：'
    )
  },
  {
    id: 'ai-continue',
    label: 'AI 续写',
    description: '续写光标后的内容',
    icon: 'corner-down-right',
    category: 'ai',
    keywords: ['continue', '续写', '继续', '补全'],
    priority: 4,
    requireSelection: false,
    execute: (ctx) => executeAIAction(
      ctx,
      '你是一个专业的文本续写助手。请自然地续写文本，保持风格和语调一致。',
      '请续写以下文本：'
    )
  }
]
