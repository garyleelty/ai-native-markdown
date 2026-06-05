<template>
  <div class="writing-goal status-item">
    <button
      class="goal-trigger"
      type="button"
      :aria-label="target > 0 ? `写作目标 ${current}/${target}` : '设置写作目标'"
      :style="goalProgressStyle"
      @click="openGoalSetting"
    >
      <span class="goal-dot" />
      <span class="goal-text">{{ target > 0 ? `${current}/${target}` : '目标' }}</span>
    </button>

    <el-dialog v-model="showGoalSetting" title="写作目标" width="360px" class="responsive-dialog">
      <div v-if="target > 0" class="goal-summary">
        <el-progress
          :percentage="percentage"
          :stroke-width="8"
          :color="progressColor"
          :format="() => `${percentage}%`"
        />
        <div class="goal-info">{{ goalStatusLabel }}</div>
      </div>
      <el-form label-position="top">
        <el-form-item label="目标词数">
          <el-input-number v-model="tempTarget" :min="100" :max="100000" :step="100" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="target > 0" native-type="button" @click="clearGoal">清除目标</el-button>
        <el-button native-type="button" @click="showGoalSetting = false">取消</el-button>
        <el-button type="primary" native-type="button" @click="saveGoal">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { safeStorage } from '@/utils/security'

const props = defineProps<{ current: number }>()

function loadWritingGoal(): number {
  return safeStorage.get('writing_goal', 0)
}

const target = ref(loadWritingGoal())
const tempTarget = ref(target.value || 500)
const showGoalSetting = ref(false)

const percentage = computed(() => target.value > 0 ? Math.min(100, Math.round((props.current / target.value) * 100)) : 0)
const remaining = computed(() => Math.max(0, target.value - props.current))
const progressColor = computed(() => {
  if (percentage.value >= 100) return 'var(--el-color-success)'
  if (percentage.value >= 60) return 'var(--accent-primary)'
  return 'var(--el-color-warning)'
})
const goalStatusLabel = computed(() => remaining.value > 0 ? `还需 ${remaining.value} 词` : '目标达成')
const goalProgressStyle = computed(() => ({
  '--goal-progress-color': progressColor.value,
  '--goal-progress-width': `${percentage.value}%`,
}))

const openGoalSetting = () => {
  tempTarget.value = target.value || Math.max(500, Math.ceil(props.current / 100) * 100)
  showGoalSetting.value = true
}

const saveGoal = () => {
  target.value = Number(tempTarget.value) || 0
  safeStorage.set('writing_goal', target.value)
  showGoalSetting.value = false
}

const clearGoal = () => {
  target.value = 0
  tempTarget.value = 500
  safeStorage.set('writing_goal', 0)
  showGoalSetting.value = false
}
</script>

<style scoped>
.writing-goal {
  display: flex;
  align-items: center;
}

.goal-trigger {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 7px;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--obsidian-bg-hover);
  color: var(--obsidian-text-faint);
  font: inherit;
  cursor: pointer;
}

.goal-trigger::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  width: var(--goal-progress-width, 0%);
  height: 2px;
  background: var(--goal-progress-color, var(--obsidian-accent));
}

.goal-trigger:hover {
  color: var(--obsidian-text-muted);
  background: var(--obsidian-bg-active);
}

.goal-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--goal-progress-color, var(--obsidian-accent));
}

.goal-text {
  position: relative;
  z-index: 1;
}

.goal-summary {
  margin-bottom: 14px;
}

.goal-info {
  font-size: 11px;
  color: var(--obsidian-text-muted);
  margin-top: 6px;
}
</style>
