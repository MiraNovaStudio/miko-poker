import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../engine/dist'),
    },
  },
  test: {
    include: ['src/tests/**/*.test.ts'],
  },
});
