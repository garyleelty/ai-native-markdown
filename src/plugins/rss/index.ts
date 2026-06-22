import { BasePlugin } from '@/plugin-system'

class RSSPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'rss',
      name: 'RSS 订阅',
      description: '内置 RSS 阅读器，文章导入为 Markdown 笔记',
      version: '1.0.0',
      icon: 'Document',
      enabledByDefault: true,
    })
  }

  protected onActivate(): void {
    this.addSidebarTab({
      id: 'rss',
      label: 'RSS',
      icon: 'Document',
      ariaLabel: 'RSS 订阅',
      component: () => import('@/components/sidebar/RSSPanel.vue'),
    })
  }
}

export const rssPluginInstance = new RSSPlugin()
