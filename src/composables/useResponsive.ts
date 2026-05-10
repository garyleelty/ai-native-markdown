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
const listeners = new Set<() => void>()

export function useResponsive() {
  if (!initialized) {
    initialized = true
    window.addEventListener('resize', () => {
      update()
      listeners.forEach(fn => fn())
    })
  }

  const onResize = (fn: () => void) => {
    listeners.add(fn)
    const stop = () => { listeners.delete(fn) }
    onUnmounted(stop)
    return stop
  }

  return { width, isMobile, isTablet, isDesktop, onResize }
}
