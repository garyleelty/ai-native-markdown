import { ref, onMounted, onUnmounted } from 'vue'

const width = ref(window.innerWidth)
const isMobile = ref(width.value < 768)
const isTablet = ref(width.value >= 768 && width.value <= 1200)
const isDesktop = ref(width.value > 1200)

const update = () => {
  width.value = window.innerWidth
  isMobile.value = width.value < 768
  isTablet.value = width.value >= 768 && width.value <= 1200
  isDesktop.value = width.value > 1200
}

let initialized = false
let consumerCount = 0
const listeners = new Set<() => void>()

const handleWindowResize = () => {
  update()
  listeners.forEach(fn => fn())
}

export function useResponsive() {
  if (!initialized) {
    initialized = true
    window.addEventListener('resize', handleWindowResize)
  }
  consumerCount += 1

  onUnmounted(() => {
    consumerCount = Math.max(0, consumerCount - 1)
    if (consumerCount === 0 && initialized) {
      window.removeEventListener('resize', handleWindowResize)
      initialized = false
    }
  })

  const onResize = (fn: () => void) => {
    listeners.add(fn)
    const stop = () => { listeners.delete(fn) }
    onUnmounted(stop)
    return stop
  }

  return { width, isMobile, isTablet, isDesktop, onResize }
}
