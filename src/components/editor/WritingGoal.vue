<template>
  <div class="writing-goal" v-if="target > 0">
    <el-progress
      :percentage="percentage"
      :stroke-width="8"
      :color="progressColor"
      :format="() => `${current}/${target}`"
    />
    <div class="goal-info">
      <span>{{ remaining > 0 ? `还需 ${remaining} 词` : '目标达成！🎉' }}</span>
      <el-button size="small" text @click="showGoalSetting = true">设置目标</el-button>
    </div>
    <el-dialog v-model="showGoalSetting" title="写作目标" width="320px">
      <el-form label-position="top">
        <el-form-item label="目标词数">
          <el-input-number v-model="tempTarget" :min="100" :max="100000" :step="100" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGoalSetting = false">取消</el-button>
        <el-button type="primary" @click="saveGoal">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{ current: number }>()

function loadWritingGoal(): number {
  try {
    return parseInt(localStorage.getItem('writing_goal') || '0')
  } catch {
    return 0
  }
}

const target = ref(loadWritingGoal())
const tempTarget = ref(target.value)
const showGoalSetting = ref(target.value === 0)

const percentage = computed(() => target.value > 0 ? Math.min(100, Math.round((props.current / target.value) * 100)) : 0)
const remaining = computed(() => Math.max(0, target.value - props.current))
const progressColor = computed(() => {
  if (percentage.value >= 100) return 'var(--el-color-success)'
  if (percentage.value >= 60) return 'var(--accent-primary)'
  return 'var(--el-color-warning)'
})

const saveGoal = () => {
  target.value = tempTarget.value
  try {
    localStorage.setItem('writing_goal', String(target.value))
  } catch {
  }
  showGoalSetting.value = false
}

watch(() => props.current, (val) => {
  if (target.value > 0 && val >= target.value && val - 10 < target.value) {
    // Just reached the goal
  }
})
</script>

<style scoped>
.writing-goal {
  padding: 8px 16px;
  border-top: 1px solid var(--obsidian-border);
  background: var(--obsidian-bg-secondary);
}

.goal-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--obsidian-text-muted);
  margin-top: 4px;
}
</style>
