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
  server: {
    host: '0.0.0.0',
    port: 1420,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'element-plus': ['element-plus', '@element-plus/icons-vue'],
          'codemirror': ['codemirror', '@codemirror/state', '@codemirror/view', '@codemirror/lang-markdown', '@codemirror/theme-one-dark', '@codemirror/search'],
          'markdown': ['markdown-it', 'markdown-it-anchor', 'markdown-it-task-lists', 'highlight.js', 'katex'],
          'mermaid': ['mermaid', 'd3'],
          'pdf-ocr': ['pdfjs-dist', 'tesseract.js'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  }
})
