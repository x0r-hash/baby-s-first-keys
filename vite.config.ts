import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { start } from '@tanstack/react-start'

export default defineConfig({
  plugins: [
    start({
      adapter: 'node',
    }),
    react(),
  ],
})
