/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // vite.config runs in Node, where .env is not loaded yet, so read it by hand.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // GitHub Pages serves the app from /<repo>/, so the build needs that prefix.
    // Empty in dev, which keeps the dev server at "/".
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
