import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './stores/settings'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// 等待设置初始化完成后再挂载，避免竞态条件
const settingsStore = useSettingsStore()
settingsStore.initPromise.finally(() => {
  app.mount('#app')
})
