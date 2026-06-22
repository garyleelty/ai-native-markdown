import { BasePlugin } from '@/plugin-system'

class TemplatesPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'templates',
      name: '模板库',
      description: '提供文档模板快速创建功能',
      version: '1.0.0',
      icon: 'Document',
      enabledByDefault: true,
    })
  }

  protected onActivate(): void {
    this.addCommand({
      id: 'file.new-from-template',
      label: '从模板创建',
      description: '选择模板创建新文档',
      icon: 'Document',
      category: 'insert',
      keywords: ['模板', 'template', '新建'],
      priority: 10,
      execute: () => {
        // Will be handled by App.vue checking command ID
      },
    })
  }
}

export const templatesPlugin = new TemplatesPlugin()
