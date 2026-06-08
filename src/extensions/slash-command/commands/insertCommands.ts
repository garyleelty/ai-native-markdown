// src/extensions/slash-command/commands/insertCommands.ts
import type { SlashCommand, CommandContext } from '@/services/commandRegistry'

export const insertCommands: SlashCommand[] = [
  {
    id: 'insert-date',
    label: '当前日期',
    description: '插入当前日期',
    icon: 'calendar',
    category: 'insert',
    keywords: ['date', '日期', '今天'],
    priority: 3,
    execute: (ctx) => {
      const date = new Date().toISOString().split('T')[0]
      const { view, from, to } = ctx
      view.dispatch({
        changes: { from, to, insert: date },
        selection: { anchor: from + date.length }
      })
    }
  },
  {
    id: 'insert-time',
    label: '当前时间',
    description: '插入当前时间',
    icon: 'clock',
    category: 'insert',
    keywords: ['time', '时间', '现在'],
    priority: 2,
    execute: (ctx) => {
      const time = new Date().toTimeString().slice(0, 5)
      const { view, from, to } = ctx
      view.dispatch({
        changes: { from, to, insert: time },
        selection: { anchor: from + time.length }
      })
    }
  },
  {
    id: 'insert-timestamp',
    label: '日期时间',
    description: '插入日期和时间',
    icon: 'calendar-clock',
    category: 'insert',
    keywords: ['timestamp', '日期时间', '时间戳'],
    priority: 1,
    execute: (ctx) => {
      const now = new Date()
      const ts = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`
      const { view, from, to } = ctx
      view.dispatch({
        changes: { from, to, insert: ts },
        selection: { anchor: from + ts.length }
      })
    }
  }
]
