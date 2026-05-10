import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 1420,
    proxy: {
      // ── Ollama 代理 ──
      // 将 /api/ai/ollama/* 转发到本地 Ollama 服务
      // 解决浏览器直接访问 localhost:11434 的 CORS 限制
      '/api/ai/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai\/ollama/, ''),
      },
      // ── OpenAI 兼容 API 代理 ──
      // 将 /api/ai/openai/* 转发到 OpenAI API
      // 解决浏览器直接访问 api.openai.com 的 CORS 限制
      // 如需使用其他兼容服务（DeepSeek/通义千问/LM Studio），修改 target 即可
      '/api/ai/openai': {
        target: 'https://api.openai.com/v1',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/ai\/openai/, ''),
      },
    }
  }
})
