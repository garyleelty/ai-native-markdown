<template>
  <el-dialog v-model="visible" title="从模板创建" width="600px" @close="$emit('update:modelValue', false)">
    <el-input v-model="searchQuery" placeholder="搜索模板..." clearable :prefix-icon="Search" style="margin-bottom: 16px" />
    <div class="template-grid">
      <el-card
        v-for="t in filteredTemplates"
        :key="t.id"
        shadow="hover"
        class="template-card"
        @click="selectTemplate(t)"
      >
        <div class="template-icon">
          <el-icon :size="24"><component :is="t.icon" /></el-icon>
        </div>
        <div class="template-name">{{ t.name }}</div>
        <div class="template-desc">{{ t.desc }}</div>
      </el-card>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Document, Notebook, TrendCharts, ChatDotRound, Memo, Calendar, Reading, Trophy } from '@element-plus/icons-vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'select', content: string, name: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const searchQuery = ref('')

const templates = [
  {
    id: 'blank', name: '空白文档', desc: '从零开始', icon: Document,
    content: ''
  },
  {
    id: 'blog', name: '博客文章', desc: '技术博客模板', icon: Notebook,
    content: `# 标题\n\n> 一句话描述\n\n## 背景\n\n## 正文\n\n### 要点一\n\n### 要点二\n\n## 总结\n\n---\n\n*感谢阅读！*`
  },
  {
    id: 'readme', name: 'README', desc: '项目说明文档', icon: Memo,
    content: `# 项目名称\n\n简短描述\n\n## 功能特性\n\n- 特性一\n- 特性二\n- 特性三\n\n## 快速开始\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## 使用方法\n\n## 配置\n\n## 贡献\n\n## 许可证\n\nMIT`
  },
  {
    id: 'meeting', name: '会议纪要', desc: '会议记录模板', icon: Calendar,
    content: `# 会议纪要\n\n**日期**: {{date}}\n**参与者**: \n**主题**: \n\n## 议题\n\n### 议题一\n\n- 讨论:\n- 决定:\n\n### 议题二\n\n- 讨论:\n- 决定:\n\n## 行动项\n\n| 任务 | 负责人 | 截止日期 |\n|------|--------|----------|\n|      |        |          |\n\n## 下次会议\n\n- 时间:\n- 议题:`
  },
  {
    id: 'weekly', name: '周报', desc: '工作周报模板', icon: TrendCharts,
    content: `# 周报 {{week}}\n\n## 本周完成\n\n1. \n2. \n3. \n\n## 进行中\n\n1. \n2. \n\n## 下周计划\n\n1. \n2. \n3. \n\n## 风险与问题\n\n- \n\n## 学习与反思\n\n`
  },
  {
    id: 'api', name: 'API 文档', desc: '接口文档模板', icon: Reading,
    content: `# API 文档\n\n## 接口名称\n\n**URL**: \`/api/endpoint\`\n**方法**: \`GET/POST\`\n\n### 请求参数\n\n| 参数 | 类型 | 必填 | 描述 |\n|------|------|------|------|\n|      |      |      |      |\n\n### 响应\n\n\`\`\`json\n{\n  "code": 200,\n  "data": {},\n  "message": "success"\n}\n\`\`\`\n\n### 错误码\n\n| 错误码 | 描述 |\n|--------|------|\n|        |      |`
  },
  {
    id: 'tutorial', name: '教程', desc: '步骤教程模板', icon: Trophy,
    content: `# 教程标题\n\n## 前置条件\n\n- \n\n## 步骤一：\n\n1. \n2. \n3. \n\n## 步骤二：\n\n1. \n2. \n\n## 步骤三：\n\n1. \n2. \n\n## 常见问题\n\n### Q1:\n\nA: \n\n## 总结\n\n恭喜完成！`
  },
  {
    id: 'chat-export', name: '对话导出', desc: 'AI 对话记录模板', icon: ChatDotRound,
    content: `# 对话记录\n\n**日期**: {{date}}\n**模型**: \n\n---\n\n## 👤 用户\n\n\n\n## 🤖 助手\n\n\n\n---\n\n## 👤 用户\n\n\n\n## 🤖 助手\n\n`
  }
]

const filteredTemplates = computed(() => {
  if (!searchQuery.value) return templates
  const q = searchQuery.value.toLowerCase()
  return templates.filter(t => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q))
})

const selectTemplate = (t: typeof templates[0]) => {
  const content = t.content.replace('{{date}}', new Date().toLocaleDateString('zh-CN')).replace('{{week}}', `W${Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000)}`)
  emit('select', content, `${t.name}.md`)
  visible.value = false
}
</script>

<style scoped>
.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.template-card {
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.template-card:hover {
  border-color: var(--obsidian-accent);
}

.template-card :deep(.el-card__body) {
  padding: 16px;
}

.template-icon {
  margin-bottom: 8px;
  color: var(--obsidian-accent);
}

.template-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
  margin-bottom: 4px;
}

.template-desc {
  font-size: 11px;
  color: var(--obsidian-text-faint);
}
</style>
