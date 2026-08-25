import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/calculadora-precios-jmgr/' : '/',
  plugins: [react(), sites()],
})

