import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The community front-end ships as both a Tauri desktop bundle and a hosted
// web app at https://thepupperclub.ca/community/app/. For the web deploy
// (WEB_DEPLOY=1) we emit absolute asset URLs under /community/app/; for
// Tauri builds we keep relative paths so the bundled installer works
// offline.
const webDeploy = process.env.WEB_DEPLOY === '1';

export default defineConfig(() => ({
  plugins: [react()],
  base: webDeploy ? '/community/app/' : './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: false,
    hmr: { protocol: 'ws', host: 'localhost', port: 5173 },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome105', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
