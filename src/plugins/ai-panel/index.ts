import { BasePlugin } from '@/plugin-system'

class AIPanelPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'ai-panel',
      name: 'AI 助手面板',
      description: 'AI 聊天对话、续写、润色、摘要等',
      version: '1.0.0',
      icon: 'ChatDotRound',
      enabledByDefault: true,
      settingsSchema: [
        { key: 'provider', label: 'AI 提供商', type: 'select', default: 'ollama', options: [
          { label: 'Ollama (本地)', value: 'ollama' },
          { label: 'OpenAI Compatible', value: 'openai' },
          { label: 'DeepSeek', value: 'deepseek' },
          { label: '自定义', value: 'custom' },
        ]},
        { key: 'baseURL', label: '服务地址', type: 'text', default: 'http://localhost:11434' },
        { key: 'model', label: '模型名称', type: 'text', default: 'qwen2.5:7b' },
        { key: 'temperature', label: '温度', type: 'number', default: 0.7, min: 0, max: 2 },
        { key: 'maxTokens', label: '最大 Token', type: 'number', default: 4096, min: 256, max: 128000 },
      ],
    })
  }

  protected onActivate(): void {
    this.addCommand({
      id: 'ai.clear-chat',
      label: '清空 AI 对话',
      description: '清空当前 AI 聊天历史',
      icon: 'Delete',
      category: 'ai',
      keywords: ['清空', 'clear', 'AI', '对话'],
      priority: 5,
      execute: () => {},
    })

    this.addCommand({
      id: 'ai.test-connection',
      label: '测试 AI 连接',
      description: '测试当前 AI 配置是否可用',
      icon: 'Connection',
      category: 'ai',
      keywords: ['测试', 'test', 'AI', '连接'],
      priority: 3,
      execute: () => {},
    })
  }
}

export const aiPanelPluginInstance = new AIPanelPlugin()
