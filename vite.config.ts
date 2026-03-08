import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/scifistudio/' : '/',
  server: {
    port: 3000,
    open: true,
  },
}))
