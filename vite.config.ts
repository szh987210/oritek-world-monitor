import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  base: '/oritek-world-monitor/',
  define: {
    // #10: 生产模式关闭详细日志，开发模式保留
    __DEBUG__: mode === 'development',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        bigscreen: resolve(__dirname, 'bigscreen.html'),
      },
    },
  },
}))
