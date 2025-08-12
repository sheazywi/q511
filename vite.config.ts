
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/q511': {
        target: 'https://www.quebec511.info',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/q511/, ''),
      },
      '/Carte': {
        target: 'https://www.quebec511.info',
        changeOrigin: true,
        secure: true,
      },
      '/Images': {
        target: 'https://www.quebec511.info',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
