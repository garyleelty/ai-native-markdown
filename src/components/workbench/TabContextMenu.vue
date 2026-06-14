<template>
  <template v-if="visible">
    <div
      class="tab-context-backdrop"
      @click="$emit('close')"
      @contextmenu.prevent="$emit('close')"
    />
    <div
      class="tab-context-menu"
      ref="menuRef"
      role="menu"
      aria-label="标签页菜单"
      :style="menuStyle"
      tabindex="-1"
      @keydown.esc.stop.prevent="$emit('close')"
      @keydown.down.stop.prevent="focusMenuItem(1)"
      @keydown.up.stop.prevent="focusMenuItem(-1)"
      @keydown.home.stop.prevent="focusMenuItem('first')"
      @keydown.end.stop.prevent="focusMenuItem('last')"
      @click.stop
      @contextmenu.prevent
    >
      <button type="button" role="menuitem" @click="$emit('command', 'save')">保存</button>
      <button type="button" role="menuitem" :disabled="disableClose" @click="$emit('command', 'close')">关闭</button>
      <button type="button" role="menuitem" :disabled="disableClose" @click="$emit('command', 'closeOthers')">关闭其他</button>
      <button type="button" role="menuitem" @click="$emit('command', 'closeAll')">关闭所有</button>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const MENU_WIDTH = 132
const MENU_HEIGHT = 128
const VIEWPORT_PADDING = 8

const props = defineProps<{
  visible: boolean
  position: { x: number; y: number }
  disableClose?: boolean
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'command', command: string): void
}>()

const menuStyle = computed(() => {
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING)
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - MENU_HEIGHT - VIEWPORT_PADDING)
  return {
    left: `${Math.min(Math.max(props.position.x, VIEWPORT_PADDING), maxLeft)}px`,
    top: `${Math.min(Math.max(props.position.y, VIEWPORT_PADDING), maxTop)}px`,
  }
})

const menuRef = ref<HTMLElement | null>(null)

function getEnabledItems(): HTMLButtonElement[] {
  return [...(menuRef.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
}

function focusMenuItem(direction: 1 | -1 | 'first' | 'last'): void {
  const items = getEnabledItems()
  if (items.length === 0) return
  if (direction === 'first') {
    items[0].focus()
    return
  }
  if (direction === 'last') {
    items[items.length - 1].focus()
    return
  }
  const currentIndex = items.findIndex(item => item === document.activeElement)
  const nextIndex = currentIndex === -1
    ? (direction === 1 ? 0 : items.length - 1)
    : (currentIndex + direction + items.length) % items.length
  items[nextIndex].focus()
}

watch(() => props.visible, async (visible) => {
  if (!visible) return
  await nextTick()
  focusMenuItem('first')
})
</script>

<style scoped>
.tab-context-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2999;
  background: transparent;
}

.tab-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 132px;
  padding: 4px;
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-md);
  background: var(--obsidian-bg-secondary);
  box-shadow: var(--shadow-lg);
}

.tab-context-menu button {
  display: flex;
  width: 100%;
  min-height: 30px;
  align-items: center;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--obsidian-text-normal);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.tab-context-menu button:hover,
.tab-context-menu button:focus-visible {
  background: var(--obsidian-bg-hover);
  outline: none;
}

.tab-context-menu button:disabled {
  color: var(--obsidian-text-faint);
  cursor: not-allowed;
}

</style>
