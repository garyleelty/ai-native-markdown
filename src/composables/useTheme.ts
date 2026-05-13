import { useSettingsStore } from '@/stores/settings'

export function useTheme() {
  const settingsStore = useSettingsStore()
  
  return {
    theme: settingsStore.theme,
    isDark: settingsStore.isDark(),
    setTheme: settingsStore.setTheme,
    toggleTheme: settingsStore.toggleTheme,
    applyTheme: settingsStore.applyTheme
  }
}
