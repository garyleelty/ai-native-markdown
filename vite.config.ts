import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    include: [
      'dayjs',
      'dayjs/locale/zh-cn',
      'mermaid',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 1420,
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('@vueuse/core')) return
        warn(warning)
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/element-plus/')) return 'element-plus'
          if (id.includes('/@element-plus/icons-vue/')) return 'element-icons'
          if (id.includes('/@codemirror/') || id.includes('/codemirror/')) return 'codemirror'
          if (id.includes('/markdown-it') || id.includes('/highlight.js/') || id.includes('/katex/')) return 'markdown'
          if (id.includes('/cytoscape/') || id.includes('/cytoscape-cose-bilkent/') || id.includes('/d3') || id.includes('/d3-')) return 'graph'
          if (id.includes('/pdfjs-dist/') || id.includes('/tesseract.js/')) return 'pdf-ocr'
          if (id.includes('/dexie/') || id.includes('/pinia/') || id.includes('/@vueuse/')) return 'app-vendor'
          if (id.includes('/vue/') || id.includes('/@vue/')) return 'vue-vendor'
          return undefined
        }
      }
    },
    chunkSizeWarningLimit: 1100,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
