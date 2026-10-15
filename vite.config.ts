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
  },
  // 单元测试：只跑 tests/ 下的 vitest 用例；e2e/ 是 Playwright 的，
  // 需要先起 dev server，不能混在 vitest 里。
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
