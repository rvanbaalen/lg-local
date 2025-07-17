import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import path, { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API target is optional, defaults to localhost:3001
const apiTarget = process.env.API_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html')
      }
    }
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: 'all',  // Allow all hosts
    // Don't specify port, let Vite automatically find available port
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      },
      '/socket.io': {
        target: apiTarget,
        changeOrigin: true,
        ws: true
      }
    }
  }
});