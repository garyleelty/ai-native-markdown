<template>
  <Transition name="onboarding-fade">
    <div v-if="visible" class="onboarding-overlay" @click.self="handleSkip">
      <div class="onboarding-card">
        <div class="onboarding-progress">
          <div
            v-for="(step, i) in steps"
            :key="i"
            class="progress-dot"
            :class="{ active: i === currentStep, completed: i < currentStep }"
          />
        </div>

        <div class="onboarding-content">
          <div class="step-icon">
            <el-icon :size="32" color="var(--obsidian-accent)">
              <component :is="steps[currentStep].icon" />
            </el-icon>
          </div>
          <h2 class="step-title">{{ steps[currentStep].title }}</h2>
          <p class="step-description">{{ steps[currentStep].description }}</p>
          <div v-if="steps[currentStep].tip" class="step-tip">
            <el-icon :size="14"><InfoFilled /></el-icon>
            <span>{{ steps[currentStep].tip }}</span>
          </div>
        </div>

        <div class="onboarding-actions">
          <el-button text @click="handleSkip">
            跳过引导
          </el-button>
          <div class="action-buttons">
            <el-button
              v-if="currentStep > 0"
              @click="prevStep"
            >
              上一步
            </el-button>
            <el-button
              type="primary"
              @click="nextStep"
            >
              {{ currentStep === steps.length - 1 ? '开始使用' : '下一步' }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  FolderAdd,
  EditPen,
  Connection,
  Cpu,
  MagicStick,
  InfoFilled,
} from '@element-plus/icons-vue'

const visible = ref(false)
const currentStep = ref(0)

const steps = [
  {
    icon: FolderAdd,
    title: '选择你的工作区',
    description: '打开一个本地文件夹作为工作区，或者先试用示例工作区来熟悉功能。',
    tip: '工作区中的所有文件都保存在本地，不会上传到任何服务器。',
  },
  {
    icon: EditPen,
    title: 'Markdown 写作',
    description: '支持源码模式、实时预览和阅读模式。工具栏提供常用格式化操作，快捷键让写作更高效。',
    tip: '按 Ctrl/Cmd + P 打开命令面板，快速访问所有功能。',
  },
  {
    icon: Connection,
    title: '连接你的知识',
    description: '用 [[Wiki Link]] 连接笔记，查看反链和知识图谱，发现知识之间的隐藏关联。',
    tip: '输入 [[ 自动补全笔记名和标题。',
  },
  {
    icon: Cpu,
    title: 'AI 写作助手',
    description: '配置 Ollama 或 OpenAI-compatible Provider，获得续写、润色、摘要等 AI 辅助能力。',
    tip: '支持本地模型（Ollama）和云端 API，数据安全可控。',
  },
  {
    icon: MagicStick,
    title: '多模态输入',
    description: '拖拽图片自动 OCR、拖拽 PDF 提取文字、语音输入，让内容采集更便捷。',
    tip: '所有处理都在本地完成，保护你的隐私。',
  },
]

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  } else {
    handleComplete()
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function handleSkip() {
  visible.value = false
  localStorage.setItem('ai-markdown:onboarding-done', 'true')
}

function handleComplete() {
  visible.value = false
  localStorage.setItem('ai-markdown:onboarding-done', 'true')
}

function show() {
  const done = localStorage.getItem('ai-markdown:onboarding-done')
  if (!done) {
    visible.value = true
    currentStep.value = 0
  }
}

defineExpose({ show })
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.onboarding-card {
  width: min(480px, 90vw);
  background: var(--obsidian-bg-secondary);
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-lg);
  padding: 32px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}

.onboarding-progress {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 28px;
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--obsidian-border);
  transition: all 0.3s var(--ease-spring);
}

.progress-dot.active {
  background: var(--obsidian-accent);
  transform: scale(1.3);
}

.progress-dot.completed {
  background: var(--obsidian-accent);
  opacity: 0.5;
}

.onboarding-content {
  text-align: center;
  margin-bottom: 28px;
}

.step-icon {
  margin-bottom: 16px;
}

.step-title {
  margin: 0 0 12px;
  color: var(--obsidian-text-normal);
  font-size: 20px;
  font-weight: 700;
}

.step-description {
  margin: 0 0 16px;
  color: var(--obsidian-text-muted);
  font-size: 14px;
  line-height: 1.7;
}

.step-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--obsidian-accent-soft);
  border: 1px solid var(--obsidian-accent);
  border-radius: var(--radius-md);
  color: var(--obsidian-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.onboarding-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity 0.3s ease;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}

.onboarding-fade-enter-active .onboarding-card {
  animation: card-slide-up 0.3s var(--ease-spring);
}

@keyframes card-slide-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
