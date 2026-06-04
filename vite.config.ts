import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/oritek-world-monitor/',
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
})
