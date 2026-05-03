import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/start/vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      adapter: 'node', // 👈 THIS is the important part
    }),
    react(),
  ],
})
