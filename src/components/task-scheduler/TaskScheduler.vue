<template>
  <div class="task-scheduler">
    <div class="task-scheduler-header">
      <h3>任务调度</h3>
      <p class="task-scheduler-desc">管理您的待办事项和计划</p>
    </div>
    <div class="task-scheduler-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p>任务调度功能即将上线</p>
      <span>敬请期待</span>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.task-scheduler {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.task-scheduler-header {
  margin-bottom: 24px;
}

.task-scheduler-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.task-scheduler-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

.task-scheduler-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
}

.task-scheduler-empty svg {
  opacity: 0.4;
}

.task-scheduler-empty p {
  font-size: 14px;
  margin: 0;
}

.task-scheduler-empty span {
  font-size: 12px;
  opacity: 0.6;
}
</style>
