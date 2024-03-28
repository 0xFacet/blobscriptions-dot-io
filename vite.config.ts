import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['kzg-wasm'],
  },
  server: {
    fs: {
      allow: ['..']
    }
  },
  resolve: {
    alias: {
      events: 'eventemitter3',
      'node:stream/web': 'web-streams-polyfill',
    },
  },
})
