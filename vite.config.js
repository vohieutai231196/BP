import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Multi-page app: the web dashboard (index.html) and the Chrome
// extension popup preview (extension.html) are separate entry points.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        extension: resolve(__dirname, 'extension.html'),
      },
    },
  },
})
