import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use root base in dev, and /ant-farm/ for production (GitHub Pages)
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/ant-farm/',
  plugins: [react()],
  server: { port: 5173 }
}))
