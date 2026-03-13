import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  publicDir: 'static',
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../engine/dist'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
