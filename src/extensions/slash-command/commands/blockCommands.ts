// src/extensions/slash-command/commands/blockCommands.ts
import type { SlashCommand, CommandContext } from '@/services/commandRegistry'

function insertBlock(ctx: CommandContext, text: string): void {
  const { view, from, to } = ctx
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length }
  })
}

export const blockCommands: SlashCommand[] = [
  {
    id: 'heading-1',
    label: '一级标题',
    description: '插入一级标题',
    icon: 'heading',
    category: 'block',
    keywords: ['heading', 'h1', '标题', '一级'],
    priority: 10,
    execute: (ctx) => insertBlock(ctx, '# ')
  },
  {
    id: 'heading-2',
    label: '二级标题',
    description: '插入二级标题',
    icon: 'heading',
    category: 'block',
    keywords: ['heading', 'h2', '标题', '二级'],
    priority: 9,
    execute: (ctx) => insertBlock(ctx, '## ')
  },
  {
    id: 'heading-3',
    label: '三级标题',
    description: '插入三级标题',
    icon: 'heading',
    category: 'block',
    keywords: ['heading', 'h3', '标题', '三级'],
    priority: 8,
    execute: (ctx) => insertBlock(ctx, '### ')
  },
  {
    id: 'code-block',
    label: '代码块',
    description: '插入代码块',
    icon: 'code',
    category: 'block',
    keywords: ['code', '代码', '代码块'],
    priority: 7,
    execute: (ctx) => {
      const { view, from, to } = ctx
      const insert = '```\n\n```'
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 4 }
      })
    }
  },
  {
    id: 'ordered-list',
    label: '有序列表',
    description: '插入有序列表',
    icon: 'list-ol',
    category: 'block',
    keywords: ['ordered', 'list', '有序', '列表', '数字'],
    priority: 6,
    execute: (ctx) => insertBlock(ctx, '1. ')
  },
  {
    id: 'unordered-list',
    label: '无序列表',
    description: '插入无序列表',
    icon: 'list-ul',
    category: 'block',
    keywords: ['unordered', 'list', '无序', '列表', 'bullet'],
    priority: 5,
    execute: (ctx) => insertBlock(ctx, '- ')
  },
  {
    id: 'task-list',
    label: '任务列表',
    description: '插入任务列表',
    icon: 'check-square',
    category: 'block',
    keywords: ['task', 'todo', '任务', '待办', 'checkbox'],
    priority: 4,
    execute: (ctx) => insertBlock(ctx, '- [ ] ')
  },
  {
    id: 'blockquote',
    label: '引用',
    description: '插入引用块',
    icon: 'quote-right',
    category: 'block',
    keywords: ['quote', 'blockquote', '引用'],
    priority: 3,
    execute: (ctx) => insertBlock(ctx, '> ')
  },
  {
    id: 'table',
    label: '表格',
    description: '插入表格',
    icon: 'table',
    category: 'block',
    keywords: ['table', '表格'],
    priority: 2,
    execute: (ctx) => {
      const { view, from, to } = ctx
      const insert = '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| | | |'
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 2 }
      })
    }
  },
  {
    id: 'horizontal-rule',
    label: '分割线',
    description: '插入分割线',
    icon: 'minus',
    category: 'block',
    keywords: ['horizontal', 'rule', '分割线', '分隔', 'hr'],
    priority: 1,
    execute: (ctx) => insertBlock(ctx, '\n---\n')
  },
  {
    id: 'callout',
    label: '标注',
    description: '插入标注块',
    icon: 'alert-circle',
    category: 'block',
    keywords: ['callout', 'note', '标注', '提示', '警告'],
    priority: 1,
    execute: (ctx) => insertBlock(ctx, '> [!note]\n> ')
  }
]
