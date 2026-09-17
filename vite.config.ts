import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('./frontend', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@backend': fileURLToPath(new URL('./backend/src', import.meta.url)),
    },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
})
