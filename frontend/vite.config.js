import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Ishlab chiqish: `npm run dev` (Django 8000-portda ishlab turishi kerak)
const django = 'http://127.0.0.1:8000'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': django, '/media': django, '/oauth': django, '/admin': django } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
})
