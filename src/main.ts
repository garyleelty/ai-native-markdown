import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

app.config.errorHandler = (err, instance, info) => {
  console.error('[Global Error]', err, info)
  const message = err instanceof Error ? err.message : String(err)
  if (!message.includes('ResizeObserver') && !message.includes('NetworkError')) {
    import('element-plus').then(({ ElMessage }) => {
      ElMessage.error(`应用错误: ${message.slice(0, 100)}`)
    })
  }
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason)
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason)
  if (!message.includes('AbortError') && !message.includes('NetworkError')) {
    event.preventDefault()
  }
})

app.mount('#app')
