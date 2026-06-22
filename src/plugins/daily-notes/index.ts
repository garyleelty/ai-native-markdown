import { BasePlugin } from '@/plugin-system'

class DailyNotesPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'daily-notes',
      name: '每日笔记',
      description: '一键创建/打开今日笔记',
      version: '1.0.0',
      icon: 'Calendar',
      enabledByDefault: true,
    })
  }

  protected onActivate(): void {
    this.addCommand({
      id: 'file.daily-note',
      label: '今日笔记',
      description: '创建或打开今天的笔记',
      icon: 'Calendar',
      category: 'block',
      keywords: ['日记', 'daily', '今日', '笔记'],
      priority: 15,
      execute: () => {
        // Will be handled by App.vue
      },
    })
  }
}

export const dailyNotesPlugin = new DailyNotesPlugin()
