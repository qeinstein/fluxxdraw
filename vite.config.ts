import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      // the usage page is a separate entry, so none of it ships in the app
      input: {
        main: "index.html",
        usage: "uqnautmfluxx.html",
      },
    },
  },
  plugins: [react()],
})
