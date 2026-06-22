import { BasePlugin } from '@/plugin-system'

class ExportPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'export',
      name: '导出',
      description: '导出 Markdown、HTML、纯文本',
      version: '1.0.0',
      icon: 'Download',
      enabledByDefault: true,
    })
  }

  protected onActivate(): void {
    this.addCommand({
      id: 'file.export',
      label: '导出文档',
      description: '将当前文档导出为不同格式',
      icon: 'Download',
      category: 'block',
      keywords: ['导出', 'export', 'html', 'markdown'],
      priority: 5,
      execute: () => {},
    })

    this.addCommand({
      id: 'file.export-md',
      label: '导出为 Markdown',
      description: '导出为 .md 文件',
      icon: 'Download',
      category: 'block',
      keywords: ['导出', 'export', 'markdown'],
      priority: 3,
      execute: () => {},
    })

    this.addCommand({
      id: 'file.export-html',
      label: '导出为 HTML',
      description: '导出为 HTML 文件',
      icon: 'Download',
      category: 'block',
      keywords: ['导出', 'export', 'html'],
      priority: 3,
      execute: () => {},
    })
  }
}

export const exportPlugin = new ExportPlugin()
