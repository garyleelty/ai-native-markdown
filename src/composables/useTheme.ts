import { ref, watch } from 'vue'
import { usePreferredDark } from '@vueuse/core'

type ThemeMode = 'dark' | 'light' | 'system'

const theme = ref<ThemeMode>((localStorage.getItem('theme') as ThemeMode) || 'system')
const preferredDark = usePreferredDark()

const isDark = ref(true)

const applyTheme = () => {
  const dark = theme.value === 'dark' || (theme.value === 'system' && preferredDark.value)
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.classList.toggle('light', !dark)
}

watch([theme, preferredDark], applyTheme, { immediate: true })

watch(theme, (val) => {
  localStorage.setItem('theme', val)
})

export function useTheme() {
  const setTheme = (mode: ThemeMode) => { theme.value = mode }
  const toggleTheme = () => {
    theme.value = isDark.value ? 'light' : 'dark'
  }
  return { theme, isDark, setTheme, toggleTheme }
}
