import { BasePlugin } from '@/plugin-system'

class MigrationAuditPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'migration-audit',
      name: '迁移审计',
      description: '扫描缺失笔记、缺失标题、附件问题等',
      version: '1.0.0',
      icon: 'Warning',
      enabledByDefault: true,
    })
  }

  protected onActivate(): void {
    this.addCommand({
      id: 'knowledge.migration-audit',
      label: '迁移审计',
      description: '扫描 Wiki Link、嵌入、附件等迁移问题',
      icon: 'Warning',
      category: 'block',
      keywords: ['迁移', '审计', 'migration', 'audit', '检查'],
      priority: 3,
      execute: () => {},
    })
  }
}

export const migrationAuditPluginInstance = new MigrationAuditPlugin()
