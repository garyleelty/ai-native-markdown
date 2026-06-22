import { BasePlugin } from '@/plugin-system'

class KnowledgeGraphPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'knowledge-graph',
      name: '知识图谱',
      description: '知识图谱可视化、反链、未链接提及',
      version: '1.0.0',
      icon: 'Share',
      enabledByDefault: true,
    })
  }

  protected onActivate(): void {
    this.addSidebarTab({
      id: 'knowledge',
      label: '图谱',
      icon: 'Share',
      ariaLabel: '知识图谱',
      component: () => import('@/components/sidebar/KnowledgePanel.vue'),
    })
  }
}

export const knowledgeGraphPluginInstance = new KnowledgeGraphPlugin()
