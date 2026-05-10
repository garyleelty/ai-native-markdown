<template>
  <button
    class="voice-input-btn"
    :class="{
      'is-listening': status === 'listening',
      'is-recognizing': status === 'recognizing',
      'is-error': status === 'error',
      'is-unsupported': !isSupported
    }"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @click="handleClick"
    :title="buttonTitle"
    :disabled="!isSupported"
  >
    <!-- 麦克风图标 -->
    <svg
      v-if="status !== 'recognizing'"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>

    <!-- 识别中 loading -->
    <svg
      v-else
      class="spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>

    <!-- 录音中波纹动画 -->
    <span v-if="status === 'listening'" class="voice-wave" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVoiceInput, type VoiceInputMode } from '../../composables/useVoiceInput'

interface Props {
  mode?: VoiceInputMode
  language?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'hold',
  language: 'zh-CN',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'result', text: string): void
  (e: 'error', message: string): void
}>()

const { status, isSupported, startListening, stopListening } = useVoiceInput({
  mode: props.mode,
  language: props.language,
  onResult: (text: string, isFinal: boolean) => {
    if (isFinal) {
      emit('result', text)
    }
  },
  onError: (error: string) => {
    emit('error', error)
  },
})

const buttonTitle = computed(() => {
  if (!isSupported) return '当前浏览器不支持语音输入'
  if (status.value === 'listening') return '录音中... (松开结束)'
  if (status.value === 'recognizing') return '识别中...'
  if (status.value === 'error') return '语音识别出错，点击重试'
  return props.mode === 'hold' ? '按住说话' : '点击开始语音输入'
})

let isHolding = false

const handleMouseDown = () => {
  if (props.mode === 'hold' && isSupported && !props.disabled) {
    isHolding = true
    startListening()
  }
}

const handleMouseUp = () => {
  if (props.mode === 'hold' && isHolding) {
    isHolding = false
    stopListening()
  }
}

const handleMouseLeave = () => {
  if (props.mode === 'hold' && isHolding) {
    isHolding = false
    stopListening()
  }
}

const handleTouchStart = (e: TouchEvent) => {
  if (props.mode === 'hold' && isSupported && !props.disabled) {
    e.preventDefault()
    isHolding = true
    startListening()
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  if (props.mode === 'hold' && isHolding) {
    e.preventDefault()
    isHolding = false
    stopListening()
  }
}

const handleClick = () => {
  if (props.mode === 'toggle' && isSupported && !props.disabled) {
    if (status.value === 'listening') {
      stopListening()
    } else {
      startListening()
    }
  }
}
</script>

<style scoped>
.voice-input-btn {
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  position: relative;
  flex-shrink: 0;
}

.voice-input-btn:hover:not(:disabled) {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.voice-input-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.voice-input-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 录音中状态 */
.voice-input-btn.is-listening {
  color: var(--accent);
  background: var(--accent-soft);
}

/* 识别中状态 */
.voice-input-btn.is-recognizing {
  color: var(--accent);
}

/* 错误状态 */
.voice-input-btn.is-error {
  color: var(--error);
  background: rgba(248, 113, 113, 0.1);
}

/* 波纹动画 */
.voice-wave {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  animation: voicePulse 1.5s ease-out infinite;
  pointer-events: none;
}

@keyframes voicePulse {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

/* 识别中旋转动画 */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
