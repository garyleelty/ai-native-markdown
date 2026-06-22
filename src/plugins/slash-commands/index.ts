import { BasePlugin } from '@/plugin-system'

class SlashCommandsPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'slash-commands',
      name: 'Slash 命令',
      description: '编辑器内 / 触发快捷命令菜单',
      version: '1.0.0',
      icon: 'Promotion',
      enabledByDefault: true,
    })
  }

  protected async onActivate(): Promise<void> {
    const { slashCommandExtension } = await import('@/extensions/slash-command/slashCommandPlugin')
    await import('@/extensions/slash-command/styles.css')
    this.addEditorExtension(slashCommandExtension)
  }
}

export const slashCommandsPluginInstance = new SlashCommandsPlugin()
