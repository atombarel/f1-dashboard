import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['host.docker.internal'],
    proxy: {
      '/api': {
        target: 'https://api.openf1.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/v1'),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for large libraries
          vendor: ['react', 'react-dom'],
          // UI components chunk
          ui: ['@radix-ui/react-select', '@radix-ui/react-switch', '@radix-ui/react-tabs', '@radix-ui/react-tooltip'],
          // Charts chunk
          charts: ['recharts', 'd3-array', 'd3-scale', 'd3-shape'],
          // Query chunk
          query: ['@tanstack/react-query', 'axios'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
