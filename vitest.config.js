import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['tests/e2e/**'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['tests/**']
    }
  }
});
