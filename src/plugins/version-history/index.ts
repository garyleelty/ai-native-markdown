import { BasePlugin } from '@/plugin-system'

class VersionHistoryPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'version-history',
      name: '版本历史',
      description: '文档版本保存、预览和恢复',
      version: '1.0.0',
      icon: 'Clock',
      enabledByDefault: true,
    })
  }

  protected onActivate(): void {
    this.addCommand({
      id: 'file.version-history',
      label: '版本历史',
      description: '查看和恢复文档历史版本',
      icon: 'Clock',
      category: 'block',
      keywords: ['版本', '历史', 'version', 'history'],
      priority: 5,
      execute: () => {},
    })
  }
}

export const versionHistoryPluginInstance = new VersionHistoryPlugin()
