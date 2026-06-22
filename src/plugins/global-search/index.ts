import { BasePlugin } from '@/plugin-system'

class GlobalSearchPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'global-search',
      name: '全局搜索',
      description: '文件名搜索和全局内容搜索',
      version: '1.0.0',
      icon: 'Search',
      enabledByDefault: true,
    })
  }

  protected onActivate(): void {
    this.addSidebarTab({
      id: 'search',
      label: '搜索',
      icon: 'Search',
      ariaLabel: '全局搜索',
      component: () => import('@/components/sidebar/GlobalSearchPanel.vue'),
    })
  }
}

export const globalSearchPluginInstance = new GlobalSearchPlugin()
