import { ref, computed, type Ref } from 'vue'

export interface AutomationRule {
  id: string
  name: string
  description: string
  trigger: AutomationTrigger
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  enabled: boolean
  lastRun?: Date
  runCount: number
}

export interface AutomationTrigger {
  type: 'file_change' | 'time' | 'manual' | 'content_change'
  config: Record<string, any>
}

export interface AutomationCondition {
  type: 'file_path' | 'content_contains' | 'tag_exists' | 'time_of_day'
  config: Record<string, any>
}

export interface AutomationAction {
  type: 'notify' | 'run_command' | 'ai_process' | 'move_file' | 'add_tag'
  config: Record<string, any>
}

export interface AutomationExecution {
  ruleId: string
  timestamp: Date
  success: boolean
  message: string
  duration: number
}

export function useAutomation() {
  const rules = ref<AutomationRule[]>([])
  const executions = ref<AutomationExecution[]>([])
  const isRunning = ref(false)

  // Default automation rules
  const defaultRules: AutomationRule[] = [
    {
      id: 'auto-save',
      name: '自动保存',
      description: '文件修改后自动保存',
      trigger: { type: 'content_change', config: { delay: 5000 } },
      conditions: [],
      actions: [{ type: 'run_command', config: { command: 'file.save' } }],
      enabled: true,
      runCount: 0,
    },
    {
      id: 'daily-note',
      name: '每日笔记',
      description: '每天自动创建今日笔记',
      trigger: { type: 'time', config: { time: '00:00', recurring: true } },
      conditions: [],
      actions: [{ type: 'run_command', config: { command: 'file.daily-note' } }],
      enabled: false,
      runCount: 0,
    },
    {
      id: 'tag-reminder',
      name: '标签提醒',
      description: '无标签笔记添加默认标签',
      trigger: { type: 'file_change', config: { event: 'save' } },
      conditions: [{ type: 'tag_exists', config: { exists: false } }],
      actions: [{ type: 'add_tag', config: { tag: 'untagged' } }],
      enabled: false,
      runCount: 0,
    },
    {
      id: 'backup',
      name: '自动备份',
      description: '每天备份工作区',
      trigger: { type: 'time', config: { time: '23:00', recurring: true } },
      conditions: [],
      actions: [{ type: 'run_command', config: { command: 'file.backup' } }],
      enabled: false,
      runCount: 0,
    },
  ]

  // Initialize with default rules
  rules.value = defaultRules

  // Add a new rule
  function addRule(rule: Omit<AutomationRule, 'id' | 'runCount'>): AutomationRule {
    const newRule: AutomationRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      runCount: 0,
    }
    rules.value.push(newRule)
    return newRule
  }

  // Update a rule
  function updateRule(id: string, updates: Partial<AutomationRule>) {
    const index = rules.value.findIndex(r => r.id === id)
    if (index !== -1) {
      rules.value[index] = { ...rules.value[index], ...updates }
    }
  }

  // Delete a rule
  function deleteRule(id: string) {
    rules.value = rules.value.filter(r => r.id !== id)
  }

  // Toggle rule enabled state
  function toggleRule(id: string) {
    const rule = rules.value.find(r => r.id === id)
    if (rule) {
      rule.enabled = !rule.enabled
    }
  }

  // Check if conditions are met
  function checkConditions(conditions: AutomationCondition[], context: any): boolean {
    for (const condition of conditions) {
      switch (condition.type) {
        case 'file_path':
          if (context.filePath && !context.filePath.includes(condition.config.pattern)) {
            return false
          }
          break
        case 'content_contains':
          if (context.content && !context.content.includes(condition.config.text)) {
            return false
          }
          break
        case 'tag_exists':
          if (condition.config.exists && (!context.tags || context.tags.length === 0)) {
            return false
          }
          if (!condition.config.exists && context.tags && context.tags.length > 0) {
            return false
          }
          break
        case 'time_of_day':
          const now = new Date()
          const hours = now.getHours()
          const minutes = now.getMinutes()
          const currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
          if (currentTime < condition.config.start || currentTime > condition.config.end) {
            return false
          }
          break
      }
    }
    return true
  }

  // Execute an action
  async function executeAction(action: AutomationAction, context: any): Promise<string> {
    switch (action.type) {
      case 'notify':
        return `通知: ${action.config.message}`
      case 'run_command':
        return `执行命令: ${action.config.command}`
      case 'ai_process':
        return `AI 处理: ${action.config.prompt}`
      case 'move_file':
        return `移动文件到: ${action.config.destination}`
      case 'add_tag':
        return `添加标签: ${action.config.tag}`
      default:
        return '未知操作'
    }
  }

  // Run a rule
  async function runRule(ruleId: string, context: any = {}): Promise<AutomationExecution> {
    const rule = rules.value.find(r => r.id === ruleId)
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`)
    }

    const startTime = Date.now()
    isRunning.value = true

    try {
      // Check conditions
      if (!checkConditions(rule.conditions, context)) {
        return {
          ruleId,
          timestamp: new Date(),
          success: true,
          message: '条件不满足，跳过执行',
          duration: Date.now() - startTime,
        }
      }

      // Execute actions
      const messages: string[] = []
      for (const action of rule.actions) {
        const message = await executeAction(action, context)
        messages.push(message)
      }

      // Update rule
      rule.lastRun = new Date()
      rule.runCount++

      const execution: AutomationExecution = {
        ruleId,
        timestamp: new Date(),
        success: true,
        message: messages.join('; '),
        duration: Date.now() - startTime,
      }

      executions.value.push(execution)
      return execution
    } catch (e: any) {
      const execution: AutomationExecution = {
        ruleId,
        timestamp: new Date(),
        success: false,
        message: e.message || '执行失败',
        duration: Date.now() - startTime,
      }

      executions.value.push(execution)
      return execution
    } finally {
      isRunning.value = false
    }
  }

  // Run all enabled rules
  async function runAllRules(context: any = {}): Promise<AutomationExecution[]> {
    const results: AutomationExecution[] = []

    for (const rule of rules.value) {
      if (rule.enabled) {
        const result = await runRule(rule.id, context)
        results.push(result)
      }
    }

    return results
  }

  // Get rule statistics
  const ruleStats = computed(() => {
    const total = rules.value.length
    const enabled = rules.value.filter(r => r.enabled).length
    const totalRuns = rules.value.reduce((sum, r) => sum + r.runCount, 0)

    return { total, enabled, totalRuns }
  })

  // Get recent executions
  const recentExecutions = computed(() => {
    return executions.value
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)
  })

  return {
    rules,
    executions,
    isRunning,
    ruleStats,
    recentExecutions,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    runRule,
    runAllRules,
  }
}
