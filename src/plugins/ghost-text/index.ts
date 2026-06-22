import { BasePlugin } from '@/plugin-system'

class GhostTextPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'ghost-text',
      name: 'Ghost Text 智能补全',
      description: 'AI 驱动的灰色提示文本补全',
      version: '1.0.0',
      icon: 'MagicStick',
      enabledByDefault: true,
      settingsSchema: [
        { key: 'enabled', label: '启用智能补全', type: 'boolean', default: true },
        { key: 'debounceMs', label: '延迟时间 (ms)', type: 'number', default: 1500, min: 200, max: 5000 },
        { key: 'maxPrefixChars', label: '最大前缀长度', type: 'number', default: 500, min: 100, max: 2000 },
        { key: 'maxCompletionChars', label: '最大补全长度', type: 'number', default: 200, min: 50, max: 1000 },
        { key: 'triggerMode', label: '触发模式', type: 'select', default: 'manual', options: [
          { label: '手动触发', value: 'manual' },
          { label: '停顿触发', value: 'pause' },
        ]},
      ],
    })
  }

  protected async onActivate(): Promise<void> {
    const { ghostTextPlugin, ghostTextKeymap } = await import('@/extensions/ghost-text/ghostTextPlugin')
    this.addEditorExtension([ghostTextPlugin, ghostTextKeymap])
  }
}

export const ghostTextPlugin = new GhostTextPlugin()
